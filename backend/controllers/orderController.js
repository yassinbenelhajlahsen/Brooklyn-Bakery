import { prisma } from '../lib/prisma.js';
import { httpError } from '../lib/httpError.js';
import { placeOrder } from '../services/orderService.js';
import { transition } from '../services/orderStateMachine.js';
import { snapshotAddress } from '../lib/address.js';
import { parsePagination } from '../lib/pagination.js';

export async function createOrder(req, res, next) {
    try {
        const { addressId } = req.body ?? {};
        const order = await placeOrder(req.user.id, { addressId });
        res.status(201).json(order);
    } catch (err) {
        next(err);
    }
}

export async function listMyOrders(req, res, next) {
    try {
        const { take, skip } = parsePagination(req.query);
        const where = { userId: req.user.id };
        const [items, total] = await Promise.all([
            prisma.order.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                take,
                skip,
                include: {
                    items: {
                        include: { product: { select: { name: true, imageUrl: true } } },
                    },
                },
            }),
            prisma.order.count({ where }),
        ]);
        res.json({ items, total, hasMore: skip + items.length < total });
    } catch (err) {
        next(err);
    }
}

export async function userCancel(req, res, next) {
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
        next(err);
    }
}

export async function updateOrderAddress(req, res, next) {
    try {
        const { addressId } = req.body ?? {};
        if (!addressId || typeof addressId !== 'string') {
            throw httpError(400, 'addressId is required');
        }

        const updated = await prisma.$transaction(async (tx) => {
            const order = await tx.order.findUnique({
                where: { id: req.params.id },
                select: { userId: true, status: true },
            });
            if (!order) throw httpError(404, 'Order not found');
            if (order.userId !== req.user.id) throw httpError(403, 'Forbidden');
            if (order.status !== 'confirmed') {
                throw httpError(409, 'Address can only be changed while order is confirmed');
            }

            const address = await tx.address.findUnique({
                where: { id: addressId },
                select: {
                    userId: true,
                    line1: true,
                    line2: true,
                    city: true,
                    state: true,
                    postalCode: true,
                    country: true,
                },
            });
            if (!address) throw httpError(404, 'Address not found');
            if (address.userId !== req.user.id) throw httpError(403, 'Forbidden');

            return tx.order.update({
                where: { id: req.params.id },
                data: snapshotAddress(address),
                include: {
                    items: {
                        include: { product: { select: { name: true, imageUrl: true } } },
                    },
                },
            });
        });

        res.json(updated);
    } catch (err) {
        next(err);
    }
}

export async function userReturn(req, res, next) {
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
        next(err);
    }
}
