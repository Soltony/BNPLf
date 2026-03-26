import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/user';
import { createAuditLog } from '@/lib/audit-log';

export async function GET() {
  const user = await getUserFromSession();
  if (!user) return NextResponse.json({ error: 'Not authorized' }, { status: 403 });

  try {
    const merchants = await prisma.merchant.findMany({ orderBy: { createdAt: 'desc' } });
    return NextResponse.json(merchants);
  } catch (error) {
    console.error('Error fetching merchants:', error);
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
    const { name } = body;
    if (!name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 });

    // Create as PendingChange for maker-checker
    const pending = await prisma.pendingChange.create({
      data: {
        entityType: 'Merchant',
        changeType: 'CREATE',
        payload: JSON.stringify({ created: { name: name.trim(), status: 'ACTIVE' } }),
        createdById: user.id,
      },
    });

    await createAuditLog({
      actorId: user.id,
      action: 'CREATE_MERCHANT_REQUEST',
      entity: 'Merchant',
      details: JSON.stringify({ name }),
    });

    return NextResponse.json(pending, { status: 201 });
  } catch (error) {
    console.error('Error creating merchant:', error);
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
    const { id, name, status } = body;
    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });

    const existing = await prisma.merchant.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'Merchant not found' }, { status: 404 });

    const pending = await prisma.pendingChange.create({
      data: {
        entityType: 'Merchant',
        entityId: id,
        changeType: 'UPDATE',
        payload: JSON.stringify({
          original: existing,
          updated: { name: name ?? existing.name, status: status ?? existing.status },
        }),
        createdById: user.id,
      },
    });

    await createAuditLog({
      actorId: user.id,
      action: 'UPDATE_MERCHANT_REQUEST',
      entity: 'Merchant',
      entityId: id,
      details: JSON.stringify({ name, status }),
    });

    return NextResponse.json(pending);
  } catch (error) {
    console.error('Error updating merchant:', error);
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

    const existing = await prisma.merchant.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'Merchant not found' }, { status: 404 });

    const pending = await prisma.pendingChange.create({
      data: {
        entityType: 'Merchant',
        entityId: id,
        changeType: 'DELETE',
        payload: JSON.stringify({ original: existing }),
        createdById: user.id,
      },
    });

    await createAuditLog({
      actorId: user.id,
      action: 'DELETE_MERCHANT_REQUEST',
      entity: 'Merchant',
      entityId: id,
    });

    return NextResponse.json(pending);
  } catch (error) {
    console.error('Error deleting merchant:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
