import { prisma } from '../lib/prisma.js';
import { sendHttpError, httpError } from '../lib/httpError.js';
import { transition } from '../services/orderStateMachine.js';
import { parsePagination } from '../lib/pagination.js';

const STATUS_VALUES = new Set([
    'confirmed', 'processing', 'shipped', 'delivered',
    'cancel_requested', 'cancelled', 'return_requested', 'returned',
]);

export async function listAllOrders(req, res) {
    try {
        const { status } = req.query;
        if (status && !STATUS_VALUES.has(status)) {
            return res.status(400).json({ error: 'Invalid status filter' });
        }
        const { take, skip } = parsePagination(req.query);
        const where = status ? { status } : undefined;

        const [items, total] = await Promise.all([
            prisma.order.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                take,
                skip,
                include: {
                    user: { select: { id: true, displayName: true } },
                    items: { include: { product: { select: { name: true, imageUrl: true } } } },
                },
            }),
            prisma.order.count({ where }),
        ]);

        res.json({ items, total, hasMore: skip + items.length < total });
    } catch (err) {
        if (err.http) return sendHttpError(res, err);
        console.error('listAllOrders failed:', err);
        res.status(500).json({ error: 'Failed to load orders' });
    }
}

export async function getOrder(req, res) {
    const order = await prisma.order.findUnique({
        where: { id: req.params.id },
        include: {
            user: { select: { id: true, displayName: true, balance: true } },
            items: { include: { product: { select: { name: true, imageUrl: true } } } },
        },
    });
    if (!order) return res.status(404).json({ error: 'Order not found' });
    res.json(order);
}

const ADMIN_ACTIONS = new Set([
    'setProcessing', 'setShipped', 'setDelivered',
    'approveCancel', 'denyCancel',
    'approveReturn', 'denyReturn',
    'forceCancel', 'forceReturn',
]);

export async function transitionOrder(req, res) {
    try {
        const { action, reason } = req.body || {};
        if (!ADMIN_ACTIONS.has(action)) {
            throw httpError(400, 'Unknown admin action');
        }
        const updated = await transition({
            orderId: req.params.id,
            action,
            actor: 'admin',
            reason,
        });
        res.json(updated);
    } catch (err) {
        if (err.http) return sendHttpError(res, err);
        console.error('transitionOrder failed:', err);
        res.status(500).json({ error: 'Transition failed' });
    }
}
