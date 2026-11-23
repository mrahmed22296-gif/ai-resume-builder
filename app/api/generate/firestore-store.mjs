// Lazy Firebase Admin wiring. Nothing here is imported or initialized unless
// PAYWALL_ENABLED=true, so the app runs unchanged without the new env vars.
//
// Required env (server only):
//   FIREBASE_SERVICE_ACCOUNT_JSON  full service-account JSON, one line.
//     Use a dedicated service account granted ONLY roles/datastore.user
//     (Firestore read/write). ID-token verification needs no IAM role.
//   ACTIVATION_CODE_SALT           random >= 32 chars, generated once at setup.
//   OWNER_UID                      the owner's Firebase Auth uid (code issuance).

export class AdminInitError extends Error {}

let appPromise;

async function getAdminApp() {
  if (!appPromise) {
    appPromise = (async () => {
      try {
        const { getApps, initializeApp, cert } = await import("firebase-admin/app");
        const existing = getApps();
        if (existing.length) return existing[0];
        const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON || "";
        if (!raw.trim()) throw new AdminInitError("FIREBASE_SERVICE_ACCOUNT_JSON is not configured");
        let parsed;
        try {
          parsed = JSON.parse(raw);
        } catch {
          throw new AdminInitError("FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON");
        }
        return initializeApp({ credential: cert(parsed) });
      } catch (error) {
        // Never cache a failed init: a fixed env var must take effect on the
        // next request without a function restart.
        appPromise = undefined;
        if (error instanceof AdminInitError) throw error;
        throw new AdminInitError("Firebase admin initialization failed");
      }
    })();
  }
  return appPromise;
}

export async function verifyFirebaseIdToken(token) {
  const app = await getAdminApp();
  const { getAuth } = await import("firebase-admin/auth");
  const decoded = await getAuth(app).verifyIdToken(token);
  return decoded.uid;
}

export async function getFirestoreStore() {
  const app = await getAdminApp();
  const { getFirestore } = await import("firebase-admin/firestore");
  const db = getFirestore(app);
  return {
    runTransaction: fn =>
      db.runTransaction(async tx => {
        const shim = {
          get: async path => {
            const snap = await tx.get(db.doc(path));
            return snap.exists ? snap.data() : null;
          },
          set: (path, value) => tx.set(db.doc(path), value),
        };
        return fn(shim);
      }),
  };
}

export async function storeIssuedCodes(codes) {
  const app = await getAdminApp();
  const { getFirestore } = await import("firebase-admin/firestore");
  const db = getFirestore(app);
  const batch = db.batch();
  for (const { digest, createdAt } of codes) {
    batch.set(db.doc(`activationCodes/${digest}`), { used: false, createdAt });
  }
  await batch.commit();
}
