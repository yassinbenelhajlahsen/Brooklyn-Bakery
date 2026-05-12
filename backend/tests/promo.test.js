import test from 'node:test';
import assert from 'node:assert/strict';
import { computePromoDiscount, normalizePromoCode } from '../services/promoService.js';

const cartItems = [
    { quantity: 2, product: { id: 'cookie-1', type: 'cookie', price: 10 } },
    { quantity: 1, product: { id: 'cake-1', type: 'cake', price: 25 } },
];

test('normalizePromoCode: trims and uppercases codes', () => {
    assert.equal(normalizePromoCode(' save10 '), 'SAVE10');
});

test('computePromoDiscount: applies storewide percent to the full cart', () => {
    const result = computePromoDiscount(cartItems, {
        scope: 'storewide',
        discountPercent: 20,
    });
    assert.deepEqual(result, { applicableSubtotal: 45, discountTotal: 9 });
});

test('computePromoDiscount: applies category percent only to matching items', () => {
    const result = computePromoDiscount(cartItems, {
        scope: 'category',
        productType: 'cookie',
        discountPercent: 50,
    });
    assert.deepEqual(result, { applicableSubtotal: 20, discountTotal: 10 });
});

test('computePromoDiscount: applies product percent only to matching product', () => {
    const result = computePromoDiscount(cartItems, {
        scope: 'product',
        productId: 'cake-1',
        discountPercent: 10,
    });
    assert.deepEqual(result, { applicableSubtotal: 25, discountTotal: 2 });
});
