import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';

const PRODUCT_SELECT = {
    id: true,
    name: true,
    slug: true,
    description: true,
    imageUrl: true,
    type: true,
    price: true,
    stock: true,
};

export async function getWishlist(req, res, next) {
    try {
        const items = await prisma.wishlistItem.findMany({
            where: { userId: req.user.id },
            include: { product: { select: PRODUCT_SELECT } },
            orderBy: { addedAt: 'desc' },
        });
        res.json({ items });
    } catch (err) {
        next(err);
    }
}

export async function addWishlistItem(req, res, next) {
    try {
        const { productId } = req.params;
        const row = await prisma.wishlistItem.upsert({
            where: { userId_productId: { userId: req.user.id, productId } },
            update: {},
            create: { userId: req.user.id, productId },
        });
        res.status(201).json(row);
    } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2003') {
            return res.status(404).json({ error: 'Unknown product' });
        }
        next(err);
    }
}

export async function removeWishlistItem(req, res, next) {
    try {
        await prisma.wishlistItem.deleteMany({
            where: { userId: req.user.id, productId: req.params.productId },
        });
        res.status(204).end();
    } catch (err) {
        next(err);
    }
}
