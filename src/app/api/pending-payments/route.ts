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
    where.OR = [
      { transactionId: { contains: search } },
      { loanId: { contains: search } },
      { borrowerId: { contains: search } },
      { borrower: { phoneNumber: { contains: search } } },
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
            status: true,
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
            phoneNumber: true,
            phoneAccounts: { select: { accountNumber: true }, take: 1 },
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

  const enrichedRows = rows.map((r) => ({
    ...r,
    pendingApproval: approvalMap.get(r.id) || null,
  }));

  return NextResponse.json({
    rows: enrichedRows,
    totalPages: Math.ceil(total / limit),
    total,
  });
}
