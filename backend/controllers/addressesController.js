import { prisma } from '../lib/prisma.js';
import { httpError } from '../lib/httpError.js';
import { normalizeAddressInput } from '../lib/address.js';

const ADDRESS_SELECT = {
    id: true,
    line1: true,
    line2: true,
    city: true,
    state: true,
    postalCode: true,
    country: true,
    createdAt: true,
};

export async function listAddresses(req, res, next) {
    try {
        const addresses = await prisma.address.findMany({
            where: { userId: req.user.id },
            orderBy: { createdAt: 'desc' },
            select: ADDRESS_SELECT,
        });
        res.json({ addresses });
    } catch (err) {
        next(err);
    }
}

export async function createAddress(req, res, next) {
    try {
        const parsed = normalizeAddressInput(req.body);
        if (!parsed.ok) {
            throw httpError(400, `Invalid ${parsed.field}`);
        }
        const address = await prisma.address.create({
            data: { userId: req.user.id, ...parsed.value },
            select: ADDRESS_SELECT,
        });
        res.status(201).json({ address });
    } catch (err) {
        next(err);
    }
}

export async function updateAddress(req, res, next) {
    try {
        const parsed = normalizeAddressInput(req.body, { partial: true });
        if (!parsed.ok) {
            throw httpError(400, `Invalid ${parsed.field}`);
        }
        const existing = await prisma.address.findUnique({
            where: { id: req.params.id },
            select: { userId: true },
        });
        if (!existing) throw httpError(404, 'Address not found');
        if (existing.userId !== req.user.id) {
            throw httpError(403, 'Forbidden');
        }
        const address = await prisma.address.update({
            where: { id: req.params.id },
            data: parsed.value,
            select: ADDRESS_SELECT,
        });
        res.json({ address });
    } catch (err) {
        next(err);
    }
}

export async function deleteAddress(req, res, next) {
    try {
        const existing = await prisma.address.findUnique({
            where: { id: req.params.id },
            select: { userId: true },
        });
        if (!existing) throw httpError(404, 'Address not found');
        if (existing.userId !== req.user.id) {
            throw httpError(403, 'Forbidden');
        }
        await prisma.address.delete({ where: { id: req.params.id } });
        res.status(204).end();
    } catch (err) {
        next(err);
    }
}
