import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildProductWhere,
  normalizeSearch,
  scoreProductMatch,
} from '../lib/products.js';

const COOKIE = {
  name: 'Chocolate Chip Cookie',
  description: 'A classic treat with chocolate chunks.',
};
const BAGEL_WITH_COOKIE_DESC = {
  name: 'Sesame Bagel',
  description: 'Hand-rolled bagel topped with cookie crumbs.',
};
const PLAIN_BAGEL = {
  name: 'Plain Bagel',
  description: 'Just a bagel.',
};

test('normalizeSearch: returns empty string for undefined/null/non-string', () => {
  assert.equal(normalizeSearch(undefined), '');
  assert.equal(normalizeSearch(null), '');
  assert.equal(normalizeSearch(42), '');
});

test('normalizeSearch: trims whitespace', () => {
  assert.equal(normalizeSearch('  cookie  '), 'cookie');
  assert.equal(normalizeSearch('   '), '');
});

test('buildProductWhere: returns base filter when search is empty', () => {
  assert.deepEqual(buildProductWhere(''), { archivedAt: null });
  assert.deepEqual(buildProductWhere(undefined), { archivedAt: null });
  assert.deepEqual(buildProductWhere('   '), { archivedAt: null });
});

test('buildProductWhere: builds OR over name + description (case-insensitive)', () => {
  const where = buildProductWhere('cookie');
  assert.deepEqual(where, {
    archivedAt: null,
    OR: [
      { name: { contains: 'cookie', mode: 'insensitive' } },
      { description: { contains: 'cookie', mode: 'insensitive' } },
    ],
  });
});

test('buildProductWhere: trims search term before building where', () => {
  const where = buildProductWhere('  cookie  ');
  assert.equal(where.OR[0].name.contains, 'cookie');
});

test('scoreProductMatch: returns null for empty/whitespace search', () => {
  assert.equal(scoreProductMatch(COOKIE, ''), null);
  assert.equal(scoreProductMatch(COOKIE, '   '), null);
  assert.equal(scoreProductMatch(COOKIE, undefined), null);
});

test('scoreProductMatch: returns 2 when name matches', () => {
  assert.equal(scoreProductMatch(COOKIE, 'cookie'), 2);
});

test('scoreProductMatch: returns 1 when only description matches', () => {
  assert.equal(scoreProductMatch(BAGEL_WITH_COOKIE_DESC, 'cookie'), 1);
});

test('scoreProductMatch: name match wins when both match', () => {
  const both = { name: 'Cookie Box', description: 'A box of cookie chunks.' };
  assert.equal(scoreProductMatch(both, 'cookie'), 2);
});

test('scoreProductMatch: case-insensitive', () => {
  assert.equal(scoreProductMatch(COOKIE, 'COOKIE'), 2);
  assert.equal(scoreProductMatch(COOKIE, 'CoOkIe'), 2);
});

test('scoreProductMatch: returns null when neither matches', () => {
  assert.equal(scoreProductMatch(PLAIN_BAGEL, 'cookie'), null);
});
