import { useEffect, useState } from 'react';
import clsx from 'clsx';
import { useAuth } from '../auth/useAuth.js';
import { COPY } from './loginModal.copy.js';
import { useLoginForm } from '../hooks/useLoginForm.js';
import { useTabUnderline } from '../hooks/useTabUnderline.js';
import Ornament from './Ornament.jsx';

const STAGGER_DELAY_STYLE = { animationDelay: 'calc(120ms + var(--i, 0) * 60ms)' };

const FIELD_CLS =
    "flex flex-col gap-1.5 relative " +
    "after:content-[''] after:absolute after:left-0 after:right-0 after:bottom-0 after:h-px after:bg-accent after:scale-x-0 after:origin-left after:transition-transform after:duration-[320ms] after:ease-rise after:pointer-events-none motion-reduce:after:transition-none " +
    "focus-within:after:scale-x-100 " +
    "[&>input]:bg-transparent [&>input]:border-none [&>input]:border-b [&>input]:border-line [&>input]:pt-2 [&>input]:pb-2.5 [&>input]:font-sans [&>input]:text-[16px] [&>input]:leading-[1.4] [&>input]:text-ink [&>input]:transition-[border-color] [&>input]:duration-[220ms] [&>input]:ease-in-out [&>input::placeholder]:text-muted [&>input:focus]:outline-none";

const TAB_BASE =
    "bg-none border-none pt-2 px-0.5 pb-3 font-sans text-[13px] tracking-[0.08em] uppercase cursor-pointer transition-[color] duration-[220ms] ease-in-out";

const LABEL_CLS =
    "font-sans text-[11px] tracking-[0.14em] uppercase text-muted";

const SUBMIT_BTN = clsx(
    "group relative mt-2 px-5 py-3.5 bg-accent text-surface border-none rounded-[2px]",
    "font-sans font-medium text-[14px] leading-[1] tracking-[0.08em] uppercase",
    "flex items-center justify-center gap-2.5 cursor-pointer overflow-hidden",
    "shadow-[0_1px_0_rgba(0,0,0,0.06)]",
    "[transition:transform_220ms_var(--ease-rise),background-color_220ms_ease,box-shadow_220ms_ease]",
    "before:content-[''] before:absolute before:inset-0 before:[background-image:var(--gradient-submit-shine)]",
    "before:-translate-x-full before:transition-transform before:duration-[620ms] before:ease-rise before:pointer-events-none",
    "[&:hover:not(:disabled)]:bg-accent-dark [&:hover:not(:disabled)]:-translate-y-px",
    "[&:hover:not(:disabled)]:shadow-submit-hover",
    "[&:hover:not(:disabled)]:before:translate-x-full",
    "[&:active:not(:disabled)]:translate-y-0 [&:active:not(:disabled)]:duration-[80ms]",
    "focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-[3px]",
    "disabled:opacity-[0.55] disabled:cursor-not-allowed",
    "motion-reduce:transition-none motion-reduce:before:transition-none",
);

const CLOSE_BTN = clsx(
    "absolute top-4 right-4 w-8 h-8 grid place-items-center bg-none border-none rounded-full",
    "text-muted text-[22px] leading-none cursor-pointer",
    "[transition:transform_220ms_var(--ease-rise),color_180ms_ease,background-color_180ms_ease]",
    "hover:text-ink hover:bg-cream hover:rotate-90",
    "focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2",
    "motion-reduce:transition-none",
);

function StaggerItem({ as: Tag = 'div', index, isExiting, variant = 'rise', className, style, ...rest }) {
    const anim = !isExiting && (variant === 'headline' ? 'animate-login-headline-in' : 'animate-login-rise');
    return (
        <Tag
            className={clsx(anim, 'motion-reduce:animate-none', className)}
            style={{ '--i': index, ...STAGGER_DELAY_STYLE, ...style }}
            {...rest}
        />
    );
}

function Field({ label, ...inputProps }) {
    return (
        <label className={FIELD_CLS}>
            <span className={LABEL_CLS}>{label}</span>
            <input {...inputProps} />
        </label>
    );
}

function Tab({ tabRef, active, onClick, children }) {
    return (
        <button
            ref={tabRef}
            type="button"
            className={clsx(TAB_BASE, active ? 'text-ink' : 'text-muted hover:text-ink')}
            onClick={onClick}
        >
            {children}
        </button>
    );
}

