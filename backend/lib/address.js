const REQUIRED_FIELDS = ['line1', 'city', 'state', 'postalCode', 'country'];
const ALL_FIELDS = ['line1', 'line2', 'city', 'state', 'postalCode', 'country'];

function trimOrNull(v) {
    if (typeof v !== 'string') return null;
    const t = v.trim();
    return t.length === 0 ? null : t;
}

export function normalizeAddressInput(input, { partial = false } = {}) {
    if (input == null || typeof input !== 'object') {
        return { ok: false, field: 'body', message: 'Body must be an object' };
    }

    const value = {};

    for (const field of ALL_FIELDS) {
        if (!(field in input)) {
            if (!partial && REQUIRED_FIELDS.includes(field)) {
                return { ok: false, field, message: `${field} is required` };
            }
            if (!partial && field === 'line2') {
                value.line2 = null;
            }
            continue;
        }

        const raw = input[field];

        if (field === 'line2') {
            value.line2 = trimOrNull(raw);
            continue;
        }

        if (typeof raw !== 'string') {
            return { ok: false, field, message: `${field} must be a string` };
        }
        const trimmed = raw.trim();
        if (trimmed.length === 0) {
            return { ok: false, field, message: `${field} must not be empty` };
        }
        value[field] = trimmed;
    }

    return { ok: true, value };
}

export function snapshotAddress(address) {
    return {
        shippingLine1: address.line1,
        shippingLine2: address.line2 ?? null,
        shippingCity: address.city,
        shippingState: address.state,
        shippingPostalCode: address.postalCode,
        shippingCountry: address.country,
    };
}
