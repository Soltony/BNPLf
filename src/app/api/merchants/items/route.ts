import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/user';
import { createAuditLog } from '@/lib/audit-log';

export async function GET(req: NextRequest) {
  const user = await getUserFromSession();
  if (!user) return NextResponse.json({ error: 'Not authorized' }, { status: 403 });

  try {
    const { searchParams } = new URL(req.url);
    const merchantId = searchParams.get('merchantId');
    const where: any = {};
    if (merchantId) where.merchantId = merchantId;
    // If user is a merchant user, scope to their merchant
    if (user.merchantId) where.merchantId = user.merchantId;

    const items = await prisma.item.findMany({
      where,
      include: { merchant: true, category: true, variants: true, optionGroups: { include: { values: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(items);
  } catch (error) {
    console.error('Error fetching items:', error);
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
    const { merchantId, categoryId, name, description, price, imageUrl, videoUrl, status, variants, optionGroups } = body;

    if (!merchantId || !categoryId || !name || price == null) {
      return NextResponse.json({ error: 'merchantId, categoryId, name, and price are required' }, { status: 400 });
    }

    const item = await prisma.item.create({
      data: {
        merchantId,
        categoryId,
        name,
        description: description || null,
        price: parseFloat(price),
        imageUrl: imageUrl || null,
        videoUrl: videoUrl || null,
        status: status || 'ACTIVE',
        variants: variants?.length ? {
          create: variants.map((v: any) => ({
            name: v.name,
            size: v.size || null,
            color: v.color || null,
            material: v.material || null,
            price: parseFloat(v.price),
            status: v.status || 'ACTIVE',
          })),
        } : undefined,
        optionGroups: optionGroups?.length ? {
          create: optionGroups.map((g: any) => ({
            name: g.name,
            values: g.values?.length ? {
              create: g.values.map((v: any) => ({
                label: v.label,
                priceDelta: parseFloat(v.priceDelta || '0'),
              })),
            } : undefined,
          })),
        } : undefined,
      },
      include: { merchant: true, category: true, variants: true, optionGroups: { include: { values: true } } },
    });

    await createAuditLog({ actorId: user.id, action: 'CREATE_ITEM', entity: 'Item', entityId: item.id, details: JSON.stringify({ name, merchantId }) });
    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    console.error('Error creating item:', error);
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
    const { id, merchantId, categoryId, name, description, price, imageUrl, videoUrl, status, variants, optionGroups } = body;
    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });

    // Update the item
    const updated = await prisma.item.update({
      where: { id },
      data: {
        ...(merchantId && { merchantId }),
        ...(categoryId && { categoryId }),
        ...(name && { name }),
        description: description ?? undefined,
        ...(price != null && { price: parseFloat(price) }),
        imageUrl: imageUrl ?? undefined,
        videoUrl: videoUrl ?? undefined,
        ...(status && { status }),
      },
      include: { merchant: true, category: true, variants: true, optionGroups: { include: { values: true } } },
    });

    // If variants provided, replace them
    if (variants) {
      await prisma.itemVariant.deleteMany({ where: { itemId: id } });
      if (variants.length > 0) {
        await prisma.itemVariant.createMany({
          data: variants.map((v: any) => ({
            itemId: id,
            name: v.name,
            size: v.size || null,
            color: v.color || null,
            material: v.material || null,
            price: parseFloat(v.price),
            status: v.status || 'ACTIVE',
          })),
        });
      }
    }

    // If option groups provided, replace them
    if (optionGroups) {
      await prisma.itemOptionGroup.deleteMany({ where: { itemId: id } });
      for (const g of optionGroups) {
        await prisma.itemOptionGroup.create({
          data: {
            itemId: id,
            name: g.name,
            values: g.values?.length ? {
              create: g.values.map((v: any) => ({
                label: v.label,
                priceDelta: parseFloat(v.priceDelta || '0'),
              })),
            } : undefined,
          },
        });
      }
    }

    const result = await prisma.item.findUnique({
      where: { id },
      include: { merchant: true, category: true, variants: true, optionGroups: { include: { values: true } } },
    });

    await createAuditLog({ actorId: user.id, action: 'UPDATE_ITEM', entity: 'Item', entityId: id, details: JSON.stringify({ name }) });
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error updating item:', error);
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

    await prisma.item.delete({ where: { id } });
    await createAuditLog({ actorId: user.id, action: 'DELETE_ITEM', entity: 'Item', entityId: id });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting item:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
