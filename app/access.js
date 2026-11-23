"use client";

import { useCallback, useEffect, useState } from "react";
import { getApps, initializeApp } from "firebase/app";
import { getAuth, getRedirectResult, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signInWithRedirect, signOut } from "firebase/auth";

// Client access layer for the server-enforced paywall. Everything here is a
// no-op pass-through unless NEXT_PUBLIC_PAYWALL_ENABLED=true, so the app
// behaves exactly as before until the gate is switched on.

export const PAYWALL_ENABLED = process.env.NEXT_PUBLIC_PAYWALL_ENABLED === "true";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

let authInstance;
function getFirebaseAuth() {
  if (!authInstance) {
    if (!getApps().length) initializeApp(firebaseConfig);
    authInstance = getAuth();
  }
  return authInstance;
}

async function authedFetch(path, payload, signal) {
  const user = getFirebaseAuth().currentUser;
  if (!user) {
    const error = new Error("Sign in required");
    error.code = "NO_AUTH";
    throw error;
  }
  const token = await user.getIdToken();
  const res = await fetch(path, {
    method: "POST",
    signal,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export function useResumeAccess() {
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(!PAYWALL_ENABLED);
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [signInPromptOpen, setSignInPromptOpen] = useState(false);

  useEffect(() => {
    if (!PAYWALL_ENABLED) return undefined;
    const auth = getFirebaseAuth();
    // Complete a redirect-flow sign-in if the page was just returned to from
    // Google's consent screen. No-op on a normal load.
    getRedirectResult(auth).catch(() => {});
    return onAuthStateChanged(auth, current => {
      setUser(current);
      setAuthReady(true);
    });
  }, []);

  const signInRedirect = useCallback(async () => {
    await signInWithRedirect(getFirebaseAuth(), new GoogleAuthProvider());
  }, []);

  const signIn = useCallback(async () => {
    const auth = getFirebaseAuth();
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      // Popup-hostile environments (popup blockers, some in-app/mobile
      // browsers) never open the window; continue in the same page instead.
      const fallbackCodes = new Set([
        "auth/popup-blocked",
        "auth/cancelled-popup-request",
        "auth/operation-not-supported-in-this-environment",
        "auth/web-storage-unsupported",
      ]);
      if (fallbackCodes.has(error?.code)) {
        await signInWithRedirect(auth, provider);
        return;
      }
      throw error;
    }
  }, []);

  const signOutUser = useCallback(async () => {
    await signOut(getFirebaseAuth());
  }, []);

  // Returns the generated text, or throws an Error with .code:
  // NO_AUTH, PAYWALL_REQUIRED, GENERATION_IN_PROGRESS, or a provider code.
  const callGenerate = useCallback(async ({ prompt, type, language, signal }) => {
    if (!PAYWALL_ENABLED) {
      const res = await fetch("/api/generate", {
        method: "POST",
        signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, type, language }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || typeof data.result !== "string" || !data.result.trim()) {
        const error = new Error("Invalid AI response");
        error.code = data?.code;
        throw error;
      }
      return data.result.trim();
    }
    const { res, data } = await authedFetch("/api/generate", {
      prompt,
      type,
      language,
      requestId: crypto.randomUUID(),
    }, signal);
    if (!res.ok || typeof data.result !== "string" || !data.result.trim()) {
      const error = new Error("Invalid AI response");
      error.code = data?.code;
      throw error;
    }
    return data.result.trim();
  }, []);

  const redeemCode = useCallback(async code => {
    const { res, data } = await authedFetch("/api/activate", { code });
    if (!res.ok || data.activated !== true) {
      const error = new Error("Activation failed");
      error.code = data?.code;
      throw error;
    }
    setPaywallOpen(false);
    return true;
  }, []);

  return {
    enabled: PAYWALL_ENABLED,
    user,
    authReady,
    signIn,
    signInRedirect,
    signOut: signOutUser,
    callGenerate,
    redeemCode,
    paywallOpen,
    setPaywallOpen,
    signInPromptOpen,
    setSignInPromptOpen,
  };
}
