import { OrderStatus } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { computeCartTotal } from '../lib/cart.js';
import { httpError } from '../lib/httpError.js';
import { sendConfirmationEmail } from './mailerService.js';
import { supabaseAdmin } from '../lib/supabase.js';

export async function placeOrder(userId) {

    // Fetch auth user and display name before transaction to avoid timeout
    const { data: { user: authUser }, error: authError } = await supabaseAdmin.auth.admin.getUserById(userId);

    const userProfile = await prisma.user.findUnique({
        where: { id: userId },
        select: { displayName: true },
    });

    const order = await prisma.$transaction(async (tx) => {
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

        for (const ci of cartItems) {
            const { count } = await tx.product.updateMany({
                where: { id: ci.product.id, stock: { gte: ci.quantity } },
                data: { stock: { decrement: ci.quantity } },
            });
            if (count === 0) {
                throw httpError(409, `Insufficient stock for ${ci.product.name}`);
            }
        }

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

        return { createdOrder: order, cartItems };
    });

    // Send confirmation email AFTER transaction completes
    if (authUser?.email && userProfile) {
        try {
            await sendConfirmationEmail({
                to: authUser.email,
                customerName: userProfile.displayName || 'Customer',
                orderDetails: {
                    orderId: order.createdOrder.id,
                    items: order.cartItems.map((item) => ({
                        name: item.product.name,
                        qty: item.quantity,
                        price: item.product.price
                    })),
                    total: order.createdOrder.total
                },
            });
        } catch (emailErr) {
            console.error('Email failed to send, but order was created:', emailErr.message);
        }
    }

    return order.createdOrder;
}

export async function cancelOrderById(orderId) {
    return prisma.$transaction(async (tx) => {
        const order = await tx.order.findUnique({
            where: { id: orderId },
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
            where: { id: orderId },
            data: { status: OrderStatus.cancelled },
            include: { items: true },
        });
    });
}