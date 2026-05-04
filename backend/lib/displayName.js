const MAX_LENGTH = 50;

export function normalizeDisplayName(input) {
    if (typeof input !== 'string') {
        return { ok: false, error: 'displayName must be a string' };
    }
    const trimmed = input.trim();
    if (trimmed.length === 0) {
        return { ok: false, error: 'displayName must not be empty' };
    }
    if (trimmed.length > MAX_LENGTH) {
        return { ok: false, error: `displayName must be ${MAX_LENGTH} characters or fewer` };
    }
    return { ok: true, value: trimmed };
}
