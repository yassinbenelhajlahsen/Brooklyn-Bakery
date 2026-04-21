import { prisma } from '../lib/prisma.js';
import { sendHttpError } from '../lib/httpError.js';
import { cancelOrderById } from '../services/orderService.js';

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
    try {
        const updated = await cancelOrderById(req.params.id);
        res.json(updated);
    } catch (err) {
        if (err.http) return sendHttpError(res, err);
        console.error('cancelOrder failed:', err);
        res.status(500).json({ error: 'Cancel failed' });
    }
}