function SubmitButton({ submitting, children }) {
    return (
        <button type="submit" className={SUBMIT_BTN} disabled={submitting}>
            <span>{submitting ? 'One moment…' : children}</span>
            <span
                className="inline-block transition-transform duration-[260ms] ease-rise group-[:hover:not(:disabled)]:translate-x-[3px] motion-reduce:transition-none"
                aria-hidden="true"
            >→</span>
        </button>
    );
}

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

    return (
        <div
            className={clsx(
                "fixed inset-0 bg-ink/55 flex items-center justify-center z-[1000] p-6 motion-reduce:animate-none",
                isExiting ? 'animate-login-overlay-out' : 'animate-login-overlay-in',
            )}
            onClick={closeLogin}
            role="presentation"
        >
            <div
                className={clsx(
                    "relative bg-surface border border-line rounded-[4px] px-14 pt-14 pb-12 w-full max-w-[440px]",
                    "shadow-login-panel",
                    "max-[480px]:px-7 max-[480px]:pt-10 max-[480px]:pb-8 max-[480px]:max-w-full",
                    "motion-reduce:animate-none",
                    isExiting ? 'animate-login-panel-out' : 'animate-login-panel-in',
                )}
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-label={headline}
            >
                <button className={CLOSE_BTN} onClick={closeLogin} aria-label="Close" type="button">
                    <span aria-hidden="true">×</span>
                </button>

                <div>
                    <StaggerItem
                        index={0}
                        isExiting={isExiting}
                        className="font-sans text-[11px] tracking-[0.22em] uppercase text-muted text-center mb-[18px]"
                    >
                        Brooklyn Bakery
                    </StaggerItem>

                    <StaggerItem
                        as="h2"
                        index={1}
                        isExiting={isExiting}
                        variant="headline"
                        key={`${mode}-${reasonKey}`}
                        className="font-display font-normal text-[34px] leading-[1.1] tracking-[-0.015em] text-ink text-center m-0 mb-2.5 [font-variation-settings:'opsz'_48] max-[480px]:text-[28px]"
                    >
                        {headline}
                    </StaggerItem>

                    <StaggerItem
                        as="p"
                        index={2}
                        isExiting={isExiting}
                        className="font-display italic font-light text-[14.5px] leading-[1.5] text-muted text-center max-w-[30ch] mx-auto"
                    >
                        {subcopy}
                    </StaggerItem>

                    <StaggerItem
                        as={Ornament}
                        index={3}
                        isExiting={isExiting}
                        className="mt-6 mb-5"
                    />

                    <StaggerItem
                        index={4}
                        isExiting={isExiting}
                        className="relative flex justify-center gap-7 mb-[22px] border-b border-line"
                        ref={parentRef}
                    >
                        <Tab tabRef={registerTab('login')} active={mode === 'login'} onClick={() => setMode('login')}>
                            Log in
                        </Tab>
                        <Tab tabRef={registerTab('signup')} active={mode === 'signup'} onClick={() => setMode('signup')}>
                            Sign up
                        </Tab>
                        <span
                            className="absolute -bottom-px left-0 h-0.5 bg-accent pointer-events-none transition-[transform,width] duration-[320ms] ease-rise motion-reduce:transition-none"
                            style={underlineStyle}
                        />
                    </StaggerItem>

                    <StaggerItem
                        as="form"
                        isExiting={isExiting}
                        className="flex flex-col gap-[18px]"
                        onSubmit={onSubmit}
                    >
                        {mode === 'signup' && (
                            <Field
                                label="Name"
                                type="text"
                                value={fullName}
                                onChange={(e) => setFullName(e.target.value)}
                                autoComplete="name"
                                required
                            />
                        )}
                        <Field
                            label="Email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            autoComplete="email"
                        />
                        <Field
                            label="Password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                            minLength={6}
                        />

                        {error && (
                            <div
                                className="font-sans text-[13px] text-danger px-3 py-2.5 border-l-2 border-danger bg-danger/5 animate-login-rise-quick motion-reduce:animate-none"
                                role="alert"
                            >
                                {error}
                            </div>
                        )}

                        <SubmitButton submitting={submitting}>
                            {mode === 'login' ? 'Log in' : 'Create account'}
                        </SubmitButton>
                    </StaggerItem>
                </div>
            </div>
        </div>
    );
}
