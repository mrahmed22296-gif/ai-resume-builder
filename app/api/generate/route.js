import { NextResponse } from "next/server";
import { generateResumeText } from "./gemini.mjs";
import { authorizeGeneration, confirmFreeConsumed, releaseReservation } from "./access.mjs";

const json = (body, status) => NextResponse.json(body, { status });

// PROVISIONAL, awaiting owner decision before collection opens:
// language-switch translation transforms text the user already generated,
// so it authenticates but never consumes the free attempt or requires a
// subscription. Flip to true only if the owner decides translation is a
// chargeable generation.
const TRANSLATION_CONSUMES_ATTEMPT = false;

async function authorizeRequest(req, body) {
  if (process.env.PAYWALL_ENABLED !== "true") return { uid: null, requestId: null, authz: null };
  const header = req.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return { error: json({ error: "Sign in required.", code: "NO_AUTH" }, 401) };
  if (typeof body.requestId !== "string" || !/^[A-Za-z0-9-]{8,64}$/.test(body.requestId)) {
    return { error: json({ error: "Invalid request.", code: "INVALID_REQUEST" }, 400) };
  }
  const { verifyFirebaseIdToken, getFirestoreStore, AdminInitError } = await import("./firestore-store.mjs");
  let uid;
  try {
    uid = await verifyFirebaseIdToken(token);
  } catch (error) {
    console.error("generate auth failure:", error && (error.code || error.name), error && String(error.message || error).slice(0, 300));
    // Admin/secret misconfiguration is an operator problem, not an auth
    // rejection: surface it distinctly so it is never mistaken for a bad
    // sign-in and never silently consumes anything.
    if (error instanceof AdminInitError) {
      return { error: json({ error: "Access control is temporarily unavailable. No attempt was used.", code: "ACCESS_UNAVAILABLE" }, 503) };
    }
    return { error: json({ error: "Sign in required.", code: "NO_AUTH" }, 401) };
  }
  const chargeable = body.type !== "translation" || TRANSLATION_CONSUMES_ATTEMPT;
  if (!chargeable) return { uid, requestId: body.requestId, authz: { kind: "uncounted" }, store: null };
  const store = await getFirestoreStore();
  const authz = await authorizeGeneration(store, { uid, requestId: body.requestId });
  if (!authz.allowed) {
    const message = authz.code === "PAYWALL_REQUIRED"
      ? "Your free generation was used. Activate the one-time subscription to continue."
      : "Another generation is already in progress. Wait for it to finish.";
    return { error: json({ error: message, code: authz.code }, authz.status) };
  }
  return { uid, requestId: body.requestId, authz, store };
}

export async function POST(req) {
  let body;
  try { body = await req.json(); } catch {
    return json({ error: "Invalid JSON request.", code: "INVALID_REQUEST" }, 400);
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return json({ error: "Invalid request.", code: "INVALID_REQUEST" }, 400);
  }
  const { prompt, type, language } = body;
  if (typeof prompt !== "string" || !prompt.trim() || prompt.length > (type === "translation" ? 12000 : 5000) ||
      !["summary", "experience", "translation"].includes(type) || !["ar", "en"].includes(language)) {
    return json({ error: "Provide a prompt of 1-5000 characters, a supported type and language.", code: "INVALID_REQUEST" }, 400);
  }
  if (type === "translation") {
    try {
      const values = JSON.parse(prompt);
      if (!Array.isArray(values) || values.length < 1 || values.length > 30 || values.some(value => typeof value !== "string" || value.length > 5000)) throw new Error();
    } catch {
      return json({ error: "Invalid translation input.", code: "INVALID_REQUEST" }, 400);
    }
  }

  let gate;
  try {
    gate = await authorizeRequest(req, body);
  } catch {
    return json({ error: "Access control is temporarily unavailable. No attempt was used.", code: "ACCESS_UNAVAILABLE" }, 503);
  }
  if (gate.error) return gate.error;

  const outcome = await generateResumeText({ prompt: prompt.trim(), type, language });

  if (gate.authz?.kind === "free") {
    // Successful generations consume the free attempt; failures never do.
    const settle = outcome.result ? confirmFreeConsumed : releaseReservation;
    try { await settle(gate.store, { uid: gate.uid, requestId: gate.requestId }); } catch { /* reservation expires on its own */ }
  }

  if (outcome.result) return json({ result: outcome.result }, 200);
  return json({ error: "AI generation could not be completed.", code: outcome.code }, outcome.status);
}
