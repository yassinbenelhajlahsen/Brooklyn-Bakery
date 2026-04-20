import { UserRole } from '@prisma/client';
import { prisma } from '../lib/prisma.js';

export async function requireAdmin(req, res, next) {
    if (!req.user?.id) {
        return res.status(401).json({ error: 'Unauthenticated' });
    }
    const user = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: { role: true },
    });
    if (!user || user.role !== UserRole.admin) {
        return res.status(403).json({ error: 'Admin only' });
    }
    next();
}
