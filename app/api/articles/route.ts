// app/api/articles/route.ts
//
// A server-side API endpoint the browser can call to get fresh articles.
// The client fetches this URL every 15 minutes to refresh the feed
// without doing a full page reload.
//
// GET /api/articles  →  JSON array of articles
//
// We serialize `publishedAt` as an ISO string because JSON can't
// carry a Date object — the client converts it back.

import { getAllArticles } from '@/lib/feeds';
import { NextResponse } from 'next/server';

// Force this route to always run fresh — never use a cached response
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const articles = await getAllArticles();

    const serialized = articles.map((a) => ({
      ...a,
      publishedAt: a.publishedAt.toISOString(), // Date → string for JSON
    }));

    return NextResponse.json(serialized);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch articles' }, { status: 500 });
  }
}
