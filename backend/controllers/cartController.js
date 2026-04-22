import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { mergeGuestCart } from '../services/cartService.js';

const PRODUCT_SELECT = { id: true, name: true, description: true, imageUrl: true, type: true, price: true, stock: true };

export async function getCart(req, res) {
    const items = await prisma.cartItem.findMany({
        where: { userId: req.user.id },
        include: { product: { select: PRODUCT_SELECT } },
        orderBy: { addedAt: 'asc' },
    });
    res.json({ items });
}

export async function upsertCartItem(req, res) {
    const { productId } = req.params;
    const quantity = Number(req.body?.quantity);
    if (!Number.isInteger(quantity) || quantity < 0 || quantity > 99) {
        return res.status(400).json({ error: 'quantity must be an integer between 0 and 99' });
    }
    if (quantity === 0) {
        await prisma.cartItem.deleteMany({
            where: { userId: req.user.id, productId },
        });
        return res.status(204).end();
    }

    try {
        const row = await prisma.cartItem.upsert({
            where: { userId_productId: { userId: req.user.id, productId } },
            update: { quantity },
            create: { userId: req.user.id, productId, quantity },
        });
        res.json(row);
    } catch (err) {
        // P2003: foreign key violation — productId doesn't exist.
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2003') {
            return res.status(404).json({ error: 'Unknown product' });
        }
        throw err;
    }
}

export async function deleteCart(req, res) {
    await prisma.cartItem.deleteMany({ where: { userId: req.user.id } });
    res.status(204).end();
}

export async function mergeCart(req, res) {
    const items = await mergeGuestCart(req.user.id, req.body);
    res.json({ items });
}
