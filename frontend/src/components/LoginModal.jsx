import { useState } from 'react';
import { useAuth } from '../auth/useAuth.js';

export default function LoginModal() {
    const { loginOpen, closeLogin, signIn, signUp } = useAuth();
    const [tab, setTab] = useState('login');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState(null);
    const [busy, setBusy] = useState(false);

    if (!loginOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        setBusy(true);
        try {
            const { error } = tab === 'login'
                ? await signIn(email, password)
                : await signUp(email, password);
            if (error) setError(error.message);
            // On success, onAuthStateChange will update user and the
            // pendingCheckout effect (if any) will close this modal.
        } catch (err) {
            setError('Could not reach auth server, please try again.');
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="login-overlay" onClick={closeLogin} role="presentation">
            <div
                className="login-modal"
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-label={tab === 'login' ? 'Log in' : 'Sign up'}
            >
                <button className="icon-btn login-close" onClick={closeLogin} aria-label="Close">×</button>
                <div className="login-tabs">
                    <button
                        className={`login-tab ${tab === 'login' ? 'is-active' : ''}`}
                        onClick={() => { setTab('login'); setError(null); }}
                    >
                        Log in
                    </button>
                    <button
                        className={`login-tab ${tab === 'signup' ? 'is-active' : ''}`}
                        onClick={() => { setTab('signup'); setError(null); }}
                    >
                        Sign up
                    </button>
                </div>
                <form className="login-form" onSubmit={handleSubmit}>
                    <label>
                        Email
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            autoComplete="email"
                        />
                    </label>
                    <label>
                        Password
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
                            minLength={6}
                        />
                    </label>
                    {error && <div className="login-error">{error}</div>}
                    <button type="submit" className="login-submit" disabled={busy}>
                        {busy ? '...' : (tab === 'login' ? 'Log in' : 'Create account')}
                    </button>
                </form>
            </div>
        </div>
    );
}
