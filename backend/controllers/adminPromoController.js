import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { httpError } from '../lib/httpError.js';
import { formatPromo, validatePromoInput } from '../services/promoService.js';

const INCLUDE_PRODUCT = { product: { select: { id: true, name: true } } };

export async function listPromoCodes(_req, res, next) {
    try {
        const promos = await prisma.promoCode.findMany({
            orderBy: [{ active: 'desc' }, { createdAt: 'desc' }],
            include: INCLUDE_PRODUCT,
        });
        res.json({ items: promos.map(formatPromo) });
    } catch (err) {
        next(err);
    }
}

export async function createPromoCode(req, res, next) {
    try {
        const data = validatePromoInput(req.body);
        const promo = await prisma.promoCode.create({
            data,
            include: INCLUDE_PRODUCT,
        });
        res.status(201).json(formatPromo(promo));
    } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
            return next(httpError(409, 'Promo code already exists.'));
        }
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2003') {
            return next(httpError(404, 'Target product was not found.'));
        }
        next(err);
    }
}

export async function updatePromoCode(req, res, next) {
    try {
        const existing = await prisma.promoCode.findUnique({ where: { id: req.params.id } });
        if (!existing) throw httpError(404, 'Promo code not found.');

        const data = {};
        if ('active' in (req.body ?? {})) data.active = Boolean(req.body.active);
        if ('code' in (req.body ?? {}) || 'discountPercent' in (req.body ?? {}) || 'scope' in (req.body ?? {})) {
            Object.assign(data, validatePromoInput({ ...existing, ...req.body }));
        }
        if (Object.keys(data).length === 0) throw httpError(400, 'No changes supplied.');

        const promo = await prisma.promoCode.update({
            where: { id: req.params.id },
            data,
            include: INCLUDE_PRODUCT,
        });
        res.json(formatPromo(promo));
    } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
            return next(httpError(409, 'Promo code already exists.'));
        }
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2003') {
            return next(httpError(404, 'Target product was not found.'));
        }
        next(err);
    }
}

export async function deletePromoCode(req, res, next) {
    try {
        const existing = await prisma.promoCode.findUnique({ where: { id: req.params.id } });
        if (!existing) throw httpError(404, 'Promo code not found.');
        await prisma.promoCode.delete({ where: { id: req.params.id } });
        res.status(204).end();
    } catch (err) {
        next(err);
    }
}
