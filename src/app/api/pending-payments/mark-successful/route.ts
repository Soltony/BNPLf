import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUserFromSession } from "@/lib/user";
import { createAuditLog } from "@/lib/audit-log";

/**
 * POST /api/pending-payments/mark-successful
 * Creates a PendingChange to mark a pending payment as successful.
 * Requires approval (maker-checker pattern).
 *
 * Body: { pendingPaymentId: string, cbsTransactionId: string }
 */
export async function POST(req: NextRequest) {
  const user = await getUserFromSession();
  if (
    !user ||
    (!user.permissions?.["pending-payments"]?.update &&
      !user.permissions?.["pending-payment-approvals"]?.update &&
      !user.permissions?.["approvals"]?.update)
  ) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const ipAddress =
    (req as any).ip || req.headers.get("x-forwarded-for") || "N/A";
  const userAgent = req.headers.get("user-agent") || "N/A";

  const body = await req.json().catch(() => null);
  const pendingPaymentId = body?.pendingPaymentId
    ? String(body.pendingPaymentId).trim()
    : null;
  const cbsTransactionId = body?.cbsTransactionId
    ? String(body.cbsTransactionId).trim()
    : null;

  if (!pendingPaymentId) {
    return NextResponse.json(
      { error: "Missing pendingPaymentId" },
      { status: 400 }
    );
  }

  if (!cbsTransactionId) {
    return NextResponse.json(
      { error: "Missing CBS transaction ID (FT reference)" },
      { status: 400 }
    );
  }

  // Look up the pending payment
  const pendingPayment = await prisma.pendingPayment.findUnique({
    where: { id: pendingPaymentId },
    include: {
      loan: {
        select: {
          id: true,
          loanAmount: true,
          repaymentStatus: true,
          borrowerId: true,
          product: {
            select: {
              name: true,
              provider: { select: { id: true, name: true } },
            },
          },
        },
      },
      borrower: {
        select: {
          id: true,
        },
      },
    },
  });

  if (!pendingPayment) {
    return NextResponse.json(
      { error: "Pending payment not found" },
      { status: 404 }
    );
  }

  if (pendingPayment.status !== "PENDING") {
    return NextResponse.json(
      { error: `Payment is already ${pendingPayment.status}` },
      { status: 409 }
    );
  }

  // Check for existing pending approval
  const existingApproval = await prisma.pendingChange.findFirst({
    where: {
      entityType: "PaymentMarkSuccessful",
      entityId: pendingPaymentId,
      status: "PENDING",
    },
  });

  if (existingApproval) {
    return NextResponse.json(
      { error: "This payment already has a pending approval request." },
      { status: 409 }
    );
  }

  // Create a PendingChange for maker-checker approval
  const pendingChange = await prisma.pendingChange.create({
    data: {
      entityType: "PaymentMarkSuccessful",
      entityId: pendingPaymentId,
      changeType: "CREATE",
      payload: JSON.stringify({
        created: {
          pendingPaymentId: pendingPayment.id,
          transactionId: pendingPayment.transactionId,
          loanId: pendingPayment.loanId,
          borrowerId: pendingPayment.borrowerId,
          amount: pendingPayment.amount,
          cbsTransactionId,
          providerName: pendingPayment.loan.product.provider.name,
          providerId: pendingPayment.loan.product.provider.id,
          productName: pendingPayment.loan.product.name,
          borrowerPhone: pendingPayment.borrowerId,
          accountNumber:
            (
              await prisma.phoneAccount.findFirst({
                where: { phoneNumber: pendingPayment.borrowerId },
                orderBy: [{ isActive: "desc" }, { createdAt: "asc" }],
                select: { accountNumber: true },
              })
            )?.accountNumber ?? null,
        },
      }),
      createdById: user.id,
    },
  });

  await createAuditLog({
    actorId: user.id,
    action: "PAYMENT_MARK_SUCCESSFUL_REQUESTED",
    entity: "PendingPayment",
    entityId: pendingPaymentId,
    details: {
      pendingChangeId: pendingChange.id,
      pendingPaymentId,
      loanId: pendingPayment.loanId,
      cbsTransactionId,
      amount: pendingPayment.amount,
    },
    ipAddress,
    userAgent,
  });

  return NextResponse.json({
    message: "Mark successful request submitted for approval.",
    changeId: pendingChange.id,
  });
}
