import { prisma } from '../lib/prisma.js';
import { sendHttpError, httpError } from '../lib/httpError.js';

const PRODUCT_TYPES = new Set(['bread', 'pastry', 'cake', 'cookie', 'drink']);

function validateProductPayload(body, { partial = false } = {}) {
    const errors = [];
    const fields = ['name', 'description', 'imageUrl', 'type', 'price', 'stock'];
    for (const f of fields) {
        if (!partial && body[f] === undefined) errors.push(`Missing ${f}`);
    }
    if (body.type !== undefined && !PRODUCT_TYPES.has(body.type)) errors.push('Invalid type');
    if (body.price !== undefined && (!Number.isInteger(body.price) || body.price < 0)) errors.push('Invalid price');
    if (body.stock !== undefined && (!Number.isInteger(body.stock) || body.stock < 0)) errors.push('Invalid stock');
    if (errors.length) throw httpError(400, errors.join('; '));
}

export async function listProducts(req, res) {
    const includeArchived = req.query.includeArchived === 'true';
    const products = await prisma.product.findMany({
        where: includeArchived ? undefined : { archivedAt: null },
        orderBy: { createdAt: 'desc' },
    });
    res.json({ products });
}

export async function createProduct(req, res) {
    try {
        validateProductPayload(req.body);
        const product = await prisma.product.create({ data: req.body });
        res.status(201).json(product);
    } catch (err) {
        if (err.http) return sendHttpError(res, err);
        console.error('createProduct failed:', err);
        res.status(500).json({ error: 'Create failed' });
    }
}

export async function updateProduct(req, res) {
    try {
        validateProductPayload(req.body, { partial: true });
        const product = await prisma.product.update({
            where: { id: req.params.id },
            data: req.body,
        });
        res.json(product);
    } catch (err) {
        if (err.code === 'P2025') return res.status(404).json({ error: 'Product not found' });
        if (err.http) return sendHttpError(res, err);
        console.error('updateProduct failed:', err);
        res.status(500).json({ error: 'Update failed' });
    }
}

export async function archiveProduct(req, res) {
    try {
        const product = await prisma.product.update({
            where: { id: req.params.id },
            data: { archivedAt: new Date() },
        });
        res.json(product);
    } catch (err) {
        if (err.code === 'P2025') return res.status(404).json({ error: 'Product not found' });
        console.error('archiveProduct failed:', err);
        res.status(500).json({ error: 'Archive failed' });
    }
}

export async function unarchiveProduct(req, res) {
    try {
        const product = await prisma.product.update({
            where: { id: req.params.id },
            data: { archivedAt: null },
        });
        res.json(product);
    } catch (err) {
        if (err.code === 'P2025') return res.status(404).json({ error: 'Product not found' });
        console.error('unarchiveProduct failed:', err);
        res.status(500).json({ error: 'Unarchive failed' });
    }
}
