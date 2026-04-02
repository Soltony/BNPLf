import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/session';

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const providerId = searchParams.get('providerId');

    if (!providerId) {
        return NextResponse.json({ error: 'Provider ID is required' }, { status: 400 });
    }

    try {
        const template = await prisma.deliveryAgreementTemplate.findFirst({
            where: { providerId, isActive: true },
            orderBy: { version: 'desc' },
        });

        return NextResponse.json(template);
    } catch (error) {
        console.error('Error fetching delivery agreement:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    const session = await getSession();
    if (!session?.userId) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    try {
        const { providerId, content } = await req.json();

        if (!providerId || !content) {
            return NextResponse.json({ error: 'Provider ID and content are required' }, { status: 400 });
        }

        const newVersion = await prisma.$transaction(async (tx) => {
            await tx.deliveryAgreementTemplate.updateMany({
                where: { providerId },
                data: { isActive: false },
            });

            const latest = await tx.deliveryAgreementTemplate.findFirst({
                where: { providerId },
                orderBy: { version: 'desc' },
            });

            const newVersionNumber = (latest?.version || 0) + 1;

            return tx.deliveryAgreementTemplate.create({
                data: {
                    providerId,
                    content,
                    version: newVersionNumber,
                    isActive: true,
                    publishedAt: new Date(),
                },
            });
        });

        return NextResponse.json(newVersion, { status: 201 });
    } catch (error) {
        console.error('Error creating delivery agreement:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
