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
                avatarUrl: true,
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
        const { displayName, avatarUrl } = req.body ?? {};

        const data = {};

        if (displayName !== undefined) {
            const result = normalizeDisplayName(displayName);

            if (!result.ok) {
                throw httpError(400, result.error);
            }

            data.displayName = result.value;
        }

        if (avatarUrl !== undefined) {
            if (typeof avatarUrl !== 'string') {
                throw httpError(400, 'Avatar URL must be a string');
            }

            data.avatarUrl = avatarUrl;
        }

        if (Object.keys(data).length === 0) {
            throw httpError(400, 'No profile fields provided');
        }

        const profile = await prisma.user.update({
            where: { id: req.user.id },
            data,
            select: {
                id: true,
                displayName: true,
                avatarUrl: true,
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
