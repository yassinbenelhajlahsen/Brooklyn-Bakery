import test from 'node:test';
import assert from 'node:assert/strict';
import { toNameSlug, findProductBySlug } from '../lib/slugUtils.js';

const P1 = { id: 'a0c0708f-ecd9-4639-9b5c-0b3d4624520d', name: 'Almond Croissant' };
const P2 = { id: 'b1d1819e-0000-0000-0000-000000000000', name: 'Chocolate Croissant' };
const P3 = { id: 'c2e2920f-0000-0000-0000-000000000000', name: 'Almond Croissant' };

test('toNameSlug: converts name to kebab case', () => {
  assert.equal(toNameSlug('Country Sourdough Loaf'), 'country-sourdough-loaf');
});

test('toNameSlug: strips special characters', () => {
  assert.equal(toNameSlug('Olive & Rosemary Focaccia'), 'olive-rosemary-focaccia');
});

test('toNameSlug: strips leading and trailing hyphens', () => {
  assert.equal(toNameSlug("  Honey Whole Wheat  "), 'honey-whole-wheat');
});

test('findProductBySlug: finds unique product by name slug', () => {
  const result = findProductBySlug('almond-croissant', [P1, P2]);
  assert.equal(result.id, P1.id);
});

test('findProductBySlug: finds duplicate product by UUID prefix suffix', () => {
  const result = findProductBySlug('almond-croissant-c2e2920f', [P1, P2, P3]);
  assert.equal(result.id, P3.id);
});

test('findProductBySlug: prefers name match over prefix match when slug is ambiguous', () => {
  // P4 name slug is exactly 'product-a0c0708f' — name match wins over treating 'a0c0708f' as prefix
  const P4 = { id: 'ffffffff-0000-0000-0000-000000000000', name: 'Product A0c0708f' };
  const result = findProductBySlug('product-a0c0708f', [P1, P4]);
  assert.equal(result.id, P4.id);
});

test('findProductBySlug: returns null for unknown slug', () => {
  assert.equal(findProductBySlug('unknown-product', [P1, P2]), null);
});

test('findProductBySlug: returns null for empty products list', () => {
  assert.equal(findProductBySlug('almond-croissant', []), null);
});
