import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeDisplayName } from '../lib/displayName.js';

test('normalizeDisplayName: accepts a valid name and trims surrounding whitespace', () => {
    const result = normalizeDisplayName('  Jane Doe  ');
    assert.equal(result.ok, true);
    assert.equal(result.value, 'Jane Doe');
});

test('normalizeDisplayName: accepts a 1-char name', () => {
    const result = normalizeDisplayName('A');
    assert.equal(result.ok, true);
    assert.equal(result.value, 'A');
});

test('normalizeDisplayName: accepts a 50-char name (boundary)', () => {
    const fifty = 'a'.repeat(50);
    const result = normalizeDisplayName(fifty);
    assert.equal(result.ok, true);
    assert.equal(result.value, fifty);
});

test('normalizeDisplayName: accepts unicode characters', () => {
    const result = normalizeDisplayName('Renée Müller');
    assert.equal(result.ok, true);
    assert.equal(result.value, 'Renée Müller');
});

test('normalizeDisplayName: rejects empty string', () => {
    const result = normalizeDisplayName('');
    assert.equal(result.ok, false);
    assert.match(result.error, /empty|required/i);
});

test('normalizeDisplayName: rejects whitespace-only string', () => {
    const result = normalizeDisplayName('   \t  ');
    assert.equal(result.ok, false);
    assert.match(result.error, /empty|required/i);
});

test('normalizeDisplayName: rejects strings longer than 50 chars after trim', () => {
    const result = normalizeDisplayName('a'.repeat(51));
    assert.equal(result.ok, false);
    assert.match(result.error, /50/);
});

test('normalizeDisplayName: trims before checking length (51 with surrounding whitespace = 50 → ok)', () => {
    const result = normalizeDisplayName('  ' + 'a'.repeat(50) + '  ');
    assert.equal(result.ok, true);
    assert.equal(result.value.length, 50);
});

test('normalizeDisplayName: rejects non-string input', () => {
    for (const input of [undefined, null, 42, true, {}, []]) {
        const result = normalizeDisplayName(input);
        assert.equal(result.ok, false, `expected !ok for ${JSON.stringify(input)}`);
        assert.match(result.error, /string/i);
    }
});
