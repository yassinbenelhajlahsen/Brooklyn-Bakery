import { httpError } from './httpError.js';

const MAX_TAKE = 50;

function parseIntStrict(value, label) {
    if (value === undefined || value === null || value === '') return undefined;
    if (typeof value === 'number') {
        if (!Number.isInteger(value)) throw httpError(400, `Invalid ${label}`);
        return value;
    }
    if (typeof value !== 'string') throw httpError(400, `Invalid ${label}`);
    if (!/^-?\d+$/.test(value)) throw httpError(400, `Invalid ${label}`);
    return Number(value);
}

export function parsePagination(query) {
    const rawTake = parseIntStrict(query.take, 'take');
    const rawSkip = parseIntStrict(query.skip, 'skip');

    const take = rawTake === undefined ? 10 : rawTake;
    const skip = rawSkip === undefined ? 0 : rawSkip;

    if (take < 1) throw httpError(400, 'Invalid take');
    if (skip < 0) throw httpError(400, 'Invalid skip');

    return { take: Math.min(MAX_TAKE, take), skip };
}
