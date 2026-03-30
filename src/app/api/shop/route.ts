import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || '';
    const categoryId = searchParams.get('categoryId') || '';
    const merchantId = searchParams.get('merchantId') || '';

    const where: any = { status: 'ACTIVE', merchant: { status: 'ACTIVE' } };

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { description: { contains: search } },
        { merchant: { name: { contains: search } } },
      ];
    }
    if (categoryId) where.categoryId = categoryId;
    if (merchantId) where.merchantId = merchantId;

    const items = await prisma.item.findMany({
      where,
      include: {
        merchant: { select: { id: true, name: true } },
        category: { select: { id: true, name: true } },
        variants: { where: { status: 'ACTIVE' } },
        discountRules: {
          where: {
            status: 'ACTIVE',
            OR: [
              { startDate: null },
              { startDate: { lte: new Date() } },
            ],
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Also fetch category-level discounts
    const now = new Date();
    const categoryDiscounts = await prisma.discountRule.findMany({
      where: {
        status: 'ACTIVE',
        categoryId: { not: null },
        itemId: null,
        AND: [
          { OR: [{ startDate: null }, { startDate: { lte: now } }] },
          { OR: [{ endDate: null }, { endDate: { gte: now } }] },
        ],
      },
    });

    // Merge item-level + category-level discounts and compute best discount
    const itemsWithDiscounts = items.map(item => {
      const itemDiscounts = item.discountRules.filter(rule =>
        !rule.endDate || new Date(rule.endDate) >= now
      );
      const catDiscounts = item.categoryId
        ? categoryDiscounts.filter(r => r.categoryId === item.categoryId && r.minQuantity <= 1)
        : [];
      const allDiscounts = [...itemDiscounts, ...catDiscounts];

      // Pick the best discount (highest effective value)
      let bestDiscount: { type: string; value: number; name: string } | null = null;
      if (allDiscounts.length > 0) {
        for (const d of allDiscounts) {
          const t = d.type.toUpperCase();
          let effective = 0;
          if (t === 'PERCENTAGE') effective = (Number(item.price) * d.value) / 100;
          else if (t === 'FIXED') effective = d.value;
          if (!bestDiscount || effective > ((bestDiscount.type === 'PERCENTAGE' ? (Number(item.price) * bestDiscount.value) / 100 : bestDiscount.value))) {
            bestDiscount = { type: t, value: d.value, name: d.name };
          }
        }
      }

      const discountedPrice = bestDiscount
        ? Math.max(0, bestDiscount.type === 'PERCENTAGE'
            ? Number(item.price) - (Number(item.price) * bestDiscount.value) / 100
            : Number(item.price) - bestDiscount.value)
        : null;

      return {
        ...item,
        discountRules: allDiscounts,
        bestDiscount,
        discountedPrice,
      };
    });

    const categories = await prisma.productCategory.findMany({
      where: { status: 'ACTIVE' },
      orderBy: { name: 'asc' },
    });

    const merchants = await prisma.merchant.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true, name: true, iconUrl: true, bnplEnabled: true },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({ items: itemsWithDiscounts, categories, merchants });
  } catch (error) {
    console.error('Error fetching shop items:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
