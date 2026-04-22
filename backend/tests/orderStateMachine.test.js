import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveTransition, checkReturnWindow } from '../services/orderStateMachine.js';

test('resolveTransition: valid user cancel from confirmed', () => {
  const entry = resolveTransition('confirmed', 'cancel', 'user');
  assert.equal(entry.to, 'cancelled');
  assert.equal(entry.refundPoints, true);
  assert.equal(entry.restoreStock, true);
});

test('resolveTransition: valid admin setShipped from processing', () => {
  const entry = resolveTransition('processing', 'setShipped', 'admin');
  assert.equal(entry.to, 'shipped');
  assert.equal(entry.refundPoints, false);
});

test('resolveTransition: forceCancel from shipped is NOT allowed (removed path)', () => {
  assert.throws(
    () => resolveTransition('shipped', 'forceCancel', 'admin'),
    (err) => err.http === 409,
  );
});

test('resolveTransition: wrong actor is 403', () => {
  assert.throws(
    () => resolveTransition('confirmed', 'setProcessing', 'user'),
    (err) => err.http === 403,
  );
});

test('resolveTransition: terminal status (cancelled) has no outgoing transitions', () => {
  assert.throws(
    () => resolveTransition('cancelled', 'setProcessing', 'admin'),
    (err) => err.http === 409,
  );
});

test('resolveTransition: unknown action is 409', () => {
  assert.throws(
    () => resolveTransition('confirmed', 'doesNotExist', 'admin'),
    (err) => err.http === 409,
  );
});

test('resolveTransition: denyCancel from cancel_requested returns to processing and requires reason', () => {
  const entry = resolveTransition('cancel_requested', 'denyCancel', 'admin');
  assert.equal(entry.to, 'processing');
  assert.equal(entry.requiresReason, true);
});

test('resolveTransition: approveReturn refunds but does NOT restore stock', () => {
  const entry = resolveTransition('return_requested', 'approveReturn', 'admin');
  assert.equal(entry.to, 'returned');
  assert.equal(entry.refundPoints, true);
  assert.equal(entry.restoreStock, false);
});

test('checkReturnWindow: within 48h returns true', () => {
  const now = new Date('2026-04-22T12:00:00Z');
  const deliveredAt = new Date('2026-04-21T12:00:00Z'); // 24h earlier
  assert.equal(checkReturnWindow(deliveredAt, now), true);
});

test('checkReturnWindow: beyond 48h returns false', () => {
  const now = new Date('2026-04-25T12:00:00Z');
  const deliveredAt = new Date('2026-04-22T00:00:00Z'); // 84h earlier
  assert.equal(checkReturnWindow(deliveredAt, now), false);
});

test('checkReturnWindow: exactly 48h returns true (inclusive)', () => {
  const now = new Date('2026-04-22T12:00:00Z');
  const deliveredAt = new Date('2026-04-20T12:00:00Z');
  assert.equal(checkReturnWindow(deliveredAt, now), true);
});

test('checkReturnWindow: null deliveredAt returns false', () => {
  const now = new Date('2026-04-22T12:00:00Z');
  assert.equal(checkReturnWindow(null, now), false);
});
