// lib/messaging.ts
//
// Client-side FCM wrapper. Handles permission + token retrieval + foreground
// messages. Must only run in the browser — guard against SSR.

import {
  getMessaging,
  getToken,
  onMessage,
  isSupported,
  type MessagePayload,
} from "firebase/messaging";
import { firebaseApp } from "./firebase";

const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;

/**
 * Request permission and return an FCM registration token.
 * Returns null if unsupported, denied, or if VAPID key is missing.
 */
export async function requestNotificationToken(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  if (!(await isSupported())) return null;
  if (!VAPID_KEY) {
    console.warn("NEXT_PUBLIC_FIREBASE_VAPID_KEY is not set — cannot request FCM token");
    return null;
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return null;

  const messaging = getMessaging(firebaseApp);
  try {
    // Explicitly register the SW with scope "/" so Firebase uses our SW
    // at full site scope rather than its default restricted scope
    // (/firebase-cloud-messaging-push-scope), which blocks clients.openWindow()
    // and notificationclick from working correctly on Safari.
    const swReg = await navigator.serviceWorker.register(
      "/firebase-messaging-sw.js",
      { scope: "/" }
    );
    return await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: swReg });
  } catch (err) {
    console.error("getToken failed", err);
    return null;
  }
}

/**
 * Subscribe to foreground messages. Returns an unsubscribe function.
 * (Background messages are handled by public/firebase-messaging-sw.js.)
 */
export async function onForegroundMessage(
  handler: (payload: MessagePayload) => void
): Promise<() => void> {
  if (typeof window === "undefined") return () => {};
  if (!(await isSupported())) return () => {};
  const messaging = getMessaging(firebaseApp);
  return onMessage(messaging, handler);
}
