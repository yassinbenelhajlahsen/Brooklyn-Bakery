import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../auth/useAuth.js';

const API_BASE = import.meta.env.VITE_BACKEND_URL ?? 'http://127.0.0.1:3000';
const GUEST_KEY = 'bb:guestClicks';
const FLUSH_INTERVAL_MS = 5000;
const THRESHOLD = 50;
const CLICKS_PER_SEC = 10;

function readGuestClicks() {
    try {
        const raw = localStorage.getItem(GUEST_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (
            !parsed ||
            !Number.isInteger(parsed.pending) ||
            parsed.pending <= 0 ||
            !Number.isFinite(parsed.firstClickAt)
        ) {
            return null;
        }
        return parsed;
    } catch {
        return null;
    }
}

function writeGuestClicks(pending, firstClickAt) {
    try {
        if (pending <= 0) {
            localStorage.removeItem(GUEST_KEY);
        } else {
            localStorage.setItem(
                GUEST_KEY,
                JSON.stringify({ pending, firstClickAt }),
            );
        }
    } catch {
        // localStorage unavailable (Safari private mode). Fall back to in-memory only.
    }
}

export function useCookieClicker(pointsRuleRef) {
    const internalRuleRef = useRef({ num: 1, den: 1 });
    const ruleRef = pointsRuleRef ?? internalRuleRef;

    const { session, profile, authedFetch, refreshProfile, ready, user } = useAuth();
    const accessToken = session?.access_token ?? null;
    const isAuthenticated = Boolean(accessToken);
    // Auth not yet initialized, or authed but the first profile fetch hasn't
    // landed — without this flag the UI renders logged-out defaults (0 points,
    // generic heading, login hint) for a frame before settling.
    const loading = !ready || (isAuthenticated && profile === null);

    const pendingRef = useRef(0);
    const inFlightRef = useRef(0); // pending points being POSTed; kept in displayPoints so the counter doesn't dip during the round-trip
    const windowStartRef = useRef(null); // performance.now() of the first click in the current authenticated flush window
    const guestFirstClickAtRef = useRef(null); // wall-clock Date.now() of first guest click
    const clickTimesRef = useRef([]);
    /** Fractional points carry for rationals like 3/2 per physical click. */
    const pointsFractionAccRef = useRef(0);
    const lastPointsRuleRef = useRef({ num: 1, den: 1 });
    const tokenRef = useRef(accessToken);
    const prevTokenRef = useRef(accessToken);
    const flushingRef = useRef(false);
    const guestWriteTimerRef = useRef(null);
    const [, setTick] = useState(0);

    const rerender = useCallback(() => setTick((t) => t + 1), []);

    useEffect(() => {
        tokenRef.current = accessToken;
    }, [accessToken]);

    // Hydrate guest state from localStorage on mount (only while unauthenticated).
    useEffect(() => {
        if (isAuthenticated) return;
        const saved = readGuestClicks();
        if (saved) {
            pendingRef.current = saved.pending;
            guestFirstClickAtRef.current = saved.firstClickAt;
            rerender();
        }
    }, [isAuthenticated, rerender]);

    const scheduleGuestWrite = useCallback(() => {
        if (guestWriteTimerRef.current) return;
        guestWriteTimerRef.current = setTimeout(() => {
            guestWriteTimerRef.current = null;
            writeGuestClicks(
                pendingRef.current,
                guestFirstClickAtRef.current ?? Date.now(),
            );
        }, 500);
    }, []);

    const doFlush = useCallback(
        async ({ keepalive = false } = {}) => {
            if (pendingRef.current === 0) return;
            if (!isAuthenticated || !accessToken) return;
            if (flushingRef.current) return;

            const delta = pendingRef.current;
            const elapsedMs = Math.max(
                1,
                Math.round(performance.now() - (windowStartRef.current ?? performance.now())),
            );

            // Move pending → in-flight so displayPoints stays at balance + pending + inFlight
            // during the round-trip. Without this, the counter visibly dips to balance until
            // refreshProfile lands the new balance.
            inFlightRef.current = delta;
            pendingRef.current = 0;
            windowStartRef.current = null;
            rerender();

            flushingRef.current = true;
            try {
                const res = await authedFetch('/me/clicks', {
                    method: 'POST',
                    body: JSON.stringify({ delta, elapsedMs }),
                    keepalive,
                });
                if (res.ok) {
                    await refreshProfile();
                    inFlightRef.current = 0;
                    rerender();
                } else {
                    // Return the flushed clicks to pending so the next interval retries.
                    pendingRef.current += inFlightRef.current;
                    inFlightRef.current = 0;
                    if (pendingRef.current > 0 && windowStartRef.current == null) {
                        windowStartRef.current = performance.now();
                    }
                    rerender();
                }
            } catch {
                pendingRef.current += inFlightRef.current;
                inFlightRef.current = 0;
                if (pendingRef.current > 0 && windowStartRef.current == null) {
                    windowStartRef.current = performance.now();
                }
                rerender();
            } finally {
                flushingRef.current = false;
            }
        },
        [accessToken, authedFetch, isAuthenticated, refreshProfile, rerender],
    );

    // Guest → authenticated migration, and logout flush.
    useEffect(() => {
        const prevToken = prevTokenRef.current;
        prevTokenRef.current = accessToken;

        // Logout: use the previous token to flush before it's gone.
        if (prevToken && !accessToken && pendingRef.current > 0) {
            const delta = pendingRef.current;
            const elapsedMs = Math.max(
                1,
                Math.round(
                    performance.now() - (windowStartRef.current ?? performance.now()),
                ),
            );
            pendingRef.current = 0;
            windowStartRef.current = null;
            rerender();
            // Raw fetch with the pre-transition token; keepalive so it survives unload.
            fetch(`${API_BASE}/me/clicks`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${prevToken}`,
                },
                body: JSON.stringify({ delta, elapsedMs }),
                keepalive: true,
            }).catch(() => {});
            return;
        }

        // Login: migrate guest clicks if any.
        if (!prevToken && accessToken) {
            const guest = readGuestClicks();
            if (!guest) return;
            const elapsedMs = Math.max(1, Date.now() - guest.firstClickAt);
            // Use authedFetch — token is now set.
            authedFetch('/me/clicks', {
                method: 'POST',
                body: JSON.stringify({ delta: guest.pending, elapsedMs }),
            })
                .then((res) => {
                    if (res.ok) {
                        writeGuestClicks(0, 0); // removes key
                        pendingRef.current = 0;
                        guestFirstClickAtRef.current = null;
                        rerender();
                        refreshProfile();
                    }
                })
                .catch(() => {});
        }
    }, [accessToken, authedFetch, refreshProfile, rerender]);

    // Mount-time retry: if we're authenticated but still have guest clicks in
    // localStorage (e.g. a previous migration attempt failed), try once per
    // auth session to migrate them. The transition-based effect above handles
    // the normal login case; this one catches the stranded case.
    useEffect(() => {
        if (!accessToken) return;
        const guest = readGuestClicks();
        if (!guest) return;
        const elapsedMs = Math.max(1, Date.now() - guest.firstClickAt);
        authedFetch('/me/clicks', {
            method: 'POST',
            body: JSON.stringify({ delta: guest.pending, elapsedMs }),
        })
            .then((res) => {
                if (res.ok) {
                    writeGuestClicks(0, 0);
                    pendingRef.current = 0;
                    guestFirstClickAtRef.current = null;
                    rerender();
                    refreshProfile();
                }
            })
            .catch(() => {});
    }, [accessToken, authedFetch, refreshProfile, rerender]);

    // 5s flush interval + page-hide flush (only while authenticated).
    useEffect(() => {
        if (!isAuthenticated) return;

        const interval = setInterval(() => {
            doFlush();
        }, FLUSH_INTERVAL_MS);

        const onHide = () => {
            if (document.visibilityState === 'hidden') {
                doFlush({ keepalive: true });
            }
        };
        const onPageHide = () => doFlush({ keepalive: true });

        document.addEventListener('visibilitychange', onHide);
        window.addEventListener('pagehide', onPageHide);

        return () => {
            clearInterval(interval);
            document.removeEventListener('visibilitychange', onHide);
            window.removeEventListener('pagehide', onPageHide);
        };
    }, [isAuthenticated, doFlush]);

    // Clear the guest-debounce timer on unmount so it doesn't fire with stale refs.
    useEffect(() => {
        return () => {
            if (guestWriteTimerRef.current) {
                clearTimeout(guestWriteTimerRef.current);
                guestWriteTimerRef.current = null;
            }
        };
    }, []);

    const handleClick = useCallback(() => {
        const nowPerf = performance.now();

        // Client-side throttle: prune to the last 1000ms, drop if >= 10.
        const times = clickTimesRef.current;
        while (times.length && nowPerf - times[0] > 1000) {
            times.shift();
        }
        if (times.length >= CLICKS_PER_SEC) return false;
        times.push(nowPerf);

        const { num, den } = ruleRef.current;
        if (
            num !== lastPointsRuleRef.current.num ||
            den !== lastPointsRuleRef.current.den
        ) {
            pointsFractionAccRef.current = 0;
            lastPointsRuleRef.current = { num, den };
        }
        pointsFractionAccRef.current += num;
        const wholePoints = Math.floor(pointsFractionAccRef.current / den);
        pointsFractionAccRef.current %= den;

        if (pendingRef.current === 0) {
            windowStartRef.current = nowPerf;
        }
        pendingRef.current += wholePoints;

        if (!isAuthenticated) {
            if (guestFirstClickAtRef.current == null) {
                guestFirstClickAtRef.current = Date.now();
            }
            scheduleGuestWrite();
        } else if (pendingRef.current >= THRESHOLD) {
            doFlush();
        }

        rerender();
        return true;
    }, [doFlush, isAuthenticated, rerender, scheduleGuestWrite, ruleRef]);

    const displayPoints = isAuthenticated
        ? (profile?.balance ?? 0) + pendingRef.current + inFlightRef.current
        : pendingRef.current;

    return {
        displayPoints,
        handleClick,
        isAuthenticated,
        displayName: profile?.displayName ?? null,
        loading,
        user,
        profile
    };
}
