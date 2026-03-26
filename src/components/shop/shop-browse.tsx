'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, ShoppingCart, PlayCircle, Package, Tag, SlidersHorizontal } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';

export function ShopBrowse() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const borrowerId = searchParams?.get('borrowerId') || '';

  const [items, setItems] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');

  useEffect(() => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (categoryId) params.set('categoryId', categoryId);
    fetch(`/api/shop?${params}`)
      .then((r) => r.json())
      .then((d) => {
        setItems(d.items || []);
        if (d.categories) setCategories(d.categories);
      });
  }, [search, categoryId]);

  const fmtCurr = (v: number) =>
    new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(v);

  const handleSelect = (itemId: string) => {
    const sp = new URLSearchParams();
    sp.set('borrowerId', borrowerId);
    sp.set('itemId', itemId);
    sp.set('qty', '1');
    router.push(`/loan?${sp.toString()}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100/80">
      {/* Header */}
      <div className="bg-gradient-to-r from-amber-500 to-amber-600 px-4 pt-3 pb-5 sm:pt-4 sm:pb-6 shadow-md">
        <div className="max-w-7xl mx-auto">
          {/* Top row with title and orders */}
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Shop</h1>
            <Link
              href={`/bnpl/orders?borrowerId=${borrowerId}`}
              className="inline-flex items-center gap-1.5 text-white/90 hover:text-white font-medium text-sm transition-colors"
            >
              <ShoppingCart className="h-4 w-4" />
              Orders
            </Link>
          </div>

          {/* Search bar — full width, prominent */}
          <div className="relative mb-2.5 sm:mb-3">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-gray-400" />
            <Input
              className="pl-11 pr-4 bg-white border-0 shadow-md w-full h-11 sm:h-12 rounded-xl text-sm focus:ring-2 focus:ring-white/40 placeholder:text-gray-400"
              placeholder="Search products..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Category pills */}
          <div className="flex gap-2 overflow-x-auto pb-0.5 scrollbar-none -mx-1 px-1">
            <button
              onClick={() => setCategoryId('')}
              className={`shrink-0 px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-medium transition-all ${
                !categoryId
                  ? 'bg-white text-amber-700 shadow-md'
                  : 'bg-white/20 text-white hover:bg-white/30'
              }`}
            >
              All
            </button>
            {categories.map((c) => (
              <button
                key={c.id}
                onClick={() => setCategoryId(c.id === categoryId ? '' : c.id)}
                className={`shrink-0 px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-medium transition-all ${
                  categoryId === c.id
                    ? 'bg-white text-amber-700 shadow-md'
                    : 'bg-white/20 text-white hover:bg-white/30'
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-5 sm:py-10">
        <div className="text-center mb-5 sm:mb-10">
          <h2 className="text-lg sm:text-2xl font-bold text-gray-900 tracking-tight">
            Latest Products
          </h2>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            Browse and select items for BNPL
          </p>
        </div>

        {items.length === 0 && (
          <div className="text-center py-20">
            <Package className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-muted-foreground font-medium">No items found</p>
            <p className="text-xs text-gray-400 mt-1">Try a different search or category</p>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5">
          {items.map((item) => (
            <Card
              key={item.id}
              className="group overflow-hidden border-0 shadow-sm hover:shadow-xl transition-all duration-300 rounded-xl bg-white"
            >
              {/* Image */}
              <div className="relative aspect-square bg-gradient-to-br from-gray-50 to-gray-100 overflow-hidden">
                {item.imageUrl ? (
                  <img
                    src={item.imageUrl}
                    alt={item.name}
                    className="w-full h-full object-contain p-2 group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-gray-300">
                    <Package className="h-8 w-8 sm:h-10 sm:w-10 mb-1" />
                    <span className="text-[10px] sm:text-xs">No Image</span>
                  </div>
                )}

                {/* Discount badge */}
                {item.bestDiscount && (
                  <div className="absolute top-1.5 left-1.5 sm:top-2 sm:left-2 flex items-center gap-0.5 bg-red-500 text-white text-[9px] sm:text-[10px] font-bold px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-md shadow-sm">
                    <Tag className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                    {item.bestDiscount.type === 'PERCENTAGE'
                      ? `${item.bestDiscount.value}%`
                      : `-${fmtCurr(item.bestDiscount.value)}`}
                  </div>
                )}

                {/* Video badge */}
                {item.videoUrl && (
                  <a
                    href={item.videoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="absolute top-1.5 right-1.5 sm:top-2 sm:right-2 flex items-center gap-1 text-[10px] sm:text-xs font-medium text-amber-700 bg-white/90 backdrop-blur-sm rounded-full pl-1.5 pr-2 py-0.5 sm:pl-2 sm:pr-2.5 sm:py-1 shadow-sm hover:bg-white transition-colors"
                  >
                    <PlayCircle className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                    <span className="hidden sm:inline">Video</span>
                  </a>
                )}
              </div>

              {/* Content */}
              <CardContent className="p-2.5 sm:p-4 space-y-1.5 sm:space-y-2">
                {/* Merchant badge */}
                <Badge
                  variant="secondary"
                  className="bg-amber-50 text-amber-700 border-0 text-[9px] sm:text-[10px] font-semibold px-1.5 sm:px-2 py-0 rounded-md uppercase tracking-wider"
                >
                  {item.merchant?.name}
                </Badge>

                {/* Item name */}
                <h3 className="font-semibold text-gray-900 text-xs sm:text-sm leading-tight line-clamp-2">
                  {item.name}
                </h3>

                {/* Price + Select */}
                <div className="pt-1.5 sm:pt-2 border-t border-gray-100">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[9px] sm:text-[10px] text-gray-400 font-medium uppercase tracking-wide">
                        Price
                      </p>
                      {item.bestDiscount && item.discountedPrice != null ? (
                        <div>
                          <p className="text-[10px] sm:text-xs text-gray-400 line-through">
                            {fmtCurr(item.price)} ETB
                          </p>
                          <p className="text-sm sm:text-base font-bold text-red-600">
                            {fmtCurr(item.discountedPrice)}
                            <span className="text-[9px] sm:text-[10px] font-normal text-gray-400 ml-0.5">
                              ETB
                            </span>
                          </p>
                        </div>
                      ) : (
                        <p className="text-sm sm:text-base font-bold text-gray-900">
                          {fmtCurr(item.price)}
                          <span className="text-[9px] sm:text-[10px] font-normal text-gray-400 ml-0.5">
                            ETB
                          </span>
                        </p>
                      )}
                    </div>
                    <Button
                      size="sm"
                      className="bg-amber-500 hover:bg-amber-600 text-white rounded-lg px-3 sm:px-4 h-7 sm:h-8 text-[10px] sm:text-xs font-semibold shadow-sm hover:shadow transition-all"
                      onClick={() => handleSelect(item.id)}
                    >
                      Select
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
