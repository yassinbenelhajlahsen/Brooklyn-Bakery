import { useEffect, useState } from 'react';
import { useAuth } from '../auth/useAuth.js';
import { COPY } from './loginModal.copy.js';
import { useLoginForm } from '../hooks/useLoginForm.js';
import { useTabUnderline } from '../hooks/useTabUnderline.js';

export default function LoginModal() {
    const { loginOpen, loginReason, closeLogin } = useAuth();

    const [mounted, setMounted] = useState(false);
    const [isExiting, setIsExiting] = useState(false);

    const {
        mode,
        setMode,
        email,
        setEmail,
        password,
        setPassword,
        fullName,
        setFullName,
        error,
        submitting,
        onSubmit,
    } = useLoginForm();

    const { parentRef, registerTab, underlineStyle } = useTabUnderline(mode, [mounted]);

    useEffect(() => {
        if (loginOpen) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setMounted(true);
            setIsExiting(false);
        } else if (mounted) {
            setIsExiting(true);
            const t = setTimeout(() => setMounted(false), 200);
            return () => clearTimeout(t);
        }
    }, [loginOpen, mounted]);

    if (!mounted) return null;

    const reasonKey = loginReason === 'checkout' ? 'checkout' : 'default';
    const { headline, subcopy } = COPY[mode][reasonKey];
    const overlayState = isExiting ? 'is-exiting' : 'is-entering';

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
                        key={`${mode}-${reasonKey}`}
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
                        ref={parentRef}
                        style={{ '--i': 4 }}
                    >
                        <button
                            ref={registerTab('login')}
                            type="button"
                            className={`login-tab ${mode === 'login' ? 'is-active' : ''}`}
                            onClick={() => setMode('login')}
                        >
                            Log in
                        </button>
                        <button
                            ref={registerTab('signup')}
                            type="button"
                            className={`login-tab ${mode === 'signup' ? 'is-active' : ''}`}
                            onClick={() => setMode('signup')}
                        >
                            Sign up
                        </button>
                        <span
                            className="login-tab-underline"
                            style={underlineStyle}
                        />
                    </div>

                    <form className="login-form" onSubmit={onSubmit}>
                        {mode === 'signup' && (
                            <label className="login-field" style={{ '--i': 4.5 }}>
                                <span className="login-label">Name</span>
                                <input
                                    type="text"
                                    value={fullName}
                                    onChange={(e) => setFullName(e.target.value)}
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
                                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                                minLength={6}
                            />
                        </label>

                        {error && <div className="login-error" role="alert">{error}</div>}

                        <button
                            type="submit"
                            className="login-submit"
                            disabled={submitting}
                            style={{ '--i': 7 }}
                        >
                            <span className="login-submit-label">
                                {submitting
                                    ? 'One moment…'
                                    : (mode === 'login' ? 'Log in' : 'Create account')}
                            </span>
                            <span className="login-submit-arrow" aria-hidden="true">→</span>
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
