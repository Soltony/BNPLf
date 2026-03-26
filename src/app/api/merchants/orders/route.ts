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
    if (user.merchantId) where.merchantId = user.merchantId;

    const orders = await prisma.order.findMany({
      where,
      include: {
        merchant: true,
        orderItems: {
          include: {
            item: true,
            variant: true,
            optionSelections: { include: { optionValue: { include: { group: true } } } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(orders);
  } catch (error) {
    console.error('Error fetching orders:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const user = await getUserFromSession();
  if (!user || !user.permissions?.['orders']?.update) {
    // Also allow merchants to update their orders
    if (!user?.permissions?.['merchants']?.update) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }
  }

  try {
    const { id, status, cancelReason } = await req.json();
    if (!id || !status) return NextResponse.json({ error: 'ID and status are required' }, { status: 400 });

    const validStatuses = ['PENDING_MERCHANT_CONFIRMATION', 'ON_DELIVERY', 'DELIVERED', 'CANCELLED'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    const order = await prisma.order.findUnique({ where: { id } });
    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

    // Prevent cancelling delivered orders
    if (status === 'CANCELLED' && order.status === 'DELIVERED') {
      return NextResponse.json({ error: 'Cannot cancel a delivered order' }, { status: 400 });
    }

    const updateData: any = { status };
    if (status === 'CANCELLED') {
      updateData.cancelReason = cancelReason || 'Item not available';
      updateData.cancelledBy = 'MERCHANT';
    }

    const updated = await prisma.order.update({
      where: { id },
      data: updateData,
      include: { merchant: true, orderItems: { include: { item: true } } },
    });

    // If cancelling, also cancel the linked loan application
    if (status === 'CANCELLED' && order.loanApplicationId) {
      await prisma.loanApplication.update({
        where: { id: order.loanApplicationId },
        data: { status: 'CANCELLED' },
      }).catch(() => {});
    }

    await createAuditLog({ actorId: user.id, action: 'UPDATE_ORDER_STATUS', entity: 'Order', entityId: id, details: JSON.stringify({ status, cancelReason }) });
    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating order:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
