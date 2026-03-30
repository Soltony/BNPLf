'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { PlusCircle } from 'lucide-react';
import { useRequirePermission } from '@/hooks/use-require-permission';
import Link from 'next/link';

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount) + ' ETB';

export default function MerchantsPage() {
  useRequirePermission('merchants');
  const { toast } = useToast();
  const [items, setItems] = useState<any[]>([]);

  const fetchItems = useCallback(async () => {
    try {
      const res = await fetch('/api/merchants/items');
      if (res.ok) setItems(await res.json());
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/merchants/items?id=${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      toast({ title: 'Item deleted' });
      fetchItems();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Items</h2>
        <p className="text-muted-foreground">Manage merchant items.</p>
      </div>

      <div className="flex justify-end">
        <Link href="/admin/merchants/items/new">
          <Button className="bg-orange-500 hover:bg-orange-600"><PlusCircle className="mr-2 h-4 w-4" />Add Item</Button>
        </Link>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Merchant</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Price</TableHead>
            <TableHead>Selling Option</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map(item => (
            <TableRow key={item.id}>
              <TableCell className="font-medium">{item.name}</TableCell>
              <TableCell>{item.merchant?.name || '-'}</TableCell>
              <TableCell>{item.category?.name || '-'}</TableCell>
              <TableCell>{formatCurrency(item.price)}</TableCell>
              <TableCell>
                <Badge variant="outline" className={
                  item.sellingOption === 'DIRECT_ONLY' ? 'bg-emerald-50 text-emerald-700 border-emerald-300' :
                  item.sellingOption === 'BOTH' ? 'bg-blue-50 text-blue-700 border-blue-300' :
                  'bg-amber-50 text-amber-700 border-amber-300'
                }>
                  {item.sellingOption === 'DIRECT_ONLY' ? 'Direct Only' : item.sellingOption === 'BOTH' ? 'BNPL + Direct' : 'BNPL Only'}
                </Badge>
              </TableCell>
              <TableCell><Badge variant="outline">{item.status}</Badge></TableCell>
              <TableCell className="text-right space-x-2">
                <Link href={`/admin/merchants/items/${item.id}`}>
                  <Button size="sm" variant="outline">Edit</Button>
                </Link>
                <AlertDialog>
                  <AlertDialogTrigger asChild><Button size="sm" variant="destructive">Delete</Button></AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader><AlertDialogTitle>Delete {item.name}?</AlertDialogTitle><AlertDialogDescription>This will permanently delete the item and its variants.</AlertDialogDescription></AlertDialogHeader>
                    <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => handleDelete(item.id)}>Delete</AlertDialogAction></AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </TableCell>
            </TableRow>
          ))}
          {items.length === 0 && (
            <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No items found.</TableCell></TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
