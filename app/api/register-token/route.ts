// app/api/register-token/route.ts
//
// Called by the client after the user grants notification permission.
// Stores the FCM registration token in Firestore so the server can push
// to this device later. Keyed by the token itself so re-registrations
// (same device, same token) are idempotent.

import { adminDb } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { token } = (await req.json()) as { token?: string };
    if (!token || typeof token !== "string") {
      return NextResponse.json({ error: "token required" }, { status: 400 });
    }

    await adminDb()
      .collection("fcm_tokens")
      .doc(token)
      .set({ token, updatedAt: FieldValue.serverTimestamp() }, { merge: true });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[register-token] failed", err);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
