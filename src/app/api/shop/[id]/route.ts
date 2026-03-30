import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const item = await prisma.item.findUnique({
      where: { id, status: 'ACTIVE' },
      include: {
        merchant: { select: { id: true, name: true, status: true, bnplEnabled: true } },
        category: { select: { id: true, name: true } },
        variants: { where: { status: 'ACTIVE' }, orderBy: { createdAt: 'asc' } },
        optionGroups: { include: { values: true }, orderBy: { createdAt: 'asc' } },
        discountRules: {
          where: {
            status: 'ACTIVE',
            OR: [{ startDate: null }, { startDate: { lte: new Date() } }],
          },
        },
      },
    });

    if (!item) return NextResponse.json({ error: 'Item not found' }, { status: 404 });

    const now = new Date();
    // Filter expired item-level discount rules
    const itemDiscounts = item.discountRules.filter(r => !r.endDate || new Date(r.endDate) >= now);

    // Also fetch category-level discounts
    let catDiscounts: any[] = [];
    if (item.categoryId) {
      catDiscounts = await prisma.discountRule.findMany({
        where: {
          status: 'ACTIVE',
          categoryId: item.categoryId,
          itemId: null,
          AND: [
            { OR: [{ startDate: null }, { startDate: { lte: now } }] },
            { OR: [{ endDate: null }, { endDate: { gte: now } }] },
          ],
        },
      });
    }

    const allDiscounts = [...itemDiscounts, ...catDiscounts];

    // Pick the best discount
    let bestDiscount: { type: string; value: number; name: string } | null = null;
    for (const d of allDiscounts) {
      const t = d.type.toUpperCase();
      let effective = 0;
      if (t === 'PERCENTAGE') effective = (Number(item.price) * d.value) / 100;
      else if (t === 'FIXED') effective = d.value;
      if (!bestDiscount || effective > (bestDiscount.type === 'PERCENTAGE' ? (Number(item.price) * bestDiscount.value) / 100 : bestDiscount.value)) {
        bestDiscount = { type: t, value: d.value, name: d.name };
      }
    }

    return NextResponse.json({ ...item, discountRules: allDiscounts, bestDiscount });
  } catch (error) {
    console.error('Error fetching item:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
