// app/api/notify/route.ts
//
// Generic push-send endpoint. Protected by CRON_SECRET — the same secret
// Vercel Cron uses — so callers must include `Authorization: Bearer <secret>`.
// This prevents random clients from spamming every registered device.
//
// POST body: { title, body, url? }

import { sendPushToAll } from "@/lib/push";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get("authorization");
  return header === `Bearer ${secret}`;
}

export async function POST(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const { title, body, url } = (await req.json()) as {
      title?: string;
      body?: string;
      url?: string;
    };
    if (!title || !body) {
      return NextResponse.json({ error: "title and body required" }, { status: 400 });
    }

    const result = await sendPushToAll({ title, body, url });
    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[notify] failed", err);
    return NextResponse.json({ error: "failed", detail: msg }, { status: 500 });
  }
}
