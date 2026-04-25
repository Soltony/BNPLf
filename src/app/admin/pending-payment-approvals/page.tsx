"use server";

import { getUserFromSession } from "@/lib/user";
import prisma from "@/lib/prisma";
import type { PendingChange, User } from "@prisma/client";
import { PaymentApprovalsClient } from "./client";

export type PendingPaymentApproval = PendingChange & {
  createdBy: Pick<
    User,
    | "id"
    | "fullName"
    | "email"
    | "phoneNumber"
    | "roleId"
    | "loanProviderId"
    | "status"
    | "passwordChangeRequired"
    | "createdAt"
  >;
  entityName: string;
  providerName?: string;
};

async function getPendingPaymentApprovals(): Promise<
  PendingPaymentApproval[]
> {
  const changes = await prisma.pendingChange.findMany({
    where: {
      status: "PENDING",
      entityType: "PaymentMarkSuccessful",
    },
    include: {
      createdBy: {
        select: {
          id: true,
          fullName: true,
          email: true,
          phoneNumber: true,
          roleId: true,
          loanProviderId: true,
          status: true,
          passwordChangeRequired: true,
          createdAt: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const detailed = changes.map((change) => {
    let entityName = change.entityId || "N/A";
    let providerName: string | undefined;

    try {
      const data = JSON.parse(change.payload);
      const created = data?.created;
      if (created) {
        const loanId = created.loanId ? String(created.loanId) : null;
        const borrowerPhone = created.borrowerPhone
          ? String(created.borrowerPhone)
          : null;
        const accountNumber = created.accountNumber
          ? String(created.accountNumber)
          : null;
        const cbsTxId = created.cbsTransactionId
          ? String(created.cbsTransactionId)
          : null;
        const amount = created.amount != null ? Number(created.amount) : null;

        entityName =
          [
            loanId ? `Loan ${loanId}` : null,
            borrowerPhone ? `Phone ${borrowerPhone}` : null,
            accountNumber ? `Acct ${accountNumber}` : null,
            cbsTxId ? `FT ${cbsTxId}` : null,
            amount != null ? `Amt ${amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}` : null,
          ]
            .filter(Boolean)
            .join(" \u2022 ") || entityName;

        if (created.providerName) {
          providerName = String(created.providerName);
        }
      }
    } catch {
      // ignore
    }

    return {
      ...change,
      entityName,
      providerName,
    } as PendingPaymentApproval;
  });

  return detailed;
}

export default async function PaymentApprovalsPage() {
  const user = await getUserFromSession();
  if (!user) return <div>Not authenticated</div>;

  const pendingChanges = await getPendingPaymentApprovals();

  return (
    <PaymentApprovalsClient
      pendingChanges={pendingChanges}
      currentUser={user}
    />
  );
}
