"use client";

import { useState } from "react";
import { useRequirePermission } from "@/hooks/use-require-permission";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Check, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import type { PendingPaymentApproval } from "./page";
import type { User } from "@/lib/types";
import { usePermissions } from "@/hooks/use-permissions";

export function PaymentApprovalsClient({
  pendingChanges: initialChanges,
  currentUser,
}: {
  pendingChanges: PendingPaymentApproval[];
  currentUser: User;
}) {
  useRequirePermission("pending-payment-approvals");
  const [changes, setChanges] = useState(initialChanges);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [changeToReject, setChangeToReject] =
    useState<PendingPaymentApproval | null>(null);
  const { toast } = useToast();
  const router = useRouter();
  const { canModule } = usePermissions();
  const canProcessApprovals =
    canModule("approvals", "update") ||
    canModule("pending-payment-approvals", "update");

  const handleProcessChange = async (
    changeId: string,
    approved: boolean,
    reason?: string
  ) => {
    if (!canProcessApprovals) {
      toast({
        title: "Not authorized",
        description: "You are not authorized to approve or reject changes.",
        variant: "destructive",
      });
      return;
    }

    setProcessingId(changeId);
    try {
      const response = await fetch("/api/approvals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ changeId, approved, rejectionReason: reason }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.error ||
            `Failed to ${approved ? "approve" : "reject"} request.`
        );
      }

      setChanges((prev) => prev.filter((c) => c.id !== changeId));
      toast({
        title: "Success",
        description: `Payment request has been ${
          approved ? "approved" : "rejected"
        }.`,
      });

      if (approved) {
        router.refresh();
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setProcessingId(null);
      setChangeToReject(null);
      setRejectionReason("");
    }
  };

  return (
    <>
      <div className="flex-1 space-y-4 p-8 pt-6">
        <h2 className="text-3xl font-bold tracking-tight">
          Payment Approvals
        </h2>
        <Card>
          <CardHeader>
            <CardTitle>Mark Successful Requests</CardTitle>
            <CardDescription>
              Review and approve or reject pending payment mark-as-successful
              requests.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Request</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Requested By</TableHead>
                  <TableHead>Requested At</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {changes.length > 0 ? (
                  changes.map((change) => (
                    <TableRow key={change.id}>
                      <TableCell className="font-medium">
                        <div>Mark Successful</div>
                        <div className="text-sm text-muted-foreground">
                          {change.entityName}
                        </div>
                        {change.providerName && (
                          <div className="text-xs text-muted-foreground">
                            ({change.providerName})
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="default">Payment</Badge>
                      </TableCell>
                      <TableCell>
                        {change.createdBy?.fullName || "Unknown User"}
                      </TableCell>
                      <TableCell>
                        {formatDistanceToNow(new Date(change.createdAt), {
                          addSuffix: true,
                        })}
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        {canProcessApprovals && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                handleProcessChange(change.id, true)
                              }
                              disabled={
                                processingId === change.id ||
                                change.createdById === currentUser.id
                              }
                              className="text-green-600 border-green-600 hover:bg-green-50 hover:text-green-700"
                            >
                              {processingId === change.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Check className="h-4 w-4" />
                              )}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setChangeToReject(change)}
                              disabled={
                                processingId === change.id ||
                                change.createdById === currentUser.id
                              }
                              className="text-red-600 border-red-600 hover:bg-red-50 hover:text-red-700"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center">
                      No pending payment approvals.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Dialog
        open={!!changeToReject}
        onOpenChange={() => setChangeToReject(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Payment Request</DialogTitle>
            <DialogDescription>
              Please provide a reason for rejecting this payment request.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="e.g., Invalid FT reference..."
              disabled={!canProcessApprovals}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setChangeToReject(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() =>
                handleProcessChange(changeToReject!.id, false, rejectionReason)
              }
              disabled={!canProcessApprovals || !rejectionReason.trim()}
            >
              Confirm Rejection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
