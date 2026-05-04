import test from 'node:test';
import assert from 'node:assert/strict';
import { parseProductSlug } from '../lib/slugUtils.js';

const VALID_UUID = 'af521793-1234-5678-abcd-123456789abc';
const HEX = 'af52179312345678abcd123456789abc'; // UUID with hyphens stripped

test('parseProductSlug: extracts UUID from well-formed slug', () => {
  assert.equal(parseProductSlug(`country-sourdough-loaf-${HEX}`), VALID_UUID);
});

test('parseProductSlug: works when name slug has numbers', () => {
  assert.equal(parseProductSlug(`product-42-${HEX}`), VALID_UUID);
});

test('parseProductSlug: returns null when slug is too short', () => {
  assert.equal(parseProductSlug('short'), null);
});

test('parseProductSlug: returns null when last 32 chars contain non-hex', () => {
  const badHex = 'zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz'; // 32 non-hex chars
  assert.equal(parseProductSlug(`some-product-${badHex}`), null);
});

test('parseProductSlug: returns null for non-string input', () => {
  assert.equal(parseProductSlug(null), null);
  assert.equal(parseProductSlug(undefined), null);
  assert.equal(parseProductSlug(42), null);
});

test('parseProductSlug: returns null for bare 32-char hex with no name prefix', () => {
  assert.equal(parseProductSlug(HEX), null);
});
