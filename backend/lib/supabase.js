import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const url = process.env.SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;

if (!url || !secretKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SECRET_KEY in environment');
}

export const supabaseAdmin = createClient(url, secretKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false,
    },
});
