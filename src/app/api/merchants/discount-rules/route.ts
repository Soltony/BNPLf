import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/user';
import { createAuditLog } from '@/lib/audit-log';

export async function GET() {
  const user = await getUserFromSession();
  if (!user) return NextResponse.json({ error: 'Not authorized' }, { status: 403 });

  try {
    const rules = await prisma.discountRule.findMany({
      include: { item: { select: { id: true, name: true } }, category: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(rules);
  } catch (error) {
    console.error('Error fetching discount rules:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const user = await getUserFromSession();
  if (!user || !user.permissions?.['merchants']?.create) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { name, type, value, buyX, getY, itemId, categoryId, minQuantity, startDate, endDate, status } = body;
    if (!name || !type) return NextResponse.json({ error: 'Name and type are required' }, { status: 400 });

    const rule = await prisma.discountRule.create({
      data: {
        name,
        type,
        value: parseFloat(value || '0'),
        buyX: buyX ? parseInt(buyX) : null,
        getY: getY ? parseInt(getY) : null,
        itemId: itemId || null,
        categoryId: categoryId || null,
        minQuantity: minQuantity ? parseInt(minQuantity) : 1,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        status: status || 'ACTIVE',
      },
      include: { item: { select: { id: true, name: true } }, category: { select: { id: true, name: true } } },
    });

    await createAuditLog({ actorId: user.id, action: 'CREATE_DISCOUNT_RULE', entity: 'DiscountRule', entityId: rule.id, details: JSON.stringify({ name, type }) });
    return NextResponse.json(rule, { status: 201 });
  } catch (error) {
    console.error('Error creating discount rule:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const user = await getUserFromSession();
  if (!user || !user.permissions?.['merchants']?.update) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { id, name, type, value, buyX, getY, itemId, categoryId, minQuantity, startDate, endDate, status } = body;
    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });

    const updated = await prisma.discountRule.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(type && { type }),
        ...(value != null && { value: parseFloat(value) }),
        buyX: buyX !== undefined ? (buyX ? parseInt(buyX) : null) : undefined,
        getY: getY !== undefined ? (getY ? parseInt(getY) : null) : undefined,
        itemId: itemId !== undefined ? (itemId || null) : undefined,
        categoryId: categoryId !== undefined ? (categoryId || null) : undefined,
        ...(minQuantity != null && { minQuantity: parseInt(minQuantity) }),
        startDate: startDate !== undefined ? (startDate ? new Date(startDate) : null) : undefined,
        endDate: endDate !== undefined ? (endDate ? new Date(endDate) : null) : undefined,
        ...(status && { status }),
      },
      include: { item: { select: { id: true, name: true } }, category: { select: { id: true, name: true } } },
    });

    await createAuditLog({ actorId: user.id, action: 'UPDATE_DISCOUNT_RULE', entity: 'DiscountRule', entityId: id });
    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating discount rule:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const user = await getUserFromSession();
  if (!user || !user.permissions?.['merchants']?.delete) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });

    await prisma.discountRule.delete({ where: { id } });
    await createAuditLog({ actorId: user.id, action: 'DELETE_DISCOUNT_RULE', entity: 'DiscountRule', entityId: id });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting discount rule:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
