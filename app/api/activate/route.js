import { NextResponse } from "next/server";
import { redeemActivationCode } from "../generate/access.mjs";

const json = (body, status) => NextResponse.json(body, { status });

// POST { code } with Authorization: Bearer <Firebase ID token>.
// Redeems a single-use activation code: subscribes the signed-in user
// atomically. Codes live only as salted hashes server-side.
export async function POST(req) {
  if (process.env.PAYWALL_ENABLED !== "true") {
    return json({ error: "Not found.", code: "NOT_FOUND" }, 404);
  }
  const header = req.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return json({ error: "Sign in required.", code: "NO_AUTH" }, 401);
  let body;
  try { body = await req.json(); } catch {
    return json({ error: "Invalid JSON request.", code: "INVALID_REQUEST" }, 400);
  }
  try {
    const { verifyFirebaseIdToken, getFirestoreStore } = await import("../generate/firestore-store.mjs");
    const uid = await verifyFirebaseIdToken(token);
    const store = await getFirestoreStore();
    const result = await redeemActivationCode(store, {
      uid,
      code: body?.code,
      salt: process.env.ACTIVATION_CODE_SALT || "",
    });
    if (!result.ok) {
      const message = result.code === "CODE_USED"
        ? "This code was already used."
        : result.code === "ACCESS_CONFIGURATION"
          ? "Activation is temporarily unavailable."
          : "Invalid activation code.";
      return json({ error: message, code: result.code }, result.status);
    }
    return json({ activated: true }, 200);
  } catch {
    return json({ error: "Activation is temporarily unavailable.", code: "ACCESS_UNAVAILABLE" }, 503);
  }
}
