import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUserFromSession } from "@/lib/user";

/**
 * GET /api/pending-payments
 * List pending payments (BNPL) with pagination and search.
 */
export async function GET(req: NextRequest) {
  const user = await getUserFromSession();
  if (
    !user ||
    (!user.permissions?.["pending-payments"]?.read &&
      !user.permissions?.["pending-payment-approvals"]?.read &&
      !user.permissions?.["approvals"]?.read)
  ) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const url = new URL(req.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
  const limit = Math.min(
    100,
    Math.max(1, parseInt(url.searchParams.get("limit") || "20", 10))
  );
  const search = url.searchParams.get("search")?.trim() || "";
  const statusFilter = url.searchParams.get("status") || "PENDING";

  const where: any = {};
  if (statusFilter !== "ALL") {
    where.status = statusFilter;
  }

  if (search) {
    const accountMatches = await prisma.phoneAccount.findMany({
      where: { accountNumber: { contains: search } },
      select: { phoneNumber: true },
      take: 50,
    });
    const phoneNumbersFromAccounts = [
      ...new Set(accountMatches.map((a) => a.phoneNumber)),
    ];
    where.OR = [
      { transactionId: { contains: search } },
      { loanId: { contains: search } },
      { borrowerId: { contains: search } },
      ...(phoneNumbersFromAccounts.length
        ? [{ borrowerId: { in: phoneNumbersFromAccounts } }]
        : []),
    ];
  }

  const [rows, total] = await Promise.all([
    prisma.pendingPayment.findMany({
      where,
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
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.pendingPayment.count({ where }),
  ]);

  // Check if any of these have a pending approval already
  const pendingPaymentIds = rows.map((r) => r.id);
  const existingApprovals = pendingPaymentIds.length
    ? await prisma.pendingChange.findMany({
        where: {
          entityType: "PaymentMarkSuccessful",
          status: "PENDING",
          entityId: { in: pendingPaymentIds },
        },
        select: { entityId: true, id: true, createdAt: true, createdById: true },
      })
    : [];

  const approvalMap = new Map(
    existingApprovals.map((a) => [a.entityId, a])
  );

  const borrowerIds = [...new Set(rows.map((r) => r.borrowerId))];
  const phoneAccounts = borrowerIds.length
    ? await prisma.phoneAccount.findMany({
        where: { phoneNumber: { in: borrowerIds } },
        select: { phoneNumber: true, accountNumber: true, isActive: true },
        orderBy: [{ isActive: "desc" }, { createdAt: "asc" }],
      })
    : [];
  const accountByBorrower = new Map<string, { accountNumber: string }>();
  for (const account of phoneAccounts) {
    if (!accountByBorrower.has(account.phoneNumber)) {
      accountByBorrower.set(account.phoneNumber, {
        accountNumber: account.accountNumber,
      });
    }
  }

  const enrichedRows = rows.map((r) => ({
    ...r,
    borrower: {
      ...r.borrower,
      phoneNumber: r.borrowerId,
      phoneAccounts: accountByBorrower.has(r.borrowerId)
        ? [accountByBorrower.get(r.borrowerId)!]
        : [],
    },
    pendingApproval: approvalMap.get(r.id) || null,
  }));

  return NextResponse.json({
    rows: enrichedRows,
    totalPages: Math.ceil(total / limit),
    total,
  });
}
