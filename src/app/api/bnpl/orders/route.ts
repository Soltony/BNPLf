import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { calculateTotalRepayable } from '@/lib/loan-calculator';
import { addDays } from 'date-fns';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const borrowerId = searchParams.get('borrowerId');
    if (!borrowerId) return NextResponse.json({ error: 'borrowerId is required' }, { status: 400 });

    const orders = await prisma.order.findMany({
      where: { borrowerId },
      include: {
        merchant: { select: { id: true, name: true } },
        orderItems: {
          include: {
            item: { select: { id: true, name: true, imageUrl: true, price: true } },
            variant: true,
            optionSelections: { include: { optionValue: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(orders);
  } catch (error) {
    console.error('Error fetching borrower orders:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { id, status, cancelReason } = await req.json();
    if (!id || !status) return NextResponse.json({ error: 'id and status are required' }, { status: 400 });

    const validStatuses = ['DELIVERED', 'CANCELLED'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    const order = await prisma.order.findUnique({ where: { id } });
    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

    // Only allow delivery confirmation when order is ON_DELIVERY
    if (status === 'DELIVERED' && order.status !== 'ON_DELIVERY') {
      return NextResponse.json({ error: 'Order must be ON_DELIVERY to confirm delivery' }, { status: 400 });
    }

    // Only allow cancellation if order is not already delivered or cancelled
    if (status === 'CANCELLED') {
      if (order.status === 'DELIVERED') {
        return NextResponse.json({ error: 'Cannot cancel a delivered order' }, { status: 400 });
      }
      if (order.status === 'CANCELLED') {
        return NextResponse.json({ error: 'Order is already cancelled' }, { status: 400 });
      }
    }

    const updateData: any = { status };
    if (status === 'CANCELLED') {
      updateData.cancelReason = cancelReason || 'Cancelled by borrower';
      updateData.cancelledBy = 'BORROWER';
    }

    const updated = await prisma.order.update({
      where: { id },
      data: updateData,
      include: {
        merchant: { select: { id: true, name: true } },
        orderItems: { include: { item: { select: { id: true, name: true } } } },
      },
    });

    // If cancelling, also cancel the linked loan application
    if (status === 'CANCELLED' && order.loanApplicationId) {
      await prisma.loanApplication.update({
        where: { id: order.loanApplicationId },
        data: { status: 'CANCELLED' },
      }).catch(() => {});
    }

    // ── When delivery is confirmed, CREATE the full loan + accounting + disbursement ──
    if (status === 'DELIVERED' && order.loanApplicationId) {
      try {
        const loanApp = await prisma.loanApplication.findUnique({
          where: { id: order.loanApplicationId },
          include: {
            product: {
              include: {
                provider: { include: { ledgerAccounts: true } },
              },
            },
          },
        });

        if (!loanApp || !loanApp.product) {
          console.error('LoanApplication or product not found for BNPL delivery:', order.loanApplicationId);
          return NextResponse.json(updated);
        }

        const product = loanApp.product;
        const provider = product.provider;
        const loanAmount = loanApp.loanAmount || order.totalAmount;
        const disbursedDate = new Date();
        const durationDays = product.duration || 30;
        const dueDate = addDays(disbursedDate, durationDays);

        if (provider.initialBalance < loanAmount) {
          console.error(`Insufficient provider funds for BNPL delivery. Available: ${provider.initialBalance}, Requested: ${loanAmount}`);
          return NextResponse.json({ error: 'Insufficient provider funds' }, { status: 400 });
        }

        // Calculate service fee & tax
        const taxConfigs = await prisma.tax.findMany();
        const tempLoanForCalc = {
          id: 'temp',
          loanAmount,
          disbursedDate,
          dueDate,
          serviceFee: 0,
          repaymentStatus: 'Unpaid' as const,
          payments: [],
          productName: product.name,
          providerName: provider.name,
          repaidAmount: 0,
          penaltyAmount: 0,
          product: product as any,
        };
        const { serviceFee: calculatedServiceFee, tax: calculatedTax } =
          calculateTotalRepayable(tempLoanForCalc as any, product as any, (taxConfigs ?? []) as any, disbursedDate);

        // Find ledger accounts
        const principalReceivableAccount = provider.ledgerAccounts.find(
          (acc: any) => acc.category === 'Principal' && acc.type === 'Receivable'
        );
        const serviceFeeReceivableAccount = provider.ledgerAccounts.find(
          (acc: any) => acc.category === 'ServiceFee' && acc.type === 'Receivable'
        );
        const taxReceivableAccount = provider.ledgerAccounts.find(
          (acc: any) => acc.category === 'Tax' && acc.type === 'Receivable'
        );

        if (!principalReceivableAccount) {
          console.error('Principal Receivable ledger account not found for BNPL delivery');
          return NextResponse.json(updated);
        }

        // ── Create the Loan record ──
        const createdLoan = await prisma.loan.create({
          data: {
            borrowerId: loanApp.borrowerId,
            productId: loanApp.productId,
            loanApplicationId: loanApp.id,
            loanAmount,
            disbursedDate,
            dueDate,
            serviceFee: calculatedServiceFee,
            penaltyAmount: 0,
            repaymentStatus: 'Unpaid',
            repaidAmount: 0,
          },
        });

        // Link the loan to the order
        await prisma.order.update({
          where: { id: order.id },
          data: { loanId: createdLoan.id },
        });

        // ── Journal & Ledger Entries ──
        const journalEntry = await prisma.journalEntry.create({
          data: {
            providerId: provider.id,
            loanId: createdLoan.id,
            date: disbursedDate,
            description: `BNPL disbursement for ${product.name} to borrower ${loanApp.borrowerId}`,
          },
        });

        // Principal
        await prisma.ledgerEntry.createMany({
          data: [{
            journalEntryId: journalEntry.id,
            ledgerAccountId: principalReceivableAccount.id,
            type: 'Debit',
            amount: loanAmount,
          }],
        });
        await prisma.ledgerAccount.update({
          where: { id: principalReceivableAccount.id },
          data: { balance: { increment: loanAmount } },
        });

        // Service Fee
        if (calculatedServiceFee > 0 && serviceFeeReceivableAccount) {
          await prisma.ledgerEntry.createMany({
            data: [{
              journalEntryId: journalEntry.id,
              ledgerAccountId: serviceFeeReceivableAccount.id,
              type: 'Debit',
              amount: calculatedServiceFee,
            }],
          });
          await prisma.ledgerAccount.update({
            where: { id: serviceFeeReceivableAccount.id },
            data: { balance: { increment: calculatedServiceFee } },
          });
        }

        // Tax
        if (calculatedTax > 0.000001 && taxReceivableAccount) {
          await prisma.ledgerEntry.createMany({
            data: [{
              journalEntryId: journalEntry.id,
              ledgerAccountId: taxReceivableAccount.id,
              type: 'Debit',
              amount: calculatedTax,
            }],
          });
          await prisma.ledgerAccount.update({
            where: { id: taxReceivableAccount.id },
            data: { balance: { increment: calculatedTax } },
          });
        }

        // Deduct provider balance
        await prisma.loanProvider.update({
          where: { id: provider.id },
          data: { initialBalance: { decrement: loanAmount } },
        });

        // ── Create installment schedule ──
        try {
          const installmentsCount = product.installments || null;
          const repaymentIntervalDays = (product as any).repaymentIntervalDays ?? null;
          if (installmentsCount && installmentsCount > 0) {
            const round2 = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100;
            const interval = repaymentIntervalDays ??
              (Math.floor((dueDate.getTime() - disbursedDate.getTime()) / (1000 * 60 * 60 * 24) / installmentsCount) || 0);

            let remaining = round2(Number(loanAmount));
            for (let i = 1; i <= installmentsCount; i++) {
              const isLast = i === installmentsCount;
              const amount = isLast ? remaining : round2(Math.floor((loanAmount / installmentsCount) * 100) / 100);
              const due = addDays(disbursedDate, interval * i);
              await prisma.loanInstallment.create({
                data: {
                  loanId: createdLoan.id,
                  installmentNumber: i,
                  dueDate: due,
                  amount,
                  isActive: i === 1,
                },
              });
              remaining = round2(remaining - amount);
            }
          }
        } catch (e) {
          console.error('Failed to create installments for BNPL loan:', e);
        }

        // ── Update LoanApplication status ──
        await prisma.loanApplication.update({
          where: { id: loanApp.id },
          data: { status: 'DISBURSED' },
        });

        // ── Disbursement Transaction & External Call ──
        const forcedProviderId = process.env.FORCE_PROVIDER_ID ?? 'PRO0001';
        const activeAccount = await prisma.phoneAccount.findFirst({
          where: { phoneNumber: loanApp.borrowerId, isActive: true },
        });
        const creditAccount = activeAccount?.accountNumber || '';

        if (creditAccount) {
          const disbursement = await prisma.disbursementTransaction.create({
            data: {
              loanId: createdLoan.id,
              providerId: forcedProviderId,
              originalProviderId: provider.id,
              creditAccount,
              amount: loanAmount,
              disbursementStatus: 'PENDING',
              requestPayload: JSON.stringify({
                creditAccount,
                providerId: forcedProviderId,
                amount: loanAmount,
                loanId: createdLoan.id,
              }),
            } as any,
          });

          try {
            const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.VERCEL_URL || 'http://localhost:3000';
            const disRes = await fetch(`${baseUrl}/api/external/disbursement`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                creditAccount,
                providerId: forcedProviderId,
                amount: loanAmount,
                loanId: createdLoan.id,
              }),
            });

            if (disRes.ok) {
              await prisma.disbursementTransaction.update({
                where: { id: disbursement.id },
                data: { disbursementStatus: 'SUCCESS' },
              });
            } else {
              console.error('External disbursement failed for BNPL order:', id);
            }
          } catch (disErr) {
            console.error('Error calling external disbursement:', disErr);
          }
        }
      } catch (loanErr) {
        console.error('Error creating loan on BNPL delivery confirmation:', loanErr);
      }
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating order status:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { borrowerId, merchantId, productId, loanAmount, creditAccount, items, paymentType } = body;
    const isDirectPayment = paymentType === 'DIRECT';

    if (!borrowerId || !merchantId || !items?.length) {
      console.error('[api/bnpl/orders] Missing required order fields', {
        borrowerId: borrowerId ?? null,
        merchantId: merchantId ?? null,
        productId: productId ?? null,
        loanAmount: loanAmount ?? null,
        creditAccount: creditAccount ?? null,
        itemCount: Array.isArray(items) ? items.length : 0,
        body,
      });
      return NextResponse.json({ error: 'borrowerId, merchantId, and items are required' }, { status: 400 });
    }

    if (!isDirectPayment && (!productId || !loanAmount)) {
      console.error('[api/bnpl/orders] Missing required BNPL financing fields', {
        borrowerId,
        merchantId,
        productId: productId ?? null,
        loanAmount: loanAmount ?? null,
        creditAccount: creditAccount ?? null,
        itemCount: Array.isArray(items) ? items.length : 0,
        body,
      });
      return NextResponse.json({ error: 'productId and loanAmount are required for BNPL orders' }, { status: 400 });
    }

    // Ensure borrower exists
    await prisma.borrower.upsert({
      where: { id: borrowerId },
      update: {},
      create: { id: borrowerId },
    });

    // ── Create a LoanApplication with PENDING_DELIVERY status (BNPL only) ──
    // No loan is created yet — that happens on delivery confirmation.
    let loanApplication: any = null;
    if (!isDirectPayment) {
      loanApplication = await prisma.loanApplication.create({
        data: {
          borrowerId,
          productId,
          loanAmount,
          status: 'PENDING_DELIVERY',
        },
      });
    }

    let totalAmount = 0;
    const orderItemsData: any[] = [];

    for (const orderItem of items) {
      const item = await prisma.item.findUnique({
        where: { id: orderItem.itemId },
        include: { variants: true, optionGroups: { include: { values: true } } },
      });

      if (!item || item.status !== 'ACTIVE') {
        return NextResponse.json({ error: `Item ${orderItem.itemId} not found or inactive` }, { status: 400 });
      }

      let unitPrice = item.price;

      // Apply variant price if selected
      if (orderItem.variantId) {
        const variant = item.variants.find(v => v.id === orderItem.variantId);
        if (variant) unitPrice = variant.price;
      }

      // Calculate option price deltas
      let optionDelta = 0;
      const optionSelections: any[] = [];
      if (orderItem.optionSelections?.length) {
        for (const sel of orderItem.optionSelections) {
          const group = item.optionGroups.find(g => g.values.some(v => v.id === sel.optionValueId));
          const value = group?.values.find(v => v.id === sel.optionValueId);
          if (value) {
            optionDelta += value.priceDelta;
            optionSelections.push({ optionValueId: value.id, priceDelta: value.priceDelta });
          }
        }
      }

      unitPrice += optionDelta;
      const quantity = orderItem.quantity || 1;
      const lineTotal = unitPrice * quantity;
      totalAmount += lineTotal;

      orderItemsData.push({
        itemId: orderItem.itemId,
        variantId: orderItem.variantId || null,
        quantity,
        unitPrice,
        lineTotal,
        optionSelections: optionSelections.length ? { create: optionSelections } : undefined,
      });
    }

    // Apply discount rules
    for (const oid of orderItemsData) {
      const discounts = await prisma.discountRule.findMany({
        where: {
          status: 'ACTIVE',
          OR: [{ itemId: oid.itemId }, { categoryId: null, itemId: null }],
          AND: [
            { OR: [{ startDate: null }, { startDate: { lte: new Date() } }] },
            { OR: [{ endDate: null }, { endDate: { gte: new Date() } }] },
          ],
          minQuantity: { lte: oid.quantity },
        },
        orderBy: { value: 'desc' },
      });

      if (discounts.length > 0) {
        const discount = discounts[0];
        if (discount.type === 'percentage' || discount.type === 'PERCENT') {
          const discountAmount = (oid.lineTotal * discount.value) / 100;
          totalAmount -= discountAmount;
          oid.lineTotal -= discountAmount;
        } else if (discount.type === 'fixed' || discount.type === 'FIXED') {
          totalAmount -= discount.value;
          oid.lineTotal -= discount.value;
        }
      }
    }

    const order = await prisma.order.create({
      data: {
        borrowerId,
        merchantId,
        loanApplicationId: loanApplication?.id || null,
        totalAmount: Math.max(0, totalAmount),
        paymentType: isDirectPayment ? 'DIRECT' : 'BNPL',
        status: 'PENDING_MERCHANT_CONFIRMATION',
        orderItems: { create: orderItemsData },
      },
      include: {
        merchant: true,
        orderItems: { include: { item: true, variant: true, optionSelections: { include: { optionValue: true } } } },
      },
    });

    return NextResponse.json(order, { status: 201 });
  } catch (error) {
    console.error('Error creating order:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
