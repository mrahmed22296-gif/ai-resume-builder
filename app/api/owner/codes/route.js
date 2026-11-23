import { NextResponse } from "next/server";
import { generateActivationCodes } from "../../generate/access.mjs";

const json = (body, status) => NextResponse.json(body, { status });

// POST {} with Authorization: Bearer <Firebase ID token> — owner only.
// Issues a batch of single-use activation codes: stores salted hashes and
// returns the plaintext codes ONCE in this response. The owner copies them
// from their own signed-in session; plaintext codes never persist server-side
// and never pass through chat or logs.
export async function POST(req) {
  if (process.env.PAYWALL_ENABLED !== "true") {
    return json({ error: "Not found.", code: "NOT_FOUND" }, 404);
  }
  const header = req.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return json({ error: "Sign in required.", code: "NO_AUTH" }, 401);
  const ownerUid = process.env.OWNER_UID || "";
  if (!ownerUid) return json({ error: "Owner access is not configured.", code: "ACCESS_CONFIGURATION" }, 503);
  let count = 10;
  try {
    const body = await req.json().catch(() => ({}));
    if (body && Number.isInteger(body.count)) count = body.count;
  } catch { /* empty body is fine */ }
  let uid;
  try {
    const { verifyFirebaseIdToken, AdminInitError } = await import("../../generate/firestore-store.mjs");
    uid = await verifyFirebaseIdToken(token).catch(error => { throw error instanceof AdminInitError ? error : Object.assign(new Error("bad token"), { authFailure: true }); });
  } catch (error) {
    if (error && error.authFailure) return json({ error: "Sign in required.", code: "NO_AUTH" }, 401);
    return json({ error: "Access control is temporarily unavailable.", code: "ACCESS_UNAVAILABLE" }, 503);
  }
  if (uid !== ownerUid) return json({ error: "Not allowed.", code: "FORBIDDEN" }, 403);
  try {
    const { storeIssuedCodes } = await import("../../generate/firestore-store.mjs");
    const codes = generateActivationCodes(count, process.env.ACTIVATION_CODE_SALT || "");
    await storeIssuedCodes(codes);
    return json({ codes: codes.map(c => c.code), count: codes.length }, 200);
  } catch {
    return json({ error: "Code issuance is temporarily unavailable.", code: "ACCESS_UNAVAILABLE" }, 503);
  }
}
