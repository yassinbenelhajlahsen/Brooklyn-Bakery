import test from 'node:test';
import assert from 'node:assert/strict';
import {
    computeCredit,
    RATE_PER_SEC,
    BURST_BONUS,
    MAX_FIRST_WINDOW_MS,
} from '../lib/clickCredit.js';

const NOW = new Date('2026-04-21T12:00:00Z');

test('computeCredit: credits full delta when under the rate cap', () => {
    const result = computeCredit({
        delta: 5,
        elapsedMs: 1000,
        lastClickFlushAt: new Date(NOW.getTime() - 1000),
        now: NOW,
    });
    assert.equal(result.credited, 5);
});

test('computeCredit: caps delta silently when over the rate', () => {
    // 100ms elapsed → floor(100/1000)*30 + 20 = 0 + 20 = 20 max
    const result = computeCredit({
        delta: 5000,
        elapsedMs: 100,
        lastClickFlushAt: new Date(NOW.getTime() - 100),
        now: NOW,
    });
    assert.equal(result.credited, 20);
});

test('computeCredit: uses the smaller of client and server elapsed', () => {
    // Client claims 10s, server says 1s → use 1s. maxAllowed = 30 + 20 = 50.
    const result = computeCredit({
        delta: 1000,
        elapsedMs: 10_000,
        lastClickFlushAt: new Date(NOW.getTime() - 1000),
        now: NOW,
    });
    assert.equal(result.credited, 50);
});

test('computeCredit: uses client elapsed (clamped) when lastClickFlushAt is null', () => {
    // First flush ever: server trusts client up to MAX_FIRST_WINDOW_MS.
    const result = computeCredit({
        delta: 50,
        elapsedMs: 10_000,
        lastClickFlushAt: null,
        now: NOW,
    });
    // maxAllowed = floor(10_000/1000)*30 + 20 = 300 + 20 = 320. delta=50 passes.
    assert.equal(result.credited, 50);
});

test('computeCredit: clamps huge client elapsed to MAX_FIRST_WINDOW_MS on null lastClickFlushAt', () => {
    // Client claims 24h; clamp to 1h. maxAllowed = 3600*10 + 20 = 36_020.
    const result = computeCredit({
        delta: 1_000_000,
        elapsedMs: 86_400_000,
        lastClickFlushAt: null,
        now: NOW,
    });
    const expectedMax =
        Math.floor(MAX_FIRST_WINDOW_MS / 1000) * RATE_PER_SEC + BURST_BONUS;
    assert.equal(result.credited, expectedMax);
});

test('computeCredit: returns 0 credited for zero delta', () => {
    const result = computeCredit({
        delta: 0,
        elapsedMs: 1000,
        lastClickFlushAt: new Date(NOW.getTime() - 1000),
        now: NOW,
    });
    assert.equal(result.credited, 0);
});

test('computeCredit: throws on negative delta', () => {
    assert.throws(
        () =>
            computeCredit({
                delta: -1,
                elapsedMs: 1000,
                lastClickFlushAt: null,
                now: NOW,
            }),
        /delta/i,
    );
});

test('computeCredit: throws on non-integer delta', () => {
    assert.throws(
        () =>
            computeCredit({
                delta: 1.5,
                elapsedMs: 1000,
                lastClickFlushAt: null,
                now: NOW,
            }),
        /delta/i,
    );
});

test('computeCredit: throws on non-positive elapsedMs', () => {
    assert.throws(
        () =>
            computeCredit({
                delta: 5,
                elapsedMs: 0,
                lastClickFlushAt: null,
                now: NOW,
            }),
        /elapsed/i,
    );
});
