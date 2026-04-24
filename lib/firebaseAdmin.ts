// lib/firebaseAdmin.ts
//
// Server-only Firebase Admin singleton. Reads service-account creds from env
// so nothing sensitive lives in the repo. Private keys in env vars commonly
// arrive with literal "\n" sequences instead of real newlines (Vercel's env
// editor does this) — we normalize that.

import { getApps, initializeApp, cert, type App } from "firebase-admin/app";
import { getMessaging, type Messaging } from "firebase-admin/messaging";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

let _app: App | null = null;

function adminApp(): App {
  if (_app) return _app;
  const existing = getApps()[0];
  if (existing) return (_app = existing);

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Firebase Admin missing credentials — set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY"
    );
  }

  _app = initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
  });
  return _app;
}

export function adminMessaging(): Messaging {
  return getMessaging(adminApp());
}

export function adminDb(): Firestore {
  return getFirestore(adminApp());
}
