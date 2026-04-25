"use client";

import { useEffect, useMemo, useState } from "react";
import { useRequirePermission } from "@/hooks/use-require-permission";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
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
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type PendingPaymentRow = {
  id: string;
  transactionId: string;
  loanId: string;
  borrowerId: string;
  amount: number;
  status: string;
  createdAt: string;
  updatedAt: string;
  loan: {
    id: string;
    loanAmount: number;
    status: string;
    borrowerId: string;
    product: {
      name: string;
      provider: { id: string; name: string };
    };
  };
  borrower: {
    id: string;
    phoneNumber: string;
    phoneAccounts?: { accountNumber: string }[];
  };
  pendingApproval: {
    entityId: string;
    id: string;
    createdAt: string;
    createdById: string;
  } | null;
};

type StatusFilter = "PENDING" | "COMPLETED" | "FAILED" | "ALL";

const ITEMS_PER_PAGE = 20;

export default function PendingPaymentsPage() {
  useRequirePermission("pending-payments");

  const { toast } = useToast();
  const [rows, setRows] = useState<PendingPaymentRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("PENDING");

  // Mark Successful dialog
  const [markDialogOpen, setMarkDialogOpen] = useState(false);
  const [markingRow, setMarkingRow] = useState<PendingPaymentRow | null>(null);
  const [ftReference, setFtReference] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const query = useMemo(() => {
    const p = new URLSearchParams();
    p.set("page", String(page));
    p.set("limit", String(ITEMS_PER_PAGE));
    p.set("status", statusFilter);
    if (debouncedSearch) p.set("search", debouncedSearch);
    return p.toString();
  }, [page, statusFilter, debouncedSearch]);

  useEffect(() => {
    const fetchRows = async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/pending-payments?${query}`);
        if (!res.ok) throw new Error("Failed to fetch pending payments");
        const data = await res.json();
        setRows(data.rows || []);
        setTotalPages(data.totalPages || 1);
      } catch (e: any) {
        toast({
          title: "Error",
          description: String(e?.message ?? e),
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    void fetchRows();
  }, [query, toast]);

  const openMarkDialog = (row: PendingPaymentRow) => {
    setMarkingRow(row);
    setFtReference("");
    setMarkDialogOpen(true);
  };

  const submitMarkSuccessful = async () => {
    if (!markingRow || !ftReference.trim()) {
      toast({
        title: "Error",
        description: "Please enter a valid FT reference number.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/pending-payments/mark-successful", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pendingPaymentId: markingRow.id,
          cbsTransactionId: ftReference.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Failed to submit request");

      toast({
        title: "Submitted",
        description: "Mark successful request submitted for approval.",
      });
      setMarkDialogOpen(false);
      setMarkingRow(null);
      setFtReference("");

      // Refresh
      const refresh = await fetch(`/api/pending-payments?${query}`);
      const refreshed = await refresh.json();
      setRows(refreshed.rows || []);
      setTotalPages(refreshed.totalPages || 1);
    } catch (e: any) {
      toast({
        title: "Error",
        description: String(e?.message ?? e),
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const statusBadge = (row: PendingPaymentRow) => {
    if (row.pendingApproval) {
      return <Badge variant="outline">Pending Approval</Badge>;
    }
    switch (row.status) {
      case "PENDING":
        return <Badge className="bg-yellow-600 text-white">Pending</Badge>;
      case "COMPLETED":
        return <Badge className="bg-green-600 text-white">Completed</Badge>;
      case "FAILED":
        return <Badge className="bg-red-600 text-white">Failed</Badge>;
      default:
        return <Badge variant="secondary">{row.status}</Badge>;
    }
  };

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">
            Pending Payments
          </h2>
          <p className="text-muted-foreground">
            View pending loan repayments and mark them as successful by
            providing an FT reference number.
          </p>
        </div>
        <div className="flex items-end gap-2">
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Status</span>
            <Select
              value={statusFilter}
              onValueChange={(v) => {
                setStatusFilter(v as StatusFilter);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="COMPLETED">Completed</SelectItem>
                <SelectItem value="FAILED">Failed</SelectItem>
                <SelectItem value="ALL">All</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search by transaction ID, loan ID, or phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        {searchQuery && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSearchQuery("")}
          >
            Clear
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Pending Payments</CardTitle>
          <CardDescription>
            Payments awaiting confirmation from the payment gateway. Mark as
            successful when you have the CBS FT reference.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Borrower</TableHead>
                <TableHead>Account</TableHead>
                <TableHead>Loan</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Txn ID</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={9} className="h-24 text-center">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                  </TableCell>
                </TableRow>
              ) : rows.length ? (
                rows.map((r) => {
                  const canMark =
                    r.status === "PENDING" && !r.pendingApproval;
                  return (
                    <TableRow key={r.id}>
                      <TableCell>
                        {format(
                          new Date(r.createdAt),
                          "yyyy-MM-dd HH:mm:ss"
                        )}
                      </TableCell>
                      <TableCell>{statusBadge(r)}</TableCell>
                      <TableCell className="font-mono">
                        {r.borrower?.phoneNumber || r.borrowerId}
                      </TableCell>
                      <TableCell className="font-mono">
                        {r.borrower?.phoneAccounts?.[0]?.accountNumber || "—"}
                      </TableCell>
                      <TableCell className="font-mono">{r.loanId}</TableCell>
                      <TableCell>
                        {r.loan?.product?.name || "—"}
                      </TableCell>
                      <TableCell>
                        {r.amount.toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                        })}
                      </TableCell>
                      <TableCell className="font-mono">
                        {r.transactionId}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="secondary"
                          size="sm"
                          disabled={!canMark}
                          onClick={() => openMarkDialog(r)}
                        >
                          Mark Successful
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={9} className="h-24 text-center">
                    No pending payments found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
        <CardFooter className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
            >
              <ChevronLeft className="h-4 w-4" />
              Prev
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardFooter>
      </Card>

      {/* Mark Successful Dialog */}
      <Dialog open={markDialogOpen} onOpenChange={setMarkDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark Payment as Successful</DialogTitle>
            <DialogDescription>
              Enter the CBS FT reference number to record this repayment as
              successful. This will be submitted for approval.
            </DialogDescription>
          </DialogHeader>
          {markingRow && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="text-muted-foreground">Borrower:</div>
                <div className="font-mono">
                  {markingRow.borrower?.phoneNumber || markingRow.borrowerId}
                </div>
                <div className="text-muted-foreground">Account:</div>
                <div className="font-mono">
                  {markingRow.borrower?.phoneAccounts?.[0]?.accountNumber ||
                    "—"}
                </div>
                <div className="text-muted-foreground">Loan ID:</div>
                <div className="font-mono">{markingRow.loanId}</div>
                <div className="text-muted-foreground">Amount:</div>
                <div>
                  {markingRow.amount.toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                  })}
                </div>
                <div className="text-muted-foreground">Transaction ID:</div>
                <div className="font-mono">{markingRow.transactionId}</div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="ftReference">FT Reference Number</Label>
                <Input
                  id="ftReference"
                  placeholder="Enter the FT reference from CBS (e.g. FT...)"
                  value={ftReference}
                  onChange={(e) => setFtReference(e.target.value)}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setMarkDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={submitMarkSuccessful}
              disabled={isSubmitting || !ftReference.trim()}
            >
              {isSubmitting ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Submitting
                </span>
              ) : (
                "Submit for Approval"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
