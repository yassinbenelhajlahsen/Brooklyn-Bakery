import { createContext, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase.js';

export const AuthContext = createContext(null);

const API_BASE = import.meta.env.VITE_BACKEND_URL ?? 'http://127.0.0.1:3000';

export function AuthProvider({ children }) {
    const [session, setSession] = useState(null);
    const [user, setUser] = useState(null);
    const [loginOpen, setLoginOpen] = useState(false);
    const [pendingCheckout, setPendingCheckout] = useState(null);
    const [lastOrderResult, setLastOrderResult] = useState(null);
    const inFlight = useRef(false);

    useEffect(() => {
        supabase.auth.getSession().then(({ data }) => {
            setSession(data.session);
            setUser(data.session?.user ?? null);
        });

        const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => {
            setSession(next);
            setUser(next?.user ?? null);
            if (!next) setPendingCheckout(null);
        });

        return () => listener.subscription.unsubscribe();
    }, []);

    const signIn = (email, password) =>
        supabase.auth.signInWithPassword({ email, password });

    const signUp = (email, password) =>
        supabase.auth.signUp({ email, password });

    const signOut = () => supabase.auth.signOut();

    const openLogin = () => setLoginOpen(true);
    const closeLogin = () => {
        setLoginOpen(false);
        setPendingCheckout(null);
    };

    const submitOrder = async (cart, accessToken) => {
        inFlight.current = true;
        try {
            const res = await fetch(`${API_BASE}/orders`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${accessToken}`,
                },
                body: JSON.stringify(cart),
            });
            if (res.status === 401) {
                await supabase.auth.signOut();
                setLoginOpen(true);
                setLastOrderResult({ error: 'Session expired, please log in again.' });
                return;
            }
            const body = await res.json();
            setLastOrderResult(body);
        } catch (err) {
            setLastOrderResult({ error: `Checkout failed: ${err.message}` });
        } finally {
            inFlight.current = false;
        }
    };

    const requestCheckout = (cart) => {
        if (user && session?.access_token) {
            submitOrder(cart, session.access_token);
        } else {
            setPendingCheckout(cart);
            setLoginOpen(true);
        }
    };

    useEffect(() => {
        if (user && session?.access_token && pendingCheckout && !inFlight.current) {
            const cart = pendingCheckout;
            setPendingCheckout(null);
            setLoginOpen(false);
            submitOrder(cart, session.access_token);
        }
    }, [user, session, pendingCheckout]);

    const value = {
        user,
        session,
        loginOpen,
        openLogin,
        closeLogin,
        signIn,
        signUp,
        signOut,
        requestCheckout,
        lastOrderResult,
        clearOrderResult: () => setLastOrderResult(null),
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
