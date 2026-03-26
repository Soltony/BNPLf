import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/user';
import { createAuditLog } from '@/lib/audit-log';

export async function GET() {
  const user = await getUserFromSession();
  if (!user) return NextResponse.json({ error: 'Not authorized' }, { status: 403 });

  try {
    const locations = await prisma.stockLocation.findMany({
      include: { branch: true },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(locations);
  } catch (error) {
    console.error('Error fetching locations:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const user = await getUserFromSession();
  if (!user || !user.permissions?.['branch']?.create) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
  }

  try {
    const { name, address, contactInfo, branchId, status } = await req.json();
    if (!name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 });

    const location = await prisma.stockLocation.create({
      data: { name: name.trim(), address: address || null, contactInfo: contactInfo || null, branchId: branchId || null, status: status || 'ACTIVE' },
    });

    await createAuditLog({ actorId: user.id, action: 'CREATE_STOCK_LOCATION', entity: 'StockLocation', entityId: location.id, details: JSON.stringify({ name }) });
    return NextResponse.json(location, { status: 201 });
  } catch (error) {
    console.error('Error creating location:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const user = await getUserFromSession();
  if (!user || !user.permissions?.['branch']?.update) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
  }

  try {
    const { id, name, address, contactInfo, branchId, status } = await req.json();
    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });

    const updated = await prisma.stockLocation.update({
      where: { id },
      data: {
        ...(name && { name }),
        address: address ?? undefined,
        contactInfo: contactInfo ?? undefined,
        branchId: branchId !== undefined ? (branchId || null) : undefined,
        ...(status && { status }),
      },
    });

    await createAuditLog({ actorId: user.id, action: 'UPDATE_STOCK_LOCATION', entity: 'StockLocation', entityId: id });
    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating location:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const user = await getUserFromSession();
  if (!user || !user.permissions?.['branch']?.delete) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });

    await prisma.stockLocation.delete({ where: { id } });
    await createAuditLog({ actorId: user.id, action: 'DELETE_STOCK_LOCATION', entity: 'StockLocation', entityId: id });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting location:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
