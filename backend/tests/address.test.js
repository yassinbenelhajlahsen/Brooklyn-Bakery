import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeAddressInput, snapshotAddress } from '../lib/address.js';

test('normalizeAddressInput: accepts all six fields, trims whitespace, returns normalized value', () => {
    const result = normalizeAddressInput({
        line1: '  123 Main St  ',
        line2: ' Apt 4 ',
        city: ' Brooklyn ',
        state: 'NY ',
        postalCode: ' 11201',
        country: 'USA',
    });
    assert.equal(result.ok, true);
    assert.deepEqual(result.value, {
        line1: '123 Main St',
        line2: 'Apt 4',
        city: 'Brooklyn',
        state: 'NY',
        postalCode: '11201',
        country: 'USA',
    });
});

test('normalizeAddressInput: line2 missing is fine and becomes null', () => {
    const result = normalizeAddressInput({
        line1: '123 Main St',
        city: 'Brooklyn',
        state: 'NY',
        postalCode: '11201',
        country: 'USA',
    });
    assert.equal(result.ok, true);
    assert.equal(result.value.line2, null);
});

test('normalizeAddressInput: empty line2 string becomes null', () => {
    const result = normalizeAddressInput({
        line1: '123 Main St',
        line2: '   ',
        city: 'Brooklyn',
        state: 'NY',
        postalCode: '11201',
        country: 'USA',
    });
    assert.equal(result.ok, true);
    assert.equal(result.value.line2, null);
});

test('normalizeAddressInput: missing required field fails with field name', () => {
    const result = normalizeAddressInput({
        line1: '123 Main St',
        city: 'Brooklyn',
        state: 'NY',
        postalCode: '11201',
    });
    assert.equal(result.ok, false);
    assert.equal(result.field, 'country');
});

test('normalizeAddressInput: empty required field fails with field name', () => {
    const result = normalizeAddressInput({
        line1: '   ',
        city: 'Brooklyn',
        state: 'NY',
        postalCode: '11201',
        country: 'USA',
    });
    assert.equal(result.ok, false);
    assert.equal(result.field, 'line1');
});

test('normalizeAddressInput: non-string required field fails', () => {
    const result = normalizeAddressInput({
        line1: 123,
        city: 'Brooklyn',
        state: 'NY',
        postalCode: '11201',
        country: 'USA',
    });
    assert.equal(result.ok, false);
    assert.equal(result.field, 'line1');
});

test('normalizeAddressInput: partial mode allows subset, still trims and rejects empty', () => {
    const okPartial = normalizeAddressInput({ city: ' Queens ' }, { partial: true });
    assert.equal(okPartial.ok, true);
    assert.deepEqual(okPartial.value, { city: 'Queens' });

    const empty = normalizeAddressInput({ city: '  ' }, { partial: true });
    assert.equal(empty.ok, false);
    assert.equal(empty.field, 'city');
});

test('normalizeAddressInput: partial mode with empty line2 sets line2 to null', () => {
    const result = normalizeAddressInput({ line2: '   ' }, { partial: true });
    assert.equal(result.ok, true);
    assert.deepEqual(result.value, { line2: null });
});

test('normalizeAddressInput: unknown fields are ignored', () => {
    const result = normalizeAddressInput({
        line1: '123 Main St',
        city: 'Brooklyn',
        state: 'NY',
        postalCode: '11201',
        country: 'USA',
        evilField: 'boom',
    });
    assert.equal(result.ok, true);
    assert.equal(result.value.evilField, undefined);
});

test('snapshotAddress: maps address row to order shipping_* fields', () => {
    const snap = snapshotAddress({
        id: 'ignored',
        userId: 'ignored',
        line1: '123 Main St',
        line2: 'Apt 4',
        city: 'Brooklyn',
        state: 'NY',
        postalCode: '11201',
        country: 'USA',
    });
    assert.deepEqual(snap, {
        shippingLine1: '123 Main St',
        shippingLine2: 'Apt 4',
        shippingCity: 'Brooklyn',
        shippingState: 'NY',
        shippingPostalCode: '11201',
        shippingCountry: 'USA',
    });
});

test('snapshotAddress: preserves null line2', () => {
    const snap = snapshotAddress({
        line1: '123 Main St',
        line2: null,
        city: 'Brooklyn',
        state: 'NY',
        postalCode: '11201',
        country: 'USA',
    });
    assert.equal(snap.shippingLine2, null);
});
