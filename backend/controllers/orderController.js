import { OrderStatus } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { computeCartTotal } from '../lib/cart.js';
import { httpError, sendHttpError } from '../lib/httpError.js';

export async function createOrder(req, res) {
    const userId = req.user.id;

    try {
        const result = await prisma.$transaction(async (tx) => {
            const cartItems = await tx.cartItem.findMany({
                where: { userId },
                include: { product: { select: { name: true, id: true, price: true } } },
            });
            if (cartItems.length === 0) {
                throw httpError(400, 'Cart is empty');
            }

            const prices = Object.fromEntries(
                cartItems.map((ci) => [ci.product.id, ci.product.price]),
            );
            const items = cartItems.map((ci) => ({
                productId: ci.product.id,
                quantity: ci.quantity,
            }));
            const total = computeCartTotal(items, prices);

            // Row-lock the balance to serialize concurrent orders for this user.
            const rows = await tx.$queryRaw`
                SELECT balance FROM users WHERE id = ${userId}::uuid FOR UPDATE
            `;
            if (rows.length === 0) {
                throw httpError(500, 'Profile missing');
            }
            const balance = rows[0].balance;
            if (balance < total) {
                throw httpError(402, 'Insufficient balance');
            }

            await tx.user.update({
                where: { id: userId },
                data: { balance: { decrement: total } },
            });

            const order = await tx.order.create({
                data: {
                    userId,
                    total,
                    status: OrderStatus.confirmed,
                    items: {
                        create: cartItems.map((ci) => ({
                            productId: ci.product.id,
                            quantity: ci.quantity,
                            unitPrice: ci.product.price,
                        })),
                    },
                },
                include: { items: true },
            });

            await tx.cartItem.deleteMany({ where: { userId } });

            return order;
        });

        res.status(201).json(result);
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
