
'use server';

import prisma from '@/lib/prisma';
import { createAuditLog } from '@/lib/audit-log';

export interface EligibilityResult {
  isEligible: boolean;
  reason?: string;
  activeFinancing?: {
    type: 'LOAN' | 'BNPL_ORDER' | 'PENDING_DISBURSEMENT';
    id: string;
    status: string;
  };
}

/**
 * Validates if a borrower is eligible for new financing (Loan or BNPL).
 * A borrower is NOT eligible if they have:
 * - An active loan (Unpaid)
 * - An active BNPL order (not Delivered or Cancelled)
 * - A pending disbursement transaction
 * - NPL status
 * 
 * @param borrowerId The ID of the borrower to validate
 * @param actorId Optional ID of the user performing the action for audit logging
 * @param options Optional exclusions for updates
 * @returns EligibilityResult
 */
export async function validateBorrowerEligibility(
  borrowerId: string, 
  actorId?: string,
  options?: { excludeOrderId?: string; excludeLoanId?: string; includePending?: boolean }
): Promise<EligibilityResult> {
  // Default includePending to true for strict validation (creation)
  const includePending = options?.includePending ?? true;

  // 1. Check Borrower Status (NPL)
  const borrower = await prisma.borrower.findUnique({
    where: { id: borrowerId },
    select: { status: true }
  });

  if (!borrower) {
    return { isEligible: false, reason: 'Borrower profile not found.' };
  }

  if (borrower.status === 'NPL') {
    const result = { isEligible: false, reason: 'Borrower account is restricted due to Non-Performing Loan (NPL) status.' };
    if (actorId) {
      await logBlockedAttempt(actorId, borrowerId, result.reason);
    }
    return result;
  }

  // 2. Check for Active Loans
  const activeLoan = await prisma.loan.findFirst({
    where: {
      borrowerId,
      repaymentStatus: 'Unpaid',
      ...(options?.excludeLoanId ? { id: { not: options.excludeLoanId } } : {})
    },
    select: { id: true, repaymentStatus: true }
  });

  if (activeLoan) {
    const result = {
      isEligible: false,
      reason: 'Borrower already has an active unpaid loan.',
      activeFinancing: { type: 'LOAN' as const, id: activeLoan.id, status: activeLoan.repaymentStatus }
    };
    if (actorId) {
      await logBlockedAttempt(actorId, borrowerId, result.reason, { loanId: activeLoan.id });
    }
    return result;
  }

  // 3. Check for Active BNPL Orders
  // Active BNPL orders are those not yet DELIVERED (which becomes a loan) or CANCELLED
  // includePending=true (default) blocks if there's any PENDING order.
  // includePending=false only blocks if an order is already ON_DELIVERY.
  const activeOrder = await prisma.order.findFirst({
    where: {
      borrowerId,
      status: {
        in: includePending ? ['PENDING_MERCHANT_CONFIRMATION', 'ON_DELIVERY'] : ['ON_DELIVERY']
      },
      ...(options?.excludeOrderId ? { id: { not: options.excludeOrderId } } : {})
    },
    select: { id: true, status: true }
  });

  if (activeOrder) {
    const result = {
      isEligible: false,
      reason: 'Borrower already has an active BNPL order in progress.',
      activeFinancing: { type: 'BNPL_ORDER' as const, id: activeOrder.id, status: activeOrder.status }
    };
    if (actorId) {
      await logBlockedAttempt(actorId, borrowerId, result.reason, { orderId: activeOrder.id });
    }
    return result;
  }

  // 4. Check for Pending Disbursements
  // We only care about pending disbursements for loans that are still UNPAID.
  // If a loan is already paid, its disbursement status (to merchant or borrower) 
  // should not block new financing.
  const pendingDisbursement = await prisma.disbursementTransaction.findFirst({
    where: {
      loan: {
        borrowerId,
        repaymentStatus: 'Unpaid'
      },
      disbursementStatus: {
        in: ['PENDING', 'SENT']
      },
      ...(options?.excludeLoanId ? { loanId: { not: options.excludeLoanId } } : {})
    },
    select: { id: true, disbursementStatus: true, loanId: true }
  });

  if (pendingDisbursement) {
    const result = {
      isEligible: false,
      reason: 'Borrower has a pending disbursement transaction.',
      activeFinancing: { type: 'PENDING_DISBURSEMENT' as const, id: pendingDisbursement.id, status: pendingDisbursement.disbursementStatus }
    };
    if (actorId) {
      await logBlockedAttempt(actorId, borrowerId, result.reason, { disbursementTransactionId: pendingDisbursement.id, loanId: pendingDisbursement.loanId });
    }
    return result;
  }

  // 5. Check for Active Loan Applications (Standard Loans)
  // This catches standard loan requests that haven't become a Loan record yet.
  const activeApplication = await prisma.loanApplication.findFirst({
    where: {
      borrowerId,
      status: {
        in: ['PENDING_REVIEW', 'APPROVED', 'PENDING_DOCUMENTS']
      },
      // Exclude applications that are linked to orders (covered by Step 3)
      orders: {
        none: {}
      }
    },
    select: { id: true, status: true }
  });

  if (activeApplication) {
    const result = {
      isEligible: false,
      reason: 'Borrower already has an active loan application in progress.',
      activeFinancing: { type: 'LOAN' as any, id: activeApplication.id, status: activeApplication.status }
    };
    if (actorId) {
      await logBlockedAttempt(actorId, borrowerId, result.reason, { loanApplicationId: activeApplication.id });
    }
    return result;
  }

  return { isEligible: true };
}

/**
 * Quick check if a borrower has any active financing.
 */
export async function hasActiveFinancing(borrowerId: string): Promise<boolean> {
  const result = await validateBorrowerEligibility(borrowerId);
  return !result.isEligible;
}

/**
 * Helper to log blocked financing attempts
 */
async function logBlockedAttempt(actorId: string, borrowerId: string, reason: string, details?: any) {
  try {
    await createAuditLog({
      actorId,
      action: 'FINANCING_ATTEMPT_BLOCKED',
      entity: 'BORROWER',
      entityId: borrowerId,
      details: {
        reason,
        ...details
      }
    });
  } catch (error) {
    console.error('Failed to log blocked attempt:', error);
  }
}
