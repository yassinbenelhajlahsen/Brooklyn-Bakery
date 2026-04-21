import { prisma } from '../lib/prisma.js';
import { httpError, sendHttpError } from '../lib/httpError.js';

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
