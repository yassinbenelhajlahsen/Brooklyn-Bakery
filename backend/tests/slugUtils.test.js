import test from 'node:test';
import assert from 'node:assert/strict';
import { toNameSlug, disambiguateSlug } from '../lib/slugUtils.js';

test('toNameSlug: converts name to kebab case', () => {
  assert.equal(toNameSlug('Country Sourdough Loaf'), 'country-sourdough-loaf');
});

test('toNameSlug: strips special characters', () => {
  assert.equal(toNameSlug('Olive & Rosemary Focaccia'), 'olive-rosemary-focaccia');
});

test('toNameSlug: strips leading and trailing hyphens', () => {
  assert.equal(toNameSlug("  Honey Whole Wheat  "), 'honey-whole-wheat');
});

test('disambiguateSlug: appends first 8 chars of id', () => {
  assert.equal(
    disambiguateSlug('almond-croissant', 'c2e2920f-0000-0000-0000-000000000000'),
    'almond-croissant-c2e2920f',
  );
});
