// lib/summarize.ts
//
// Server-only utility — calls Claude Haiku to synthesise a trending cluster
// into a 2-3 sentence neutral summary.
//
// Caching:
//   Summaries are stored in a module-level Map keyed by sorted article URLs.
//   The cache survives across requests as long as the function instance is warm,
//   so we only pay for a generation once per unique cluster composition.
//
// Error handling:
//   - Missing API key  → returns null silently (RSS snippet shown instead)
//   - Rate limit (429) → waits 2s and retries once, then null
//   - Any other error  → logs and returns null

import Anthropic from '@anthropic-ai/sdk';

export type ArticleInput = {
  source:  string;
  title:   string;
  snippet: string;
  url:     string;
};

// ---------------------------------------------------------------------------
// Cache
// ---------------------------------------------------------------------------

const cache = new Map<string, string>();

export function summaryKey(articles: ArticleInput[]): string {
  return [...articles].map((a) => a.url).sort().join('|');
}

// ---------------------------------------------------------------------------
// Client (lazy singleton)
// ---------------------------------------------------------------------------

let _client: Anthropic | null = null;
function client(): Anthropic {
  if (!_client) _client = new Anthropic(); // reads ANTHROPIC_API_KEY from env
  return _client;
}

// ---------------------------------------------------------------------------
// Prompt
// ---------------------------------------------------------------------------

const SYSTEM = `You are a news synthesis engine. Given multiple headlines and snippets about the same story from different Indian news sources, write a 2-3 sentence synthesis. Be factual and neutral. First state what happened. Then note if sources agree or if any source has a different angle. Do not editorialize. Do not use phrases like "according to sources" or "various outlets report". Just state the facts directly. Keep it under 60 words.`;

function buildUserMessage(articles: ArticleInput[]): string {
  const body = articles
    .map((a) => `Source: ${a.source}\nHeadline: ${a.title}\nSnippet: ${a.snippet}`)
    .join('\n\n');
  return `Synthesize these ${articles.length} articles about the same story:\n\n${body}`;
}

// ---------------------------------------------------------------------------
// generateSummary  (exported — called by /api/summarize)
// ---------------------------------------------------------------------------

export async function generateSummary(articles: ArticleInput[]): Promise<string | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;

  const key = summaryKey(articles);
  if (cache.has(key)) return cache.get(key)!;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await client().messages.create({
        model:      'claude-haiku-4-5-20251001',
        max_tokens: 150,
        system:     SYSTEM,
        messages:   [{ role: 'user', content: buildUserMessage(articles) }],
      });

      const block = response.content[0];
      const text  = block.type === 'text' ? block.text.trim() : null;
      if (text) {
        cache.set(key, text);
        console.log(`[AI] Summary generated for: "${articles[0].title}"`);
        console.log(`[AI] Cost: ~$0.001`);
        return text;
      }
      return null;

    } catch (err: unknown) {
      const status = (err as { status?: number })?.status;
      if (status === 429 && attempt === 0) {
        // Rate limited — wait 2s and retry once
        await new Promise((r) => setTimeout(r, 2000));
        continue;
      }
      console.error('[summarize] API error:', err);
      return null;
    }
  }

  return null;
}
