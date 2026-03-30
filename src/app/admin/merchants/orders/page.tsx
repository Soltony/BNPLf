'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useRequirePermission } from '@/hooks/use-require-permission';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const statusColor: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  PENDING_MERCHANT_CONFIRMATION: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  ON_DELIVERY: 'bg-amber-100 text-amber-800 border-amber-300',
  CONFIRMED: 'bg-blue-100 text-blue-800 border-blue-300',
  SHIPPED: 'bg-purple-100 text-purple-800 border-purple-300',
  DELIVERED: 'bg-green-100 text-green-800 border-green-300',
  CANCELLED: 'bg-red-100 text-red-800 border-red-300',
};

export default function MerchantOrdersPage() {
  useRequirePermission('merchants');
  const { toast } = useToast();
  const [orders, setOrders] = useState<any[]>([]);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelOrderId, setCancelOrderId] = useState<string | null>(null);
  const [cancelReasonType, setCancelReasonType] = useState('Item not available');
  const [cancelReasonCustom, setCancelReasonCustom] = useState('');
  const [cancelling, setCancelling] = useState(false);

  const load = () => { fetch('/api/merchants/orders').then(r => r.json()).then(data => setOrders(Array.isArray(data) ? data : [])); };
  useEffect(() => { load(); }, []);

  const confirm = async (orderId: string) => {
    try {
      const res = await fetch('/api/merchants/orders', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: orderId, status: 'ON_DELIVERY' }),
      });
      if (!res.ok) throw new Error('Failed');
      toast({ title: 'Updated', description: 'Order moved to ON_DELIVERY.' }); load();
    } catch (e: any) { toast({ title: 'Error', description: e.message, variant: 'destructive' }); }
  };

  const openCancelDialog = (orderId: string) => {
    setCancelOrderId(orderId);
    setCancelReasonType('Item not available');
    setCancelReasonCustom('');
    setCancelDialogOpen(true);
  };

  const cancelOrder = async () => {
    if (!cancelOrderId) return;
    setCancelling(true);
    const reason = cancelReasonType === 'Other' ? cancelReasonCustom : cancelReasonType;
    try {
      const res = await fetch('/api/merchants/orders', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: cancelOrderId, status: 'CANCELLED', cancelReason: reason || 'Item not available' }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to cancel order');
      }
      toast({ title: 'Order cancelled', description: 'The borrower will be notified that the order is cancelled.' });
      setCancelDialogOpen(false);
      load();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setCancelling(false);
    }
  };

  const fmtDateTime = (d: string) => {
    const dt = new Date(d);
    return `${dt.toLocaleDateString()}, ${dt.toLocaleTimeString()}`;
  };
  const fmtCurr = (v: number) => new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Orders</h2>
        <p className="text-muted-foreground">Manage merchant orders.</p>
      </div>
      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order</TableHead>
                <TableHead>Order Date</TableHead>
                <TableHead>Item(s)</TableHead>
                <TableHead>Attributes</TableHead>
                <TableHead>Borrower</TableHead>
                <TableHead>Merchant</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.length === 0 && <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-8">No orders yet.</TableCell></TableRow>}
              {orders.map(o => (
                <TableRow key={o.id}>
                  <TableCell className="font-mono text-xs text-muted-foreground">{o.id}</TableCell>
                  <TableCell className="text-sm whitespace-nowrap">{fmtDateTime(o.createdAt)}</TableCell>
                  <TableCell>
                    {o.orderItems?.map((it: any) => (
                      <div key={it.id} className="text-sm">{it.item?.name}</div>
                    ))}
                  </TableCell>
                  <TableCell>
                    {o.orderItems?.map((it: any) => (
                      <div key={it.id} className="text-sm">
                        {it.optionSelections?.map((sel: any, i: number) => (
                          <span key={sel.id}>
                            {sel.optionValue?.group?.name}: {sel.optionValue?.label}
                            {i < (it.optionSelections?.length || 0) - 1 ? ', ' : ''}
                          </span>
                        ))}
                      </div>
                    ))}
                  </TableCell>
                  <TableCell className="text-sm">{o.borrowerId}</TableCell>
                  <TableCell className="text-sm">{o.merchant?.name}</TableCell>
                  <TableCell className="text-sm font-medium whitespace-nowrap">{fmtCurr(o.totalAmount)} ETB</TableCell>
                  <TableCell>
                    <Badge className={o.paymentType === 'DIRECT' ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-amber-100 text-amber-800 border-amber-300'} variant="outline">
                      {o.paymentType === 'DIRECT' ? 'Direct' : 'BNPL'}
                    </Badge>
                  </TableCell>
                  <TableCell><Badge className={statusColor[o.status] || ''} variant="outline">{o.status}</Badge></TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => confirm(o.id)}
                        className="whitespace-nowrap"
                        disabled={o.status === 'ON_DELIVERY' || o.status === 'DELIVERED' || o.status === 'CANCELLED'}
                      >
                        Confirm availability
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openCancelDialog(o.id)}
                        className="whitespace-nowrap text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                        disabled={o.status === 'DELIVERED' || o.status === 'CANCELLED'}
                      >
                        Cancel
                      </Button>
                    </div>
                    {o.status === 'CANCELLED' && o.cancelReason && (
                      <p className="text-xs text-red-500 mt-1">Reason: {o.cancelReason}</p>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Cancel order dialog */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Order</DialogTitle>
            <DialogDescription>
              This will cancel the order and notify the borrower. The linked loan application will also be cancelled.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Reason for cancellation</label>
              <Select value={cancelReasonType} onValueChange={setCancelReasonType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Item not available">Item not available</SelectItem>
                  <SelectItem value="Out of stock">Out of stock</SelectItem>
                  <SelectItem value="Item discontinued">Item discontinued</SelectItem>
                  <SelectItem value="Price changed">Price changed</SelectItem>
                  <SelectItem value="Other">Other (custom reason)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {cancelReasonType === 'Other' && (
              <Textarea
                placeholder="Enter custom reason..."
                value={cancelReasonCustom}
                onChange={(e) => setCancelReasonCustom(e.target.value)}
                rows={3}
              />
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setCancelDialogOpen(false)} disabled={cancelling}>
              Go Back
            </Button>
            <Button
              variant="destructive"
              onClick={cancelOrder}
              disabled={cancelling || (cancelReasonType === 'Other' && !cancelReasonCustom.trim())}
            >
              {cancelling ? 'Cancelling...' : 'Cancel Order'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}