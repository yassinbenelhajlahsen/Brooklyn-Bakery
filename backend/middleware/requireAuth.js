import { supabaseAdmin } from '../lib/supabase.js';

export async function requireAuth(req, res, next) {
    const match = req.headers.authorization?.match(/^Bearer\s+(\S+)$/);
    if (!match) {
        return res.status(401).json({ error: 'Invalid or missing token' });
    }
    const token = match[1];

    let data, error;
    try {
        ({ data, error } = await supabaseAdmin.auth.getUser(token));
    } catch {
        return res.status(503).json({ error: 'Auth service unavailable' });
    }

    if (error || !data?.user) {
        return res.status(401).json({ error: 'Invalid token' });
    }

    req.user = { id: data.user.id, email: data.user.email };
    next();
}
