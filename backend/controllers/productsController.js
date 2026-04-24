import { prisma } from '../lib/prisma.js';

export async function getProducts(_req, res) {
    const products = await prisma.product.findMany({
        where: { archivedAt: null },
        orderBy: [{ type: 'asc' }, { name: 'asc' }],
        select: {
            id: true,
            name: true,
            description: true,
            imageUrl: true,
            type: true,
            price: true,
            stock: true,
        },
    });
    res.json({ items: products });
}

export async function getProduct(req, res) {
    const product = await prisma.product.findFirst({
        where: { id: req.params.id, archivedAt: null },
        select: {
            id: true,
            name: true,
            description: true,
            imageUrl: true,
            type: true,
            price: true,
            stock: true,
        },
    });
    if (!product) return res.status(404).json({ error: 'Product not found.' });
    res.json(product);
}