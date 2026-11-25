"use client";

import { initializeApp, getApps } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Same Firebase project as the Masar jobs site, so one Google sign-in
// and one user base is shared across all of the owner's sites.
const firebaseConfig = {
  apiKey: "AIzaSyCnsQtY9PdymuKG5suBX1psYgdkCHFFYKs",
  authDomain: "jobsautosearch.firebaseapp.com",
  projectId: "jobsautosearch",
  storageBucket: "jobsautosearch.firebasestorage.app",
  messagingSenderId: "810040080530",
  appId: "1:810040080530:web:468f87f88571a510980e4b"
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
