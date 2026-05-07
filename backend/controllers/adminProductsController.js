import crypto from 'node:crypto';
import { prisma } from '../lib/prisma.js';
import { httpError } from '../lib/httpError.js';
import { parsePagination } from '../lib/pagination.js';
import { toNameSlug, disambiguateSlug } from '../lib/slugUtils.js';

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

const ADMIN_PRODUCT_SELECT = {
    id: true,
    name: true,
    slug: true,
    description: true,
    imageUrl: true,
    type: true,
    price: true,
    stock: true,
    avgRating: true,
    reviewCount: true,
    archivedAt: true,
    createdAt: true,
};

const PRODUCT_SORTS = {
    newest:     [{ createdAt: 'desc' }],
    popularity: [{ reviewCount: 'desc' }, { createdAt: 'desc' }],
};

export async function listProducts(req, res, next) {
    try {
        const includeArchived = req.query.includeArchived === 'true';
        const sortKey = req.query.sort ?? 'newest';
        if (!PRODUCT_SORTS[sortKey]) {
            throw httpError(400, 'Invalid sort');
        }
        const { take, skip } = parsePagination(req.query);
        const where = includeArchived ? undefined : { archivedAt: null };

        const [items, total] = await Promise.all([
            prisma.product.findMany({
                where,
                orderBy: PRODUCT_SORTS[sortKey],
                take,
                skip,
                select: ADMIN_PRODUCT_SELECT,
            }),
            prisma.product.count({ where }),
        ]);

        res.json({ items, total, hasMore: skip + items.length < total });
    } catch (err) {
        next(err);
    }
}

export async function createProduct(req, res, next) {
    try {
        validateProductPayload(req.body);
        const id = crypto.randomUUID();
        const baseSlug = toNameSlug(req.body.name);
        const collision = await prisma.product.findUnique({ where: { slug: baseSlug } });
        const slug = collision ? disambiguateSlug(baseSlug, id) : baseSlug;
        const product = await prisma.product.create({ data: { id, slug, ...req.body } });
        res.status(201).json(product);
    } catch (err) {
        next(err);
    }
}

export async function updateProduct(req, res, next) {
    try {
        validateProductPayload(req.body, { partial: true });
        // Slug is intentionally stable — renaming a product does not change its URL.
        const product = await prisma.product.update({
            where: { id: req.params.id },
            data: req.body,
        });
        res.json(product);
    } catch (err) {
        if (err.code === 'P2025') return res.status(404).json({ error: 'Product not found' });
        next(err);
    }
}

export async function archiveProduct(req, res, next) {
    try {
        const product = await prisma.product.update({
            where: { id: req.params.id },
            data: { archivedAt: new Date() },
        });
        res.json(product);
    } catch (err) {
        if (err.code === 'P2025') return res.status(404).json({ error: 'Product not found' });
        next(err);
    }
}

export async function unarchiveProduct(req, res, next) {
    try {
        const product = await prisma.product.update({
            where: { id: req.params.id },
            data: { archivedAt: null },
        });
        res.json(product);
    } catch (err) {
        if (err.code === 'P2025') return res.status(404).json({ error: 'Product not found' });
        next(err);
    }
}
