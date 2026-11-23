import test from 'node:test';
import assert from 'node:assert/strict';
import {
  authorizeGeneration,
  confirmFreeConsumed,
  releaseReservation,
  redeemActivationCode,
  generateActivationCodes,
  hashActivationCode,
  normalizeActivationCode,
} from '../app/api/generate/access.mjs';

const SALT = 'test-salt-with-at-least-32-characters!!';

// In-memory document store with serialized transactions, mirroring the
// Firestore adapter's semantics for the paths access.mjs uses.
function createStore() {
  const docs = new Map();
  let queue = Promise.resolve();
  return {
    docs,
    runTransaction(fn) {
      const run = queue.then(async () => {
        const pending = new Map();
        const tx = {
          get: async path => (pending.has(path) ? pending.get(path) : docs.get(path) ?? null),
          set: (path, value) => pending.set(path, value),
        };
        const result = await fn(tx);
        for (const [path, value] of pending) docs.set(path, value);
        return result;
      });
      queue = run.catch(() => {});
      return run;
    },
  };
}

const freeUser = { uid: 'user-1', requestId: 'req-0001-a' };

test('first free request is authorized with a reservation', async () => {
  const store = createStore();
  const r = await authorizeGeneration(store, freeUser);
  assert.deepEqual({ allowed: r.allowed, kind: r.kind }, { allowed: true, kind: 'free' });
  assert.equal(store.docs.get('entitlements/user-1').reservation.requestId, 'req-0001-a');
});

test('successful generation consumes the free attempt exactly once', async () => {
  const store = createStore();
  await authorizeGeneration(store, freeUser);
  const first = await confirmFreeConsumed(store, freeUser);
  const second = await confirmFreeConsumed(store, freeUser);
  assert.equal(first.consumed, true);
  assert.equal(second.consumed, false);
  assert.equal(store.docs.get('entitlements/user-1').freeUsed, true);
  const next = await authorizeGeneration(store, { ...freeUser, requestId: 'req-0002-b' });
  assert.equal(next.allowed, false);
  assert.equal(next.code, 'PAYWALL_REQUIRED');
  assert.equal(next.status, 402);
});

test('failed generation never consumes the free attempt', async () => {
  const store = createStore();
  await authorizeGeneration(store, freeUser);
  const released = await releaseReservation(store, freeUser);
  assert.equal(released.released, true);
  assert.equal(store.docs.get('entitlements/user-1').freeUsed ?? false, false);
  const again = await authorizeGeneration(store, { ...freeUser, requestId: 'req-0002-b' });
  assert.equal(again.allowed, true);
});

test('concurrent requests cannot both consume the free attempt', async () => {
  const store = createStore();
  const [a, b] = await Promise.all([
    authorizeGeneration(store, { uid: 'user-1', requestId: 'req-0001-a' }),
    authorizeGeneration(store, { uid: 'user-1', requestId: 'req-0002-b' }),
  ]);
  const allowed = [a, b].filter(r => r.allowed);
  const rejected = [a, b].filter(r => !r.allowed);
  assert.equal(allowed.length, 1);
  assert.equal(rejected.length, 1);
  assert.equal(rejected[0].code, 'GENERATION_IN_PROGRESS');
  assert.equal(rejected[0].status, 409);
});

test('a retry with the same requestId resumes instead of double-consuming', async () => {
  const store = createStore();
  await authorizeGeneration(store, freeUser);
  const resumed = await authorizeGeneration(store, freeUser);
  assert.equal(resumed.allowed, true);
  assert.equal(resumed.resumed, true);
});

test('an expired reservation no longer blocks a new request', async () => {
  const store = createStore();
  const t0 = 1_000_000;
  await authorizeGeneration(store, { ...freeUser, now: t0 });
  const later = await authorizeGeneration(store, { ...freeUser, requestId: 'req-0002-b', now: t0 + 120_000 });
  assert.equal(later.allowed, true);
});

test('confirm without a matching reservation consumes nothing', async () => {
  const store = createStore();
  const r = await confirmFreeConsumed(store, { uid: 'user-1', requestId: 'req-9999-x' });
  assert.equal(r.consumed, false);
  assert.equal(store.docs.has('entitlements/user-1'), false);
});

test('authorization validates uid and requestId', async () => {
  const store = createStore();
  assert.equal((await authorizeGeneration(store, { uid: '', requestId: 'req-0001-a' })).code, 'NO_AUTH');
  assert.equal((await authorizeGeneration(store, { uid: 'user-1', requestId: 'x' })).code, 'INVALID_REQUEST');
});

