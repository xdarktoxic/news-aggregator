// app/api/summarize/route.ts
//
// POST /api/summarize
//
// Body: { articles: ArticleInput[] }
// Response: { summary: string | null }
//
// The actual generation + caching lives in lib/summarize.ts.
// This route just validates input and proxies the call.

import { NextRequest, NextResponse } from 'next/server';
import { generateSummary, type ArticleInput } from '@/lib/summarize';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const articles: ArticleInput[] = body?.articles;

    if (!Array.isArray(articles) || articles.length < 3) {
      return NextResponse.json({ summary: null });
    }

    const summary = await generateSummary(articles);
    return NextResponse.json({ summary });
  } catch {
    return NextResponse.json({ summary: null });
  }
}
