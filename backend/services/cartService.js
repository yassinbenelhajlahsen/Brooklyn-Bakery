import { prisma } from '../lib/prisma.js';
import { mergeCartItems } from '../lib/cart.js';

const PRODUCT_SELECT = { id: true, name: true, description: true, imageUrl: true, type: true, price: true, stock: true };

export async function mergeGuestCart(userId, incoming) {
    const incomingArr = Array.isArray(incoming) ? incoming : [];
    const existing = await prisma.cartItem.findMany({
        where: { userId },
        select: { productId: true, quantity: true },
    });

    const merged = mergeCartItems(existing, incomingArr);

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

    return validMerged.map(({ productId, quantity }) => ({
        userId,
        productId,
        quantity,
        product: productById.get(productId),
    }));
}
