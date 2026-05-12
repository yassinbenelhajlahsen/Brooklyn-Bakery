import { prisma } from '../lib/prisma.js';
import { httpError } from '../lib/httpError.js';
import { transition } from '../services/orderStateMachine.js';
import { parsePagination } from '../lib/pagination.js';

const STATUS_VALUES = new Set([
    'confirmed', 'processing', 'shipped', 'delivered',
    'cancel_requested', 'cancelled', 'return_requested', 'returned',
]);

export async function listAllOrders(req, res, next) {
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
                    promoCode: { select: { code: true, scope: true, productType: true, product: { select: { name: true } } } },
                    items: { include: { product: { select: { name: true, imageUrl: true } } } },
                },
            }),
            prisma.order.count({ where }),
        ]);

        res.json({ items, total, hasMore: skip + items.length < total });
    } catch (err) {
        next(err);
    }
}

export async function getOrder(req, res) {
    const order = await prisma.order.findUnique({
        where: { id: req.params.id },
        include: {
            user: { select: { id: true, displayName: true, balance: true } },
            promoCode: { select: { code: true, scope: true, productType: true, product: { select: { name: true } } } },
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

export async function transitionOrder(req, res, next) {
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
        next(err);
    }
}