test('valid code subscribes atomically and cannot be reused', async () => {
  const store = createStore();
  const [issued] = generateActivationCodes(1, SALT);
  store.docs.set(`activationCodes/${issued.digest}`, { used: false, createdAt: 1 });
  const normalized = normalizeActivationCode(issued.code);
  assert.equal(normalized.length, 10);

  const r = await redeemActivationCode(store, { uid: 'user-1', code: issued.code, salt: SALT });
  assert.equal(r.ok, true);
  assert.equal(store.docs.get('entitlements/user-1').subscribed, true);
  assert.equal(store.docs.get(`activationCodes/${issued.digest}`).used, true);

  const again = await redeemActivationCode(store, { uid: 'user-2', code: issued.code, salt: SALT });
  assert.equal(again.ok, false);
  assert.equal(again.code, 'CODE_USED');
  assert.equal(again.status, 409);
  assert.equal(store.docs.has('entitlements/user-2'), false);
});

test('concurrent redemption of one code subscribes only one user', async () => {
  const store = createStore();
  const [issued] = generateActivationCodes(1, SALT);
  store.docs.set(`activationCodes/${issued.digest}`, { used: false, createdAt: 1 });
  const [r1, r2] = await Promise.all([
    redeemActivationCode(store, { uid: 'user-1', code: issued.code, salt: SALT }),
    redeemActivationCode(store, { uid: 'user-2', code: issued.code, salt: SALT }),
  ]);
  assert.equal([r1, r2].filter(r => r.ok).length, 1);
  assert.equal([r1, r2].filter(r => !r.ok && r.code === 'CODE_USED').length, 1);
});

test('unknown or malformed codes are rejected without side effects', async () => {
  const store = createStore();
  const bad = await redeemActivationCode(store, { uid: 'user-1', code: 'XXXXX-XXXXX', salt: SALT });
  assert.equal(bad.code, 'INVALID_CODE');
  const short = await redeemActivationCode(store, { uid: 'user-1', code: 'ABC', salt: SALT });
  assert.equal(short.code, 'INVALID_CODE');
  assert.equal(store.docs.size, 0);
});

test('subscribed users generate without consuming anything', async () => {
  const store = createStore();
  store.docs.set('entitlements/user-1', { subscribed: true, subscribedAt: 1, freeUsed: true });
  const r = await authorizeGeneration(store, { uid: 'user-1', requestId: 'req-0009-z' });
  assert.deepEqual({ allowed: r.allowed, kind: r.kind }, { allowed: true, kind: 'subscribed' });
  assert.equal(store.docs.get('entitlements/user-1').reservation, undefined);
});

test('redemption also clears a stuck reservation', async () => {
  const store = createStore();
  await authorizeGeneration(store, freeUser);
  const [issued] = generateActivationCodes(1, SALT);
  store.docs.set(`activationCodes/${issued.digest}`, { used: false, createdAt: 1 });
  await redeemActivationCode(store, { uid: 'user-1', code: issued.code, salt: SALT });
  const ent = store.docs.get('entitlements/user-1');
  assert.equal(ent.subscribed, true);
  assert.equal(ent.reservation, undefined);
});

test('generated codes are unique, display-formatted and hash-verifiable', () => {
  const codes = generateActivationCodes(25, SALT);
  assert.equal(codes.length, 25);
  const plaintexts = new Set(codes.map(c => c.code));
  const digests = new Set(codes.map(c => c.digest));
  assert.equal(plaintexts.size, 25);
  assert.equal(digests.size, 25);
  for (const c of codes) {
    assert.match(c.code, /^[A-HJ-NP-Z2-9]{5}-[A-HJ-NP-Z2-9]{5}$/);
    assert.equal(hashActivationCode(normalizeActivationCode(c.code), SALT), c.digest);
  }
});

test('code generation requires a real salt and sane count', () => {
  assert.throws(() => generateActivationCodes(1, 'short'));
  assert.throws(() => generateActivationCodes(0, SALT));
  assert.throws(() => generateActivationCodes(101, SALT));
});

test('redemption refuses a missing salt instead of failing open', async () => {
  const store = createStore();
  const r = await redeemActivationCode(store, { uid: 'user-1', code: 'XXXXX-XXXXX', salt: '' });
  assert.equal(r.code, 'ACCESS_CONFIGURATION');
  assert.equal(r.status, 503);
});
