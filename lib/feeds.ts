// lib/feeds.ts
//
// This file is the "brain" of the news aggregator.
// It runs ONLY on the server (never in the browser), which means:
//   - No CORS issues when fetching RSS feeds
//   - Feed URLs are never exposed to the user
//
// What it does:
//   1. Defines the 5 RSS sources
//   2. Fetches them all at the same time (in parallel, so it's fast)
//   3. Normalizes each item into a consistent Article shape
//   4. Sorts everything newest-first
//   5. If a feed fails, it logs the error and moves on — the page still loads

import Parser from 'rss-parser';

// ---------------------------------------------------------------------------
// Feed sources
// ---------------------------------------------------------------------------

const FEEDS = [
  { name: 'Moneycontrol', url: 'https://www.moneycontrol.com/rss/latestnews.xml' },
  { name: 'The Hindu',    url: 'https://www.thehindu.com/news/national/feeder/default.rss' },
  { name: 'Livemint',     url: 'https://www.livemint.com/rss/news' },
  { name: 'The Wire',     url: 'https://thewire.in/rss' },
  { name: 'Hacker News',  url: 'https://hnrss.org/frontpage' },
];

// ---------------------------------------------------------------------------
// Article type
//
// Every article from every source gets converted into this shape.
// Having one consistent shape makes the UI code much simpler.
// ---------------------------------------------------------------------------

export type Article = {
  title: string;       // Headline
  url: string;         // Link to the original article
  source: string;      // Feed name, e.g. "The Hindu"
  publishedAt: Date;   // When it was published
  snippet: string;     // Short description, truncated to ~200 chars
};

// ---------------------------------------------------------------------------
// RSS parser instance
//
// We create one parser and reuse it for all feeds.
// The timeout (10s) prevents a slow feed from hanging the whole page load.
// ---------------------------------------------------------------------------

const parser = new Parser({
  timeout: 10000, // 10 seconds per feed
});

// ---------------------------------------------------------------------------
// fetchFeed
//
// Fetches and parses one RSS feed. Returns an empty array if anything goes
// wrong — so if Livemint is down, you still see articles from the other 4.
// ---------------------------------------------------------------------------

async function fetchFeed(name: string, url: string): Promise<Article[]> {
  try {
    const feed = await parser.parseURL(url);

    return feed.items.map((item) => ({
      title:       item.title?.trim() || 'Untitled',
      url:         item.link  || '#',
      source:      name,
      publishedAt: item.pubDate ? new Date(item.pubDate) : new Date(0),
      snippet:     truncate(stripHtml(item.contentSnippet || item.content || ''), 200),
    }));

  } catch (err) {
    // Log the error so you can see it in Vercel's logs, but don't crash
    console.error(`[feeds] Failed to load "${name}" (${url}):`, err);
    return [];
  }
}

// ---------------------------------------------------------------------------
// getAllArticles  (exported — called by app/page.tsx)
//
// Kicks off all 5 fetches at the same time, waits for all to finish,
// combines the results, and returns them sorted newest-first.
// ---------------------------------------------------------------------------

export async function getAllArticles(): Promise<Article[]> {
  // Promise.allSettled means: run all, don't stop if one fails
  const results = await Promise.allSettled(
    FEEDS.map((feed) => fetchFeed(feed.name, feed.url))
  );

  const articles = results
    .filter((r): r is PromiseFulfilledResult<Article[]> => r.status === 'fulfilled')
    .flatMap((r) => r.value);

  // Newest article first
  return articles.sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Some feeds include HTML tags in their descriptions — strip them out
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
}

// Cut the snippet to maxLength characters and add '...' if truncated
function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trimEnd() + '...';
}

// ---------------------------------------------------------------------------
// relativeTime  (exported — used in the article card)
//
// Converts a Date into a human-readable string like "3h ago" or "2d ago".
// We write this ourselves to avoid adding another npm package.
// ---------------------------------------------------------------------------

export function relativeTime(date: Date): string {
  const diffMs   = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);

  if (diffMins <  1)  return 'just now';
  if (diffMins < 60)  return `${diffMins}m ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}
