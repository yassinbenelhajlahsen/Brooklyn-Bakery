import { prisma } from '../lib/prisma.js';
import { httpError, sendHttpError } from '../lib/httpError.js';
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

export async function listAddresses(req, res) {
    try {
        const addresses = await prisma.address.findMany({
            where: { userId: req.user.id },
            orderBy: { createdAt: 'desc' },
            select: ADDRESS_SELECT,
        });
        res.json({ addresses });
    } catch (err) {
        console.error('listAddresses failed:', err);
        res.status(500).json({ error: 'Failed to load addresses' });
    }
}

export async function createAddress(req, res) {
    try {
        const parsed = normalizeAddressInput(req.body);
        if (!parsed.ok) {
            return sendHttpError(res, httpError(400, `Invalid ${parsed.field}`));
        }
        const address = await prisma.address.create({
            data: { userId: req.user.id, ...parsed.value },
            select: ADDRESS_SELECT,
        });
        res.status(201).json({ address });
    } catch (err) {
        if (err.http) return sendHttpError(res, err);
        console.error('createAddress failed:', err);
        res.status(500).json({ error: 'Failed to create address' });
    }
}

export async function updateAddress(req, res) {
    try {
        const parsed = normalizeAddressInput(req.body, { partial: true });
        if (!parsed.ok) {
            return sendHttpError(res, httpError(400, `Invalid ${parsed.field}`));
        }
        const existing = await prisma.address.findUnique({
            where: { id: req.params.id },
            select: { userId: true },
        });
        if (!existing) return sendHttpError(res, httpError(404, 'Address not found'));
        if (existing.userId !== req.user.id) {
            return sendHttpError(res, httpError(403, 'Forbidden'));
        }
        const address = await prisma.address.update({
            where: { id: req.params.id },
            data: parsed.value,
            select: ADDRESS_SELECT,
        });
        res.json({ address });
    } catch (err) {
        if (err.http) return sendHttpError(res, err);
        console.error('updateAddress failed:', err);
        res.status(500).json({ error: 'Failed to update address' });
    }
}

export async function deleteAddress(req, res) {
    try {
        const existing = await prisma.address.findUnique({
            where: { id: req.params.id },
            select: { userId: true },
        });
        if (!existing) return sendHttpError(res, httpError(404, 'Address not found'));
        if (existing.userId !== req.user.id) {
            return sendHttpError(res, httpError(403, 'Forbidden'));
        }
        await prisma.address.delete({ where: { id: req.params.id } });
        res.status(204).end();
    } catch (err) {
        if (err.http) return sendHttpError(res, err);
        console.error('deleteAddress failed:', err);
        res.status(500).json({ error: 'Failed to delete address' });
    }
}
