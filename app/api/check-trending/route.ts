// app/api/check-trending/route.ts
//
// Cron target — invoked by Vercel Cron (see vercel.json). For each story
// cluster that has crossed the push threshold AND we haven't already notified
// on, generate an AI summary, persist the story to Firestore, and fire a push.
// The push URL points to /story/[fingerprint] on Pulse so the user lands on the
// full synthesis rather than a single source article.

import { getAllArticles } from "@/lib/feeds";
import { clusterArticles, clusterFingerprint } from "@/lib/cluster";
import { generateSummary } from "@/lib/summarize";
import { adminDb } from "@/lib/firebaseAdmin";
import { sendPushToAll } from "@/lib/push";
import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const PUSH_THRESHOLD    = 2;
const MAX_NOTIFS_PER_RUN = 1; // one per run — three staggered crons = 3 per 2hr window

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const articles = await getAllArticles();
  const clusters = clusterArticles(articles);
  const candidates = clusters.filter((c) => c.sources.length >= PUSH_THRESHOLD);

  const db = adminDb();
  const notified: Array<{ fingerprint: string; title: string; sources: number }> = [];

  for (const cluster of candidates) {
    if (notified.length >= MAX_NOTIFS_PER_RUN) break;

    const fingerprint = clusterFingerprint(cluster);
    const storyUrl    = `/story/${fingerprint}`;
    const ref         = db.collection("notified_clusters").doc(fingerprint);

    const summary =
      (await generateSummary(
        cluster.articles.map((a) => ({
          source:  a.source,
          title:   a.title,
          snippet: a.snippet,
          url:     a.url,
        }))
      )) ?? cluster.snippet;

    // Transaction: claim the fingerprint and write the full story atomically.
    // Two concurrent cron runs will race here — only one wins.
    const shouldNotify = await db.runTransaction(async (tx) => {
      const doc = await tx.get(ref);
      if (doc.exists) return false;
      tx.set(ref, {
        title:       cluster.title,
        summary,
        url:         cluster.url,
        sources:     cluster.sources.length,
        sourceNames: cluster.sources,
        articles:    cluster.articles.slice(0, 12).map((a) => ({
          title:  a.title,
          url:    a.url,
          source: a.source,
        })),
        notifiedAt:  FieldValue.serverTimestamp(),
      });
      return true;
    });

    if (!shouldNotify) continue;

    const badgeLabel = `🔥 Trending · ${cluster.sources.length} source${cluster.sources.length !== 1 ? "s" : ""}`;

    try {
      await sendPushToAll({
        title: cluster.title,
        body:  `${badgeLabel}\n${summary}`,
        url:   storyUrl,
        data:  { fingerprint, sources: String(cluster.sources.length) },
      });
      notified.push({ fingerprint, title: cluster.title, sources: cluster.sources.length });
    } catch (err) {
      console.error("[check-trending] push failed, rolling back story", err);
      await ref.delete().catch(() => {});
    }
  }

  return NextResponse.json({ clusters: clusters.length, candidates: candidates.length, notified });
}
