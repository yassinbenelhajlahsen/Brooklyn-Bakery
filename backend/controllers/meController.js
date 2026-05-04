import { prisma } from '../lib/prisma.js';
import { httpError, sendHttpError } from '../lib/httpError.js';
import { creditClicks } from '../services/clickService.js';
import { normalizeDisplayName } from '../lib/displayName.js';

export async function getMe(req, res) {
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
        if (!profile) return sendHttpError(res, httpError(404, 'Profile not found'));
        res.json({ user: { ...profile, email: req.user.email } });
    } catch (err) {
        console.error('getMe failed:', err);
        res.status(500).json({ error: 'Failed to load profile' });
    }
}

export async function updateMe(req, res) {
    try {
        const result = normalizeDisplayName(req.body?.displayName);
        if (!result.ok) {
            return sendHttpError(res, httpError(400, result.error));
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
        console.error('updateMe failed:', err);
        res.status(500).json({ error: 'Failed to update profile' });
    }
}

export async function flushClicks(req, res) {
    try {
        const { delta, elapsedMs } = req.body ?? {};
        const result = await creditClicks({
            userId: req.user.id,
            delta,
            elapsedMs,
        });
        res.json(result);
    } catch (err) {
        if (err.http) return sendHttpError(res, err);
        console.error('flushClicks failed:', err);
        res.status(500).json({ error: 'Failed to credit clicks' });
    }
}
