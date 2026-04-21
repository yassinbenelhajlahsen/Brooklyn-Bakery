/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase.js';

export const AuthContext = createContext(null);

const API_BASE = import.meta.env.VITE_BACKEND_URL ?? 'http://127.0.0.1:3000';

function toHydratedCart(items) {
    const hydrated = {};
    for (const row of items) {
        hydrated[row.productId] = { item: row.product, qty: row.quantity };
    }
    return hydrated;
}

export function AuthProvider({ children }) {
    const [session, setSession] = useState(null);
    const [user, setUser] = useState(null);
    const [loginOpen, setLoginOpen] = useState(false);
    const [loginReason, setLoginReason] = useState(null);

    useEffect(() => {
        const { data: listener } = supabase.auth.onAuthStateChange((event, next) => {
            setSession(next);
            setUser(next?.user ?? null);
            if (!next) {
                setLoginReason(null);
            } else if (event === 'SIGNED_IN') {
                setLoginOpen(false);
                setLoginReason(null);
            }
        });

        return () => listener.subscription.unsubscribe();
    }, []);

    const signIn = useCallback((email, password) =>
        supabase.auth.signInWithPassword({ email, password }), []);

    const signUp = useCallback((email, password, displayName) =>
        supabase.auth.signUp({
            email,
            password,
            options: { data: { display_name: displayName?.trim() || null } },
        }), []);

    const signOut = useCallback(() => supabase.auth.signOut(), []);

    const openLogin = useCallback((reason = null) => {
        setLoginReason(reason);
        setLoginOpen(true);
    }, []);
    const closeLogin = useCallback(() => {
        setLoginOpen(false);
        setLoginReason(null);
    }, []);

    const authedFetch = useCallback(async (path, init = {}) => {
        const accessToken = session?.access_token;
        if (!accessToken) throw new Error('Not authenticated');
        return fetch(`${API_BASE}${path}`, {
            ...init,
            headers: {
                ...(init.headers || {}),
                'Content-Type': 'application/json',
                Authorization: `Bearer ${accessToken}`,
            },
        });
    }, [session?.access_token]);

    const mergeAndHydrateCart = useCallback(async (localCart) => {
        const payload = Object.values(localCart || {})
            .map(({ item, qty }) => ({ productId: item.id, quantity: qty }));
        const res = await authedFetch('/cart/merge', {
            method: 'POST',
            body: JSON.stringify(payload),
        });
        if (!res.ok) return null;
        const body = await res.json();
        return toHydratedCart(body.items);
    }, [authedFetch]);

    const fetchServerCart = useCallback(async () => {
        try {
            const res = await authedFetch('/cart');
            if (!res.ok) return null;
            const body = await res.json();
            return toHydratedCart(body.items);
        } catch {
            return null;
        }
    }, [authedFetch]);

    const syncCartItem = useCallback(async (productId, quantity) => {
        if (!session?.access_token) return;
        try {
            await authedFetch(`/cart/items/${productId}`, {
                method: 'PUT',
                body: JSON.stringify({ quantity }),
            });
        } catch {
            // best-effort sync; surface via UI if it matters later
        }
    }, [authedFetch, session?.access_token]);

    const clearServerCart = useCallback(async () => {
        if (!session?.access_token) return;
        try {
            await authedFetch('/cart', { method: 'DELETE' });
        } catch {
            // best-effort clear
        }
    }, [authedFetch, session?.access_token]);

    const requestCheckout = useCallback(async () => {
        if (user && session?.access_token) {
        try{
            await authedFetch('/orders',{ method: 'POST'});
        } catch {
            console.log("this console log is located: frontend/src/auth/AuthProvider.jsx\nsomething went wrong here");
        }
        }
        setLoginReason('checkout');
        setLoginOpen(true);
    }, [authedFetch, user, session?.access_token]);

    const value = useMemo(() => ({
        user,
        session,
        loginOpen,
        loginReason,
        openLogin,
        closeLogin,
        signIn,
        signUp,
        signOut,
        requestCheckout,
        mergeAndHydrateCart,
        fetchServerCart,
        syncCartItem,
        clearServerCart,
    }), [
        user,
        session,
        loginOpen,
        loginReason,
        openLogin,
        closeLogin,
        signIn,
        signUp,
        signOut,
        requestCheckout,
        mergeAndHydrateCart,
        fetchServerCart,
        syncCartItem,
        clearServerCart,
    ]);

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
