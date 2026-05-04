import test from 'node:test';
import assert from 'node:assert/strict';
import { parsePagination } from '../lib/pagination.js';

test('parsePagination: defaults to take=10, skip=0 when params absent', () => {
    assert.deepEqual(parsePagination({}), { take: 10, skip: 0 });
});

test('parsePagination: parses valid string-encoded integers', () => {
    assert.deepEqual(parsePagination({ take: '5', skip: '20' }), { take: 5, skip: 20 });
});

test('parsePagination: clamps take above 50 silently', () => {
    assert.deepEqual(parsePagination({ take: '999' }), { take: 50, skip: 0 });
});

test('parsePagination: rejects take=0', () => {
    assert.throws(() => parsePagination({ take: '0' }), /invalid take/i);
});

test('parsePagination: rejects negative take', () => {
    assert.throws(() => parsePagination({ take: '-1' }), /invalid take/i);
});

test('parsePagination: rejects non-integer take', () => {
    assert.throws(() => parsePagination({ take: '1.5' }), /invalid take/i);
    assert.throws(() => parsePagination({ take: 'abc' }), /invalid take/i);
});

test('parsePagination: rejects negative skip', () => {
    assert.throws(() => parsePagination({ skip: '-1' }), /invalid skip/i);
});

test('parsePagination: rejects non-integer skip', () => {
    assert.throws(() => parsePagination({ skip: '1.5' }), /invalid skip/i);
    assert.throws(() => parsePagination({ skip: 'xyz' }), /invalid skip/i);
});

test('parsePagination: skip=0 is allowed', () => {
    assert.deepEqual(parsePagination({ skip: '0' }), { take: 10, skip: 0 });
});

test('parsePagination: thrown errors carry status 400', () => {
    try {
        parsePagination({ take: '0' });
        assert.fail('should have thrown');
    } catch (err) {
        assert.equal(err.http, 400);
    }
});
