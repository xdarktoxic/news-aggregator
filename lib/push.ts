// lib/push.ts
//
// Server-only helper that fans out a push notification to every registered
// FCM token, prunes tokens the provider says are invalid (UNREGISTERED /
// INVALID_ARGUMENT), and returns a summary. Shared by /api/notify and the
// trending cron.

import { adminDb, adminMessaging } from "./firebaseAdmin";
import type { BatchResponse } from "firebase-admin/messaging";

const FCM_BATCH_LIMIT = 500; // sendEachForMulticast allows up to 500 tokens

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
  data?: Record<string, string>;
};

export type PushResult = {
  attempted: number;
  succeeded: number;
  failed: number;
  pruned: number;
};

async function loadTokens(): Promise<string[]> {
  const snap = await adminDb().collection("fcm_tokens").get();
  return snap.docs.map((d) => d.id);
}

async function pruneInvalidTokens(
  tokens: string[],
  response: BatchResponse
): Promise<number> {
  const toDelete: string[] = [];
  response.responses.forEach((r, i) => {
    const code = r.error?.code;
    if (
      code === "messaging/registration-token-not-registered" ||
      code === "messaging/invalid-registration-token" ||
      code === "messaging/invalid-argument"
    ) {
      toDelete.push(tokens[i]);
    }
  });
  if (toDelete.length === 0) return 0;

  const batch = adminDb().batch();
  for (const t of toDelete) batch.delete(adminDb().collection("fcm_tokens").doc(t));
  await batch.commit();
  return toDelete.length;
}

export async function sendPushToAll(payload: PushPayload): Promise<PushResult> {
  const tokens = await loadTokens();
  if (tokens.length === 0) {
    return { attempted: 0, succeeded: 0, failed: 0, pruned: 0 };
  }

  const messaging = adminMessaging();
  const data: Record<string, string> = { ...(payload.data ?? {}) };
  if (payload.url) data.url = payload.url;

  let succeeded = 0;
  let failed = 0;
  let pruned = 0;

  // fcmOptions.link must be an absolute URL — relative paths are silently
  // ignored and the browser falls back to opening the site root on click.
  const baseUrl = (process.env.APP_URL ?? "").replace(/\/$/, "");
  const clickUrl = payload.url
    ? payload.url.startsWith("http") ? payload.url : `${baseUrl}${payload.url}`
    : baseUrl || "/";

  // Send as a data-only message (no top-level `notification` field).
  // When `notification` is present, browsers display it directly and bypass
  // the SW's push handler — so the notification has no data.url and clicks
  // do nothing. Data-only forces the push through our SW's push handler,
  // which shows the notification with data.url baked in.
  data.title = payload.title;
  data.body  = payload.body;

  for (let i = 0; i < tokens.length; i += FCM_BATCH_LIMIT) {
    const batch = tokens.slice(i, i + FCM_BATCH_LIMIT);
    const res = await messaging.sendEachForMulticast({
      tokens: batch,
      data,
      webpush: {
        fcmOptions: { link: clickUrl },
        headers: { Urgency: "high" },
      },
    });
    succeeded += res.successCount;
    failed += res.failureCount;
    pruned += await pruneInvalidTokens(batch, res);
  }

  return { attempted: tokens.length, succeeded, failed, pruned };
}
