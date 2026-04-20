import { prisma } from '../lib/prisma.js';

export async function getProducts(_req, res) {
    const products = await prisma.product.findMany({
        orderBy: [{ type: 'asc' }, { name: 'asc' }],
        select: {
            id: true,
            name: true,
            description: true,
            imageUrl: true,
            type: true,
            price: true,
        },
    });
    res.json({ items: products });
}