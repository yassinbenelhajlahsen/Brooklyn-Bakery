import { supabaseAdmin } from '../lib/supabase.js';

export async function requireAuth(req, res, next) {
    const header = req.headers.authorization;

    if (!header) {
        return res.status(401).json({ error: 'Missing token' });
    }

    if (!header.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Invalid auth header' });
    }

    const token = header.slice('Bearer '.length).trim();
    if (!token) {
        return res.status(401).json({ error: 'Missing token' });
    }

    let data, error;
    try {
        ({ data, error } = await supabaseAdmin.auth.getUser(token));
    } catch (err) {
        console.error('Supabase getUser failed:', err.message);
        return res.status(503).json({ error: 'Auth service unavailable' });
    }

    if (error || !data?.user) {
        return res.status(401).json({ error: 'Invalid token' });
    }

    req.user = { id: data.user.id, email: data.user.email };
    next();
}
