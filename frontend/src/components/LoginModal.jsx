import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../auth/useAuth.js';

const COPY = {
    login: {
        default: {
            headline: 'Welcome to the counter.',
            subcopy: 'Sign in to save your cart for next time.',
        },
        checkout: {
            headline: 'One last step.',
            subcopy: 'Sign in to complete your order.',
        },
    },
    signup: {
        default: {
            headline: 'Pull up a chair.',
            subcopy: 'Create an account to save your cart and order faster.',
        },
        checkout: {
            headline: 'Almost there.',
            subcopy: 'Create an account to complete your order.',
        },
    },
};

export default function LoginModal() {
    const { loginOpen, loginReason, closeLogin, signIn, signUp } = useAuth();

    const [mounted, setMounted] = useState(false);
    const [isExiting, setIsExiting] = useState(false);
    const [tab, setTab] = useState('login');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [error, setError] = useState(null);
    const [busy, setBusy] = useState(false);

    const tabsRef = useRef(null);
    const loginTabRef = useRef(null);
    const signupTabRef = useRef(null);
    const [underline, setUnderline] = useState({ left: 0, width: 0 });

    useEffect(() => {
        if (loginOpen) {
            setMounted(true);
            setIsExiting(false);
        } else if (mounted) {
            setIsExiting(true);
            const t = setTimeout(() => setMounted(false), 200);
            return () => clearTimeout(t);
        }
    }, [loginOpen, mounted]);

    useEffect(() => {
        const activeRef = tab === 'login' ? loginTabRef.current : signupTabRef.current;
        if (!activeRef || !tabsRef.current) return;
        const parentRect = tabsRef.current.getBoundingClientRect();
        const rect = activeRef.getBoundingClientRect();
        setUnderline({ left: rect.left - parentRect.left, width: rect.width });
    }, [tab, mounted]);

    if (!mounted) return null;

    const reasonKey = loginReason === 'checkout' ? 'checkout' : 'default';
    const { headline, subcopy } = COPY[tab][reasonKey];
    const overlayState = isExiting ? 'is-exiting' : 'is-entering';

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        setBusy(true);
        try {
            const { error: authError } = tab === 'login'
                ? await signIn(email, password)
                : await signUp(email, password, name);
            if (authError) setError(authError.message);
        } catch {
            setError('Could not reach auth server, please try again.');
        } finally {
            setBusy(false);
        }
    };

    return (
        <div
            className={`login-overlay ${overlayState}`}
            onClick={closeLogin}
            role="presentation"
        >
            <div
                className={`login-panel ${overlayState}`}
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-label={headline}
            >
                <button
                    className="login-close"
                    onClick={closeLogin}
                    aria-label="Close"
                    type="button"
                >
                    <span aria-hidden="true">×</span>
                </button>

                <div className="login-stagger">
                    <div className="login-eyebrow" style={{ '--i': 0 }}>
                        Brooklyn Bakery
                    </div>

                    <h2
                        className="login-headline"
                        style={{ '--i': 1 }}
                        key={`${tab}-${reasonKey}`}
                    >
                        {headline}
                    </h2>

                    <p className="login-subcopy" style={{ '--i': 2 }}>
                        {subcopy}
                    </p>

                    <div className="login-ornament" style={{ '--i': 3 }} aria-hidden="true">
                        <span className="login-rule" />
                        <span className="login-diamond" />
                        <span className="login-rule" />
                    </div>

                    <div
                        className="login-tabs"
                        ref={tabsRef}
                        style={{ '--i': 4 }}
                    >
                        <button
                            ref={loginTabRef}
                            type="button"
                            className={`login-tab ${tab === 'login' ? 'is-active' : ''}`}
                            onClick={() => { setTab('login'); setError(null); }}
                        >
                            Log in
                        </button>
                        <button
                            ref={signupTabRef}
                            type="button"
                            className={`login-tab ${tab === 'signup' ? 'is-active' : ''}`}
                            onClick={() => { setTab('signup'); setError(null); }}
                        >
                            Sign up
                        </button>
                        <span
                            className="login-tab-underline"
                            style={{
                                transform: `translateX(${underline.left}px)`,
                                width: `${underline.width}px`,
                            }}
                        />
                    </div>

                    <form className="login-form" onSubmit={handleSubmit}>
                        {tab === 'signup' && (
                            <label className="login-field" style={{ '--i': 4.5 }}>
                                <span className="login-label">Name</span>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    autoComplete="name"
                                    required
                                />
                            </label>
                        )}
                        <label className="login-field" style={{ '--i': 5 }}>
                            <span className="login-label">Email</span>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                autoComplete="email"
                            />
                        </label>
                        <label className="login-field" style={{ '--i': 6 }}>
                            <span className="login-label">Password</span>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
                                minLength={6}
                            />
                        </label>

                        {error && <div className="login-error" role="alert">{error}</div>}

                        <button
                            type="submit"
                            className="login-submit"
                            disabled={busy}
                            style={{ '--i': 7 }}
                        >
                            <span className="login-submit-label">
                                {busy
                                    ? 'One moment…'
                                    : (tab === 'login' ? 'Log in' : 'Create account')}
                            </span>
                            <span className="login-submit-arrow" aria-hidden="true">→</span>
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
