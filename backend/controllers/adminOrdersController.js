import { OrderStatus } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { httpError } from '../lib/httpError.js';

export async function listAllOrders(_req, res) {
    const orders = await prisma.order.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
            user: { select: { id: true, displayName: true } },
            items: {
                include: { product: { select: { name: true } } },
            },
        },
    });
    res.json({ orders });
}

export async function cancelOrder(req, res) {
    const { id } = req.params;
    try {
        const updated = await prisma.$transaction(async (tx) => {
            const order = await tx.order.findUnique({
                where: { id },
                include: { items: true },
            });
            if (!order) throw httpError(404, 'Order not found');
            if (order.status === OrderStatus.cancelled) {
                throw httpError(409, 'Already cancelled');
            }

            await tx.user.update({
                where: { id: order.userId },
                data: { balance: { increment: order.total } },
            });

            for (const item of order.items) {
                await tx.product.update({
                    where: { id: item.productId },
                    data: { stock: { increment: item.quantity } },
                });
            }

            return tx.order.update({
                where: { id },
                data: { status: OrderStatus.cancelled },
                include: { items: true },
            });
        });

        res.json(updated);
    } catch (err) {
        if (err.http) return res.status(err.http).json({ error: err.message });
        console.error('cancelOrder failed:', err);
        res.status(500).json({ error: 'Cancel failed' });
    }
}
