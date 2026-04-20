import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeCartItems, computeCartTotal } from '../lib/cart.js';

test('mergeCartItems: adds incoming quantities to existing quantities', () => {
    const existing = [
        { productId: 'a', quantity: 2 },
        { productId: 'b', quantity: 1 },
    ];
    const incoming = [
        { productId: 'a', quantity: 3 },
        { productId: 'c', quantity: 5 },
    ];
    const merged = mergeCartItems(existing, incoming);
    assert.deepEqual(
        merged.sort((x, y) => x.productId.localeCompare(y.productId)),
        [
            { productId: 'a', quantity: 5 },
            { productId: 'b', quantity: 1 },
            { productId: 'c', quantity: 5 },
        ],
    );
});

test('mergeCartItems: drops invalid items (non-positive qty, missing id)', () => {
    const merged = mergeCartItems([], [
        { productId: 'a', quantity: 0 },
        { productId: 'b', quantity: -1 },
        { productId: '', quantity: 1 },
        { quantity: 1 },
        { productId: 'c', quantity: 2 },
    ]);
    assert.deepEqual(merged, [{ productId: 'c', quantity: 2 }]);
});

test('computeCartTotal: sums quantity * price across items', () => {
    const items = [
        { productId: 'a', quantity: 2 },
        { productId: 'b', quantity: 3 },
    ];
    const priceByProductId = { a: 5, b: 4 };
    assert.equal(computeCartTotal(items, priceByProductId), 2 * 5 + 3 * 4);
});

test('computeCartTotal: throws when a price is missing', () => {
    assert.throws(
        () => computeCartTotal([{ productId: 'a', quantity: 1 }], {}),
        /missing price/i,
    );
});
