import { prisma } from '../lib/prisma.js';
import { httpError } from '../lib/httpError.js';
import { parsePagination } from '../lib/pagination.js';

export async function listUsers(req, res, next) {
    try {
        const { take, skip } = parsePagination(req.query);
        const [rawItems, total] = await Promise.all([
            prisma.user.findMany({
                orderBy: { createdAt: 'desc' },
                take,
                skip,
                select: {
                    id: true,
                    displayName: true,
                    role: true,
                    balance: true,
                    createdAt: true,
                    _count: { select: { orders: true } },
                },
            }),
            prisma.user.count(),
        ]);
        const items = rawItems.map((u) => ({
            id: u.id,
            displayName: u.displayName,
            role: u.role,
            balance: u.balance,
            createdAt: u.createdAt,
            orderCount: u._count.orders,
        }));
        res.json({ items, total, hasMore: skip + items.length < total });
    } catch (err) {
        next(err);
    }
}

export async function getUser(req, res) {
    const user = await prisma.user.findUnique({
        where: { id: req.params.id },
        include: {
            orders: {
                orderBy: { createdAt: 'desc' },
                include: {
                    items: { include: { product: { select: { name: true, imageUrl: true } } } },
                },
            },
            reviews: {
                orderBy: { createdAt: 'desc' },
                include: { product: { select: { name: true } } },
            },
        },
    });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
}

export async function updateRole(req, res, next) {
    try {
        const { role } = req.body || {};
        if (role !== 'customer' && role !== 'admin') {
            throw httpError(400, 'Invalid role');
        }
        if (req.user.id === req.params.id) {
            throw httpError(409, 'Admins cannot change their own role');
        }

        const updated = await prisma.$transaction(async (tx) => {
            const target = await tx.user.findUnique({
                where: { id: req.params.id },
                select: { role: true },
            });
            if (!target) throw httpError(404, 'User not found');

            const after = await tx.user.update({
                where: { id: req.params.id },
                data: { role },
                select: { id: true, displayName: true, role: true, balance: true },
            });

            const adminCount = await tx.user.count({ where: { role: 'admin' } });
            if (adminCount < 1) throw httpError(409, 'Cannot remove the last admin');

            return after;
        });

        res.json(updated);
    } catch (err) {
        next(err);
    }
}

export async function adjustBalance(req, res, next) {
    try {
        const { delta } = req.body || {};
        if (!Number.isInteger(delta) || delta === 0) {
            throw httpError(400, 'delta must be a non-zero integer');
        }

        const updated = await prisma.$transaction(async (tx) => {
            const rows = await tx.$queryRaw`
                SELECT balance FROM users WHERE id = ${req.params.id}::uuid FOR UPDATE
            `;
            if (rows.length === 0) throw httpError(404, 'User not found');
            const current = rows[0].balance;
            const next = current + delta;
            if (next < 0) throw httpError(409, 'Balance cannot go below 0');

            return tx.user.update({
                where: { id: req.params.id },
                data: { balance: next },
                select: { id: true, displayName: true, role: true, balance: true },
            });
        });

        res.json(updated);
    } catch (err) {
        next(err);
    }
}
