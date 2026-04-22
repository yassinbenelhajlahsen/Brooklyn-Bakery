import { prisma } from '../lib/prisma.js';
import { sendHttpError } from '../lib/httpError.js';
import { placeOrder } from '../services/orderService.js';
import { transition } from '../services/orderStateMachine.js';

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

export async function userCancel(req, res) {
    try {
        const order = await prisma.order.findUnique({
            where: { id: req.params.id },
            select: { userId: true, status: true },
        });
        if (!order) return res.status(404).json({ error: 'Order not found' });
        if (order.userId !== req.user.id) return res.status(403).json({ error: 'Forbidden' });

        const action = order.status === 'confirmed' ? 'cancel' : 'requestCancel';
        const updated = await transition({
            orderId: req.params.id,
            action,
            actor: 'user',
            reason: req.body?.reason,
        });
        res.json(updated);
    } catch (err) {
        if (err.http) return sendHttpError(res, err);
        console.error('userCancel failed:', err);
        res.status(500).json({ error: 'Cancel failed' });
    }
}

export async function userReturn(req, res) {
    try {
        const order = await prisma.order.findUnique({
            where: { id: req.params.id },
            select: { userId: true },
        });
        if (!order) return res.status(404).json({ error: 'Order not found' });
        if (order.userId !== req.user.id) return res.status(403).json({ error: 'Forbidden' });

        const updated = await transition({
            orderId: req.params.id,
            action: 'requestReturn',
            actor: 'user',
            reason: req.body?.reason,
        });
        res.json(updated);
    } catch (err) {
        if (err.http) return sendHttpError(res, err);
        console.error('userReturn failed:', err);
        res.status(500).json({ error: 'Return request failed' });
    }
}
