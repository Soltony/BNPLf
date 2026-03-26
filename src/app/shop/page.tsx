'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Search, ShoppingBag } from 'lucide-react';

export default function ShopPage() {
  const [items, setItems] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');

  useEffect(() => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (categoryId) params.set('categoryId', categoryId);
    fetch(`/api/shop?${params}`).then(r => r.json()).then(d => {
      setItems(d.items || []);
      if (d.categories) setCategories(d.categories);
    });
  }, [search, categoryId]);

  const fmtCurr = (v: number) => new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);

  const getDiscount = (item: any) => {
    if (!item.discountRules?.length) return null;
    const active = item.discountRules.find((r: any) => r.status === 'ACTIVE');
    return active || null;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-8">
          <ShoppingBag className="h-8 w-8 text-amber-500" />
          <h1 className="text-3xl font-bold">Shop</h1>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 mb-8">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-10"
              placeholder="Search items..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <Select value={categoryId || '_all'} onValueChange={v => setCategoryId(v === '_all' ? '' : v)}>
            <SelectTrigger className="w-[200px]"><SelectValue placeholder="All categories" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">All categories</SelectItem>
              {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {items.length === 0 && (
          <div className="text-center py-20 text-muted-foreground">No items found.</div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-6">
          {items.map(item => {
            const discount = getDiscount(item);
            return (
              <Link href={`/shop/${item.id}`} key={item.id}>
                <Card className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer h-full flex flex-col">
                  <div className="relative aspect-square bg-gray-100">
                    {item.imageUrl ? (
                      <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="flex items-center justify-center h-full text-muted-foreground">No Image</div>
                    )}
                    {discount && (
                      <Badge className="absolute top-2 right-2 bg-red-500">
                        {discount.type === 'PERCENTAGE' ? `${discount.value}% OFF` : `${fmtCurr(discount.value)} OFF`}
                      </Badge>
                    )}
                  </div>
                  <CardContent className="pt-4 flex-1">
                    <p className="text-xs text-muted-foreground mb-1">{item.merchant?.name}</p>
                    <h3 className="font-semibold line-clamp-2">{item.name}</h3>
                    {item.category && <Badge variant="outline" className="mt-1 text-xs">{item.category.name}</Badge>}
                  </CardContent>
                  <CardFooter className="pt-0 flex items-center justify-between">
                    <div>
                      <span className="text-lg font-bold">{fmtCurr(item.price)} ETB</span>
                    </div>
                    <Button size="sm" className="bg-amber-500 hover:bg-amber-600">Buy with BNPL</Button>
                  </CardFooter>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
