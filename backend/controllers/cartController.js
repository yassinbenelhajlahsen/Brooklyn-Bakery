import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { mergeCartItems } from '../lib/cart.js';

const PRODUCT_SELECT = { id: true, name: true, description: true, imageUrl: true, type: true, price: true };

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
    if (!Number.isInteger(quantity) || quantity < 0) {
        return res.status(400).json({ error: 'quantity must be a non-negative integer' });
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
    const userId = req.user.id;
    const incoming = Array.isArray(req.body) ? req.body : [];
    const existing = await prisma.cartItem.findMany({
        where: { userId },
        select: { productId: true, quantity: true },
    });

    const merged = mergeCartItems(existing, incoming);

    const products = await prisma.product.findMany({
        where: { id: { in: merged.map((m) => m.productId) } },
        select: PRODUCT_SELECT,
    });
    const productById = new Map(products.map((p) => [p.id, p]));
    const validMerged = merged.filter((m) => productById.has(m.productId));

    await prisma.$transaction([
        prisma.cartItem.deleteMany({ where: { userId } }),
        prisma.cartItem.createMany({
            data: validMerged.map(({ productId, quantity }) => ({ userId, productId, quantity })),
        }),
    ]);

    const items = validMerged.map(({ productId, quantity }) => ({
        userId,
        productId,
        quantity,
        product: productById.get(productId),
    }));
    res.json({ items });
}
