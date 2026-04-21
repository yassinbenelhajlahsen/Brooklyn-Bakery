import { prisma } from '../lib/prisma.js';
import { sendHttpError } from '../lib/httpError.js';
import { placeOrder } from '../services/orderService.js';

export async function createOrder(req, res) {
    try {
        const order = await placeOrder(req.user.id);
        res.status(201).json(order);
    } catch (err) {
        if (err.http) return sendHttpError(res, err);
        console.error('createOrder failed:', err);
        res.status(500).json({ error: 'Order creation failed' });
    }
}

export async function listMyOrders(req, res) {
    const orders = await prisma.order.findMany({
        where: { userId: req.user.id },
        orderBy: { createdAt: 'desc' },
        include: {
            items: {
                include: { product: { select: { name: true, imageUrl: true } } },
            },
        },
    });
    res.json({ orders });
}
