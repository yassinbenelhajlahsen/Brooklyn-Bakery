import test from 'node:test';
import assert from 'node:assert/strict';
import { httpCache } from '../middleware/httpCache.js';

function mockReqRes() {
  const headers = {};
  const res = {
    setHeader(name, value) { headers[name] = value; },
    getHeader(name) { return headers[name]; },
  };
  return { req: {}, res, headers };
}

test('httpCache: sets public max-age directive', () => {
  const { req, res, headers } = mockReqRes();
  let nextCalled = false;
  httpCache({ maxAge: 60 })(req, res, () => { nextCalled = true; });
  assert.equal(headers['Cache-Control'], 'public, max-age=60');
  assert.equal(nextCalled, true);
});

test('httpCache: includes stale-while-revalidate when swr > 0', () => {
  const { req, res, headers } = mockReqRes();
  httpCache({ maxAge: 60, swr: 300 })(req, res, () => {});
  assert.equal(
    headers['Cache-Control'],
    'public, max-age=60, stale-while-revalidate=300'
  );
});

test('httpCache: omits stale-while-revalidate when swr is 0 or missing', () => {
  const { req, res, headers } = mockReqRes();
  httpCache({ maxAge: 30, swr: 0 })(req, res, () => {});
  assert.equal(headers['Cache-Control'], 'public, max-age=30');
});

test('httpCache: respects scope option', () => {
  const { req, res, headers } = mockReqRes();
  httpCache({ maxAge: 60, scope: 'private' })(req, res, () => {});
  assert.equal(headers['Cache-Control'], 'private, max-age=60');
});

test('httpCache: applies defaults when called with empty options', () => {
  const { req, res, headers } = mockReqRes();
  httpCache({})(req, res, () => {});
  assert.equal(headers['Cache-Control'], 'public, max-age=60');
});
