export const RATE_PER_SEC = 10;
export const BURST_BONUS = 20;
export const MAX_FIRST_WINDOW_MS = 3_600_000;
export const MAX_DELTA = 100_000;
export const MAX_ELAPSED_MS = 86_400_000;

export function computeCredit({ delta, elapsedMs, lastClickFlushAt, now }) {
    if (!Number.isInteger(delta) || delta < 0) {
        throw new Error('delta must be a non-negative integer');
    }
    if (!Number.isInteger(elapsedMs) || elapsedMs <= 0) {
        throw new Error('elapsedMs must be a positive integer');
    }

    let effectiveElapsed;
    if (lastClickFlushAt == null) {
        effectiveElapsed = Math.min(elapsedMs, MAX_FIRST_WINDOW_MS);
    } else {
        const serverElapsed = now.getTime() - lastClickFlushAt.getTime();
        effectiveElapsed = Math.min(elapsedMs, Math.max(0, serverElapsed));
    }

    const maxAllowed =
        Math.floor(effectiveElapsed / 1000) * RATE_PER_SEC + BURST_BONUS;
    const credited = Math.min(delta, maxAllowed);
    return { credited };
}
