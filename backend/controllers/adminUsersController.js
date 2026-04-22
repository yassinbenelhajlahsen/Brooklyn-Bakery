import { prisma } from '../lib/prisma.js';
import { sendHttpError, httpError } from '../lib/httpError.js';

export async function listUsers(_req, res) {
    const users = await prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
        select: {
            id: true,
            displayName: true,
            role: true,
            balance: true,
            createdAt: true,
            _count: { select: { orders: true } },
        },
    });
    const shaped = users.map((u) => ({
        id: u.id,
        displayName: u.displayName,
        role: u.role,
        balance: u.balance,
        createdAt: u.createdAt,
        orderCount: u._count.orders,
    }));
    res.json({ users: shaped });
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
        },
    });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
}

export async function updateRole(req, res) {
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
        if (err.http) return sendHttpError(res, err);
        console.error('updateRole failed:', err);
        res.status(500).json({ error: 'Role update failed' });
    }
}

export async function adjustBalance(req, res) {
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
        if (err.http) return sendHttpError(res, err);
        console.error('adjustBalance failed:', err);
        res.status(500).json({ error: 'Balance adjustment failed' });
    }
}
