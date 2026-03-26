'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, ShoppingBag } from 'lucide-react';

export default function ShopItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { toast } = useToast();
  const [item, setItem] = useState<any>(null);
  const [quantity, setQuantity] = useState(1);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch(`/api/shop/${id}`).then(r => r.json()).then(setItem);
  }, [id]);

  const fmtCurr = (v: number) => new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);

  const getActiveDiscount = () => {
    if (!item?.discountRules?.length) return null;
    return item.discountRules.find((r: any) => r.status === 'ACTIVE') || null;
  };

  const calcPrice = () => {
    if (!item) return 0;
    let base = Number(item.price);
    // Add option price deltas
    for (const groupId of Object.keys(selectedOptions)) {
      const group = item.optionGroups?.find((g: any) => g.id === groupId);
      const val = group?.values?.find((v: any) => v.id === selectedOptions[groupId]);
      if (val?.priceDelta) base += Number(val.priceDelta);
    }
    const discount = getActiveDiscount();
    if (discount) {
      if (discount.type === 'PERCENTAGE') base -= base * (discount.value / 100);
      else if (discount.type === 'FIXED') base -= discount.value;
    }
    return Math.max(0, base) * quantity;
  };

  const handleBuy = async () => {
    setLoading(true);
    try {
      const body = {
        merchantId: item.merchantId,
        items: [{
          itemId: item.id,
          quantity,
          options: Object.entries(selectedOptions).map(([groupId, valueId]) => ({ optionGroupId: groupId, optionValueId: valueId })),
        }],
      };
      const res = await fetch('/api/bnpl/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.error); }
      toast({ title: 'Order placed!', description: 'Your BNPL order has been submitted.' });
      router.push('/bnpl/orders');
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally { setLoading(false); }
  };

  if (!item) return <div className="p-8">Loading...</div>;

  const discount = getActiveDiscount();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <Button variant="ghost" onClick={() => router.push('/shop')} className="mb-6">
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Shop
        </Button>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Image */}
          <div className="relative aspect-square bg-gray-100 rounded-lg overflow-hidden">
            {item.imageUrl ? (
              <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">No Image</div>
            )}
            {discount && (
              <Badge className="absolute top-3 right-3 bg-red-500 text-white text-sm py-1 px-3">
                {discount.type === 'PERCENTAGE' ? `${discount.value}% OFF` : `${fmtCurr(discount.value)} OFF`}
              </Badge>
            )}
          </div>

          {/* Details */}
          <Card>
            <CardContent className="pt-6 space-y-6">
              <div>
                <p className="text-sm text-muted-foreground">{item.merchant?.name}</p>
                <h1 className="text-2xl font-bold">{item.name}</h1>
                {item.category && <Badge variant="outline" className="mt-2">{item.category.name}</Badge>}
              </div>

              {item.description && <p className="text-muted-foreground">{item.description}</p>}

              <div className="text-3xl font-bold text-amber-600">{fmtCurr(calcPrice())} ETB</div>

              {/* Option groups */}
              {item.optionGroups?.map((group: any) => (
                <div key={group.id}>
                  <Label className="text-sm font-medium">{group.name}</Label>
                  <Select value={selectedOptions[group.id] || ''} onValueChange={v => setSelectedOptions({ ...selectedOptions, [group.id]: v })}>
                    <SelectTrigger><SelectValue placeholder={`Select ${group.name}`} /></SelectTrigger>
                    <SelectContent>
                      {group.values?.map((v: any) => (
                        <SelectItem key={v.id} value={v.id}>
                          {v.label} {v.priceDelta ? `(+${fmtCurr(v.priceDelta)})` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}

              <div>
                <Label className="text-sm font-medium">Quantity</Label>
                <Input type="number" min={1} value={quantity} onChange={e => setQuantity(Math.max(1, parseInt(e.target.value) || 1))} className="w-24" />
              </div>

              {item.videoUrl && (
                <div>
                  <Label className="text-sm font-medium">Product Video</Label>
                  <a href={item.videoUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline block text-sm">{item.videoUrl}</a>
                </div>
              )}

              <Button
                className="w-full bg-amber-500 hover:bg-amber-600 text-lg py-6"
                onClick={handleBuy}
                disabled={loading}
              >
                <ShoppingBag className="h-5 w-5 mr-2" />
                {loading ? 'Processing...' : 'Buy with BNPL'}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
