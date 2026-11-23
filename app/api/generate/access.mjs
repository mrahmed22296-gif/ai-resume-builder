import { createHash, randomBytes } from "node:crypto";

// Server-enforced access control for AI generation.
// Pure logic with an injected document store so it is fully unit-testable
// without Firebase. The store adapter must provide:
//   runTransaction(async (tx) => result) with tx.get(path) -> object|null
//   and tx.set(path, value). Firestore transactions make the reads/writes
// below atomic; the in-memory test store serializes them.

export const RESERVATION_TTL_MS = 90000;

const ENTITLEMENTS = "entitlements";
const ACTIVATION_CODES = "activationCodes";

const entitlementPath = uid => `${ENTITLEMENTS}/${uid}`;
const codePath = digest => `${ACTIVATION_CODES}/${digest}`;

export function hashActivationCode(normalizedCode, salt) {
  return createHash("sha256").update(`${salt}:${normalizedCode}`).digest("hex");
}

export function normalizeActivationCode(raw) {
  return String(raw || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

// Authorize one generation request.
// - Subscribed users always pass and consume nothing.
// - A user with a free attempt left gets an atomic reservation so a
//   concurrent second request cannot consume the same free attempt.
// - The reservation is confirmed (freeUsed=true) ONLY after a successful
//   generation and released unchanged after any failure, so failed or
//   timed-out requests never consume the free attempt.
// - requestId makes client retries safe: resuming the same requestId is
//   allowed; a different requestId while a reservation is active is rejected.
export async function authorizeGeneration(store, { uid, requestId, now = Date.now(), reservationTtlMs = RESERVATION_TTL_MS }) {
  if (typeof uid !== "string" || !uid) return { allowed: false, code: "NO_AUTH", status: 401 };
  if (typeof requestId !== "string" || !/^[A-Za-z0-9-]{8,64}$/.test(requestId)) {
    return { allowed: false, code: "INVALID_REQUEST", status: 400 };
  }
  return store.runTransaction(async tx => {
    const path = entitlementPath(uid);
    const ent = (await tx.get(path)) || {};
    if (ent.subscribed === true) return { allowed: true, kind: "subscribed" };
    const reservation = ent.reservation;
    const active = reservation && typeof reservation.expiresAt === "number" && reservation.expiresAt > now;
    if (active) {
      if (reservation.requestId === requestId) return { allowed: true, kind: "free", resumed: true };
      return { allowed: false, code: "GENERATION_IN_PROGRESS", status: 409 };
    }
    if (ent.freeUsed === true) return { allowed: false, code: "PAYWALL_REQUIRED", status: 402 };
    tx.set(path, { ...ent, reservation: { requestId, expiresAt: now + reservationTtlMs } });
    return { allowed: true, kind: "free", resumed: false };
  });
}

// Mark the free attempt consumed after a successful generation.
// Only a matching reservation can consume; duplicate confirms are no-ops.
export async function confirmFreeConsumed(store, { uid, requestId }) {
  return store.runTransaction(async tx => {
    const path = entitlementPath(uid);
    const ent = (await tx.get(path)) || {};
    if (ent.subscribed === true) return { consumed: false, reason: "subscribed" };
    if (ent.freeUsed === true) return { consumed: false, reason: "already_consumed" };
    if (ent.reservation?.requestId !== requestId) return { consumed: false, reason: "no_matching_reservation" };
    const next = { ...ent, freeUsed: true };
    delete next.reservation;
    tx.set(path, next);
    return { consumed: true };
  });
}

// Release a reservation after a failed generation. Failures never consume.
export async function releaseReservation(store, { uid, requestId }) {
  return store.runTransaction(async tx => {
    const path = entitlementPath(uid);
    const ent = (await tx.get(path)) || {};
    if (ent.reservation?.requestId !== requestId) return { released: false };
    const next = { ...ent };
    delete next.reservation;
    tx.set(path, next);
    return { released: true };
  });
}

// Redeem a single-use activation code: marks the code used and subscribes
// the user in the same transaction, so one code can never subscribe two
// accounts even under concurrent redemption.
export async function redeemActivationCode(store, { uid, code, salt, now = Date.now() }) {
  if (typeof uid !== "string" || !uid) return { ok: false, code: "NO_AUTH", status: 401 };
  if (typeof salt !== "string" || salt.length < 16) return { ok: false, code: "ACCESS_CONFIGURATION", status: 503 };
  const normalized = normalizeActivationCode(code);
  if (normalized.length !== 10) return { ok: false, code: "INVALID_CODE", status: 400 };
  const digest = hashActivationCode(normalized, salt);
  return store.runTransaction(async tx => {
    const path = codePath(digest);
    const doc = await tx.get(path);
    if (!doc) return { ok: false, code: "INVALID_CODE", status: 400 };
    if (doc.used === true) return { ok: false, code: "CODE_USED", status: 409 };
    const entPath = entitlementPath(uid);
    const ent = (await tx.get(entPath)) || {};
    tx.set(path, { ...doc, used: true, usedBy: uid, usedAt: now });
    const next = { ...ent, subscribed: true, subscribedAt: now, freeUsed: true };
    delete next.reservation;
    tx.set(entPath, next);
    return { ok: true };
  });
}

// Generate a batch of single-use activation codes. Returns the plaintext
// codes exactly once to the caller (the site owner) plus the salted hashes
// to store. Plaintext codes are never persisted server-side.
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no I,O,0,1
export function generateActivationCodes(count, salt, { random = randomBytes, now = Date.now() } = {}) {
  if (!Number.isInteger(count) || count < 1 || count > 100) throw new Error("count must be 1-100");
  if (typeof salt !== "string" || salt.length < 16) throw new Error("salt is required");
  const seen = new Set();
  const codes = [];
  while (codes.length < count) {
    const bytes = random(10);
    let text = "";
    for (let i = 0; i < 10; i++) text += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
    if (seen.has(text)) continue;
    seen.add(text);
    codes.push({ code: `${text.slice(0, 5)}-${text.slice(5)}`, digest: hashActivationCode(text, salt), createdAt: now, used: false });
  }
  return codes;
}
