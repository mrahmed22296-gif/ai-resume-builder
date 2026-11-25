"use client";

import { initializeApp, getApps } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// The owner's own Firebase project ("resume-builder-access", AI Resume Pro),
// shared by the resume builder and the accounting site for sign-in,
// subscriptions, and visitor records.
const firebaseConfig = {
  apiKey: "AIzaSyCBtfYpB_j8X1ME-lMqP738Fy06FalSXIM",
  authDomain: "resume-builder-access.firebaseapp.com",
  projectId: "resume-builder-access",
  storageBucket: "resume-builder-access.firebasestorage.app",
  messagingSenderId: "209097923358",
  appId: "1:209097923358:web:90e660900f02a621b5c70f"
};

export function getFirebaseApp() {
  return getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
}

export function getFirebaseAuth() {
  return getAuth(getFirebaseApp());
}

export function getFirebaseDb() {
  return getFirestore(getFirebaseApp());
}

export function getGoogleProvider() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  return provider;
}
