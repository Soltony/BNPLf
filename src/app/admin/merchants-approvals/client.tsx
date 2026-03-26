'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useRequirePermission } from '@/hooks/use-require-permission';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { Eye, Check, X, Loader2 } from 'lucide-react';

interface ChangeRow {
  id: string;
  entityType: string;
  entityId: string | null;
  changeType: string;
  payload: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  createdBy: { id: string; fullName: string | null; email: string | null } | null;
}

export function MerchantApprovalsClient({ changes: initial }: { changes: ChangeRow[] }) {
  useRequirePermission('merchants-approvals');
  const { toast } = useToast();
  const router = useRouter();
  const [changes, setChanges] = useState(initial);
  const [detail, setDetail] = useState<ChangeRow | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const handleAction = async (changeId: string, approved: boolean) => {
    setProcessingId(changeId);
    try {
      const res = await fetch('/api/approvals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ changeId, approved }),
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Failed'); }
      toast({ title: approved ? 'Approved' : 'Rejected' });
      setChanges(prev => prev.filter(c => c.id !== changeId));
      router.refresh();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally { setProcessingId(null); }
  };

  const fmtDate = (d: string) => new Date(d).toLocaleDateString();

  const getPayloadSummary = (c: ChangeRow) => {
    try {
      const p = JSON.parse(c.payload);
      return p?.created?.name || p?.updated?.name || p?.name || '—';
    } catch { return '—'; }
  };

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <h2 className="text-3xl font-bold tracking-tight">Merchant Pending Approvals</h2>
      <Card>
        <CardHeader>
          <CardTitle>Change Requests</CardTitle>
          <CardDescription>Review and approve or reject merchant changes.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Action</TableHead>
                <TableHead>Merchant</TableHead>
                <TableHead>Requested By</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {changes.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">No pending approvals.</TableCell></TableRow>
              )}
              {changes.map(c => (
                <TableRow key={c.id}>
                  <TableCell><Badge variant="outline">{c.changeType}</Badge></TableCell>
                  <TableCell className="font-medium">{getPayloadSummary(c)}</TableCell>
                  <TableCell>{c.createdBy?.fullName || c.createdBy?.email || '—'}</TableCell>
                  <TableCell>{fmtDate(c.createdAt)}</TableCell>
                  <TableCell><Badge>{c.status}</Badge></TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => setDetail(c)} title="View details">
                        <Eye className="h-4 w-4" />
                      </Button>
                      {c.status === 'PENDING' && (
                        <>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" title="Approve" disabled={processingId === c.id}>
                                {processingId === c.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4 text-green-600" />}
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader><AlertDialogTitle>Approve this change?</AlertDialogTitle><AlertDialogDescription>This merchant change will be applied.</AlertDialogDescription></AlertDialogHeader>
                              <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => handleAction(c.id, true)}>Approve</AlertDialogAction></AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" title="Reject" disabled={processingId === c.id}>
                                <X className="h-4 w-4 text-destructive" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader><AlertDialogTitle>Reject this change?</AlertDialogTitle><AlertDialogDescription>This merchant change will be discarded.</AlertDialogDescription></AlertDialogHeader>
                              <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => handleAction(c.id, false)} className="bg-destructive text-destructive-foreground">Reject</AlertDialogAction></AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!detail} onOpenChange={() => setDetail(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Change Detail</DialogTitle></DialogHeader>
          {detail && (
            <div className="space-y-3 text-sm">
              <div><span className="text-muted-foreground">Entity:</span> {detail.entityType}</div>
              <div><span className="text-muted-foreground">Action:</span> {detail.changeType}</div>
              <div><span className="text-muted-foreground">Status:</span> <Badge>{detail.status}</Badge></div>
              <div><span className="text-muted-foreground">Requested:</span> {fmtDate(detail.createdAt)}</div>
              <div>
                <span className="text-muted-foreground">Payload:</span>
                <pre className="bg-muted p-3 rounded mt-1 text-xs overflow-auto max-h-60">
                  {JSON.stringify(JSON.parse(detail.payload), null, 2)}
                </pre>
              </div>
            </div>
          )}
          <DialogFooter><DialogClose asChild><Button variant="outline">Close</Button></DialogClose></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
