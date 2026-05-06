import { prisma } from '../lib/prisma.js';
import { httpError } from '../lib/httpError.js';
import { creditClicks } from '../services/clickService.js';
import { normalizeDisplayName } from '../lib/displayName.js';

export async function getMe(req, res, next) {
    try {
        const profile = await prisma.user.findUnique({
            where: { id: req.user.id },
            select: {
                id: true,
                displayName: true,
                balance: true,
                role: true,
            },
        });
        if (!profile) throw httpError(404, 'Profile not found');
        res.json({ user: { ...profile, email: req.user.email } });
    } catch (err) {
        next(err);
    }
}

export async function updateMe(req, res, next) {
    try {
        const result = normalizeDisplayName(req.body?.displayName);
        if (!result.ok) {
            throw httpError(400, result.error);
        }
        const profile = await prisma.user.update({
            where: { id: req.user.id },
            data: { displayName: result.value },
            select: {
                id: true,
                displayName: true,
                balance: true,
                role: true,
            },
        });
        res.json({ user: { ...profile, email: req.user.email } });
    } catch (err) {
        next(err);
    }
}

export async function flushClicks(req, res, next) {
    try {
        const { delta, elapsedMs } = req.body ?? {};
        const result = await creditClicks({
            userId: req.user.id,
            delta,
            elapsedMs,
        });
        res.json(result);
    } catch (err) {
        next(err);
    }
}
