import { prisma } from '../lib/prisma.js';
import { httpError } from '../lib/httpError.js';
import {
    computeCredit,
    MAX_DELTA,
    MAX_ELAPSED_MS,
} from '../lib/clickCredit.js';

export async function creditClicks({ userId, delta, elapsedMs }) {
    if (!Number.isInteger(delta) || delta <= 0 || delta > MAX_DELTA) {
        throw httpError(400, 'Invalid delta');
    }
    if (!Number.isInteger(elapsedMs) || elapsedMs <= 0 || elapsedMs > MAX_ELAPSED_MS) {
        throw httpError(400, 'Invalid elapsedMs');
    }

    return prisma.$transaction(async (tx) => {
        const rows = await tx.$queryRaw`
            SELECT balance, last_click_flush_at
            FROM users
            WHERE id = ${userId}::uuid
            FOR UPDATE
        `;
        if (rows.length === 0) {
            throw httpError(500, 'Profile missing');
        }

        const now = new Date();
        const lastClickFlushAt = rows[0].last_click_flush_at; // may be null
        const { credited } = computeCredit({
            delta,
            elapsedMs,
            lastClickFlushAt,
            now,
        });

        const updated = await tx.user.update({
            where: { id: userId },
            data: {
                balance: { increment: credited },
                lastClickFlushAt: now,
            },
            select: { balance: true },
        });

        return { balance: updated.balance, credited };
    });
}
