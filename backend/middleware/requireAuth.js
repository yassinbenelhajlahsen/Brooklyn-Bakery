import { supabaseAdmin } from '../lib/supabase.js';

// getClaims verifies asymmetric (ES256/RS256) tokens locally via WebCrypto
// using a cached JWKS — no network round-trip after the first call.
// On legacy HS256 projects it transparently falls back to a getUser() request.
export async function requireAuth(req, res, next) {
    const match = req.headers.authorization?.match(/^Bearer\s+(\S+)$/);
    if (!match) {
        return res.status(401).json({ error: 'Invalid or missing token' });
    }
    const token = match[1];

    let data, error;
    try {
        ({ data, error } = await supabaseAdmin.auth.getClaims(token));
    } catch {
        return res.status(503).json({ error: 'Auth service unavailable' });
    }

    if (error || !data?.claims) {
        return res.status(401).json({ error: 'Invalid token' });
    }

    req.user = { id: data.claims.sub, email: data.claims.email };
    next();
}
