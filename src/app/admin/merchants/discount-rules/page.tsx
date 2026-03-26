'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useRequirePermission } from '@/hooks/use-require-permission';
import { PlusCircle } from 'lucide-react';

export default function DiscountRulesPage() {
  useRequirePermission('merchants');
  const { toast } = useToast();
  const [rules, setRules] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  const [type, setType] = useState<string>('PERCENTAGE');
  const [value, setValue] = useState('');
  const [minQty, setMinQty] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [itemId, setItemId] = useState('');
  const [categoryId, setCategoryId] = useState('');

  const load = () => {
    fetch('/api/merchants/discount-rules').then(r => r.json()).then(setRules);
    fetch('/api/merchants/items').then(r => r.json()).then(setItems);
    fetch('/api/merchants/categories').then(r => r.json()).then(setCategories);
  };
  useEffect(() => { load(); }, []);

  const resetForm = () => {
    setType('PERCENTAGE'); setValue(''); setMinQty('');
    setStartDate(''); setEndDate(''); setItemId(''); setCategoryId(''); setEditId(null);
  };

  const openEdit = (r: any) => {
    setEditId(r.id); setType(r.type); setValue(String(r.value));
    setMinQty(r.minQuantity ? String(r.minQuantity) : '');
    setStartDate(r.startDate?.slice(0, 10) || '');
    setEndDate(r.endDate?.slice(0, 10) || '');
    setItemId(r.itemId || ''); setCategoryId(r.categoryId || '');
    setOpen(true);
  };

  const handleSave = async () => {
    try {
      const body: any = { type, value, name: `${type}-${value}` };
      if (minQty) body.minQuantity = parseInt(minQty);
      if (startDate) body.startDate = startDate;
      if (endDate) body.endDate = endDate;
      if (itemId) body.itemId = itemId;
      if (categoryId) body.categoryId = categoryId;
      if (editId) body.id = editId;

      const res = await fetch('/api/merchants/discount-rules', {
        method: editId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.error); }
      toast({ title: editId ? 'Updated' : 'Created' });
      resetForm(); setOpen(false); load();
    } catch (e: any) { toast({ title: 'Error', description: e.message, variant: 'destructive' }); }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch('/api/merchants/discount-rules', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
      if (!res.ok) throw new Error('Delete failed');
      toast({ title: 'Deleted' }); load();
    } catch (e: any) { toast({ title: 'Error', description: e.message, variant: 'destructive' }); }
  };

  const fmtDate = (d: string | null) => d ? d.slice(0, 10) : '-';

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Discount Rules</h2>
        <p className="text-muted-foreground">Define reusable discount rules for items and categories.</p>
      </div>
      <Card>
        <CardContent className="pt-6">
          <div className="flex justify-end mb-4">
            <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
              <DialogTrigger asChild>
                <Button className="bg-amber-500 hover:bg-amber-600">
                  <PlusCircle className="h-4 w-4 mr-2" />
                  Add Rule
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader><DialogTitle>{editId ? 'Edit' : 'Add'} Discount Rule</DialogTitle></DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Type</Label>
                      <Select value={type} onValueChange={setType}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="PERCENTAGE">Percentage</SelectItem>
                          <SelectItem value="FIXED">Fixed Amount</SelectItem>
                          <SelectItem value="BUY_X_GET_Y">Buy X Get Y</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div><Label>Value</Label><Input type="number" value={value} onChange={e => setValue(e.target.value)} placeholder={type === 'PERCENTAGE' ? '10' : '100'} /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><Label>Start Date</Label><Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} /></div>
                    <div><Label>End Date</Label><Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Item (optional)</Label>
                      <Select value={itemId || '_none'} onValueChange={v => setItemId(v === '_none' ? '' : v)}>
                        <SelectTrigger><SelectValue placeholder="All items" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="_none">All items</SelectItem>
                          {items.map((it: any) => <SelectItem key={it.id} value={it.id}>{it.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Category (optional)</Label>
                      <Select value={categoryId || '_none'} onValueChange={v => setCategoryId(v === '_none' ? '' : v)}>
                        <SelectTrigger><SelectValue placeholder="All categories" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="_none">All categories</SelectItem>
                          {categories.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div><Label>Min Quantity (optional)</Label><Input type="number" value={minQty} onChange={e => setMinQty(e.target.value)} /></div>
                </div>
                <DialogFooter>
                  <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                  <Button className="bg-amber-500 hover:bg-amber-600" onClick={handleSave}>Save</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Value</TableHead>
                <TableHead>Start</TableHead>
                <TableHead>End</TableHead>
                <TableHead>Item</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Min Qty</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No discount rules.</TableCell></TableRow>}
              {rules.map(r => (
                <TableRow key={r.id}>
                  <TableCell><Badge variant="outline" className="font-normal">{r.type?.toLowerCase()}</Badge></TableCell>
                  <TableCell>{r.value}</TableCell>
                  <TableCell>{fmtDate(r.startDate)}</TableCell>
                  <TableCell>{fmtDate(r.endDate)}</TableCell>
                  <TableCell>{r.item?.name || '-'}</TableCell>
                  <TableCell>{r.category?.name || '-'}</TableCell>
                  <TableCell>{r.minQuantity || '-'}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => openEdit(r)}>Edit</Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild><Button variant="destructive" size="sm">Delete</Button></AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader><AlertDialogTitle>Delete discount rule?</AlertDialogTitle><AlertDialogDescription>This will permanently remove this discount rule.</AlertDialogDescription></AlertDialogHeader>
                          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => handleDelete(r.id)}>Delete</AlertDialogAction></AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
