'use client';

// app/components/NewsFeed.tsx
//
// Handles source filtering, article display, and auto-refresh.
//
// Auto-refresh:
//   - Every 15 minutes, fetches /api/articles in the background
//   - Updates the article list without any page reload
//   - Shows "Last updated: X minutes ago" that ticks every minute
//
// Filter behaviour:
//   - Default ("All"): balanced top 10, max 4 per source, no consecutive same source
//   - Click a source tab: shows ONLY that source
//   - Click active tab again, or "All": resets

import { useState, useMemo, useEffect, useCallback } from 'react';
import { relativeTime, type Article } from '@/lib/feeds';

const ALL_SOURCES    = ['Economic Times', 'The Hindu', 'Livemint', 'NDTV', 'Yahoo India', 'India Today', 'Times of India', 'Hindustan Times'];
const REFRESH_MS     = 15 * 60 * 1000; // 15 minutes
const CLOCK_TICK_MS  = 60 * 1000;      // re-render "X minutes ago" every minute

// Shorter labels for the tab row — internal source names stay unchanged
const SOURCE_LABELS: Record<string, string> = {
  'Economic Times': 'ET',
  'Times of India': 'TOI',
  'Hindustan Times': 'HT',
  'Yahoo India': 'Yahoo India',
  'India Today': 'India Today',
  'The Hindu': 'The Hindu',
  'Livemint': 'Livemint',
  'NDTV': 'NDTV',
};

const SOURCE_COLORS: Record<string, string> = {
  'Economic Times': '#b45309', // amber
  'The Hindu':      '#b91c1c', // red
  'Livemint':       '#1d4ed8', // blue
  'NDTV':           '#c2410c', // orange-red
  'Yahoo India':    '#7e22ce', // purple
  'India Today':    '#0369a1', // sky blue
  'Times of India': '#dc2626', // bright red
  'Hindustan Times': '#0f766e', // teal
};

// ---------------------------------------------------------------------------
// normalizeArticles
//
// When articles arrive from the API they have publishedAt as a string.
// When they come from the server component prop they may already be Dates.
// This ensures we always work with real Date objects.
// ---------------------------------------------------------------------------

function normalizeArticles(raw: (Article | (Omit<Article, 'publishedAt'> & { publishedAt: string | Date }))[]) : Article[] {
  return raw.map((a) => ({
    ...a,
    publishedAt: a.publishedAt instanceof Date ? a.publishedAt : new Date(a.publishedAt),
  }));
}

// ---------------------------------------------------------------------------
// getBalancedArticles — greedy interleave, max 4 per source, no consecutive
// ---------------------------------------------------------------------------

function getBalancedArticles(articles: Article[]): Article[] {
  const MAX_PER_SOURCE = 2; // 8 sources × max 2 = up to 16 candidates for 10 slots
  const TOTAL = 10;
  const sourceCounts: Record<string, number> = {};
  const top10: Article[] = [];
  const pool = [...articles];

  while (top10.length < TOTAL && pool.length > 0) {
    const lastSource    = top10.length > 0 ? top10[top10.length - 1].source : null;
    const slotsLeft     = TOTAL - top10.length;
    const unseenSources = ALL_SOURCES.filter((s) => !sourceCounts[s]);
    const mustPickUnseen = unseenSources.length >= slotsLeft;

    let idx: number;

    if (mustPickUnseen && unseenSources.length > 0) {
      idx = pool.findIndex((a) => unseenSources.includes(a.source) && a.source !== lastSource);
      if (idx === -1) idx = pool.findIndex((a) => unseenSources.includes(a.source));
    } else {
      idx = pool.findIndex((a) => a.source !== lastSource && (sourceCounts[a.source] ?? 0) < MAX_PER_SOURCE);
      if (idx === -1) idx = pool.findIndex((a) => (sourceCounts[a.source] ?? 0) < MAX_PER_SOURCE);
    }

    if (idx === -1) break;
    const [article] = pool.splice(idx, 1);
    top10.push(article);
    sourceCounts[article.source] = (sourceCounts[article.source] ?? 0) + 1;
  }

  const top10Urls = new Set(top10.map((a) => a.url));
  const rest = articles.filter((a) => !top10Urls.has(a.url));
  return [...top10, ...rest];
}

// ---------------------------------------------------------------------------
// NewsFeed
// ---------------------------------------------------------------------------

export default function NewsFeed({ articles: initialArticles }: { articles: Article[] }) {
  const [articles,    setArticles]    = useState<Article[]>(() => normalizeArticles(initialArticles));
  const [lastUpdated, setLastUpdated] = useState<Date>(() => new Date());
  const [, clockTick]                 = useState(0); // triggers re-render for relative time
  const [activeSource, setActiveSource] = useState<string | null>(null);

  // Fetch fresh articles from the API and update state
  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/articles');
      if (!res.ok) return;
      const data = await res.json();
      setArticles(normalizeArticles(data));
      setLastUpdated(new Date());
    } catch {
      // Silently keep the existing articles if the fetch fails
    }
  }, []);

  useEffect(() => {
    // Auto-refresh every 15 minutes
    const refreshInterval = setInterval(refresh, REFRESH_MS);

    // Tick the clock every minute so "X minutes ago" stays accurate
    const clockInterval = setInterval(() => clockTick((n) => n + 1), CLOCK_TICK_MS);

    return () => {
      clearInterval(refreshInterval);
      clearInterval(clockInterval);
    };
  }, [refresh]);

  function selectSource(source: string) {
    setActiveSource((prev) => (prev === source ? null : source));
  }

  const visible = useMemo(() => {
    if (activeSource !== null) return articles.filter((a) => a.source === activeSource);
    return getBalancedArticles(articles);
  }, [articles, activeSource]);

  return (
    <>
      {/* Last updated indicator */}
      <p className="text-xs text-gray-400 mb-4">
        Last updated: {relativeTime(lastUpdated)}
      </p>

      {/* Source filter tabs — single scrollable row */}
      <div className="flex gap-x-6 mb-6 border-b border-gray-200 pb-3 overflow-x-auto scrollbar-none">

        <button
          onClick={() => setActiveSource(null)}
          className="text-sm font-semibold pb-3 -mb-3 transition-colors border-b-2 cursor-pointer whitespace-nowrap shrink-0"
          style={
            activeSource === null
              ? { color: '#111827', borderColor: '#111827' }
              : { color: '#9ca3af', borderColor: 'transparent' }
          }
        >
          All
        </button>

        {ALL_SOURCES.map((source) => {
          const isActive = activeSource === source;
          const color    = SOURCE_COLORS[source];
          return (
            <button
              key={source}
              onClick={() => selectSource(source)}
              className="text-sm font-semibold pb-3 -mb-3 transition-colors border-b-2 cursor-pointer whitespace-nowrap shrink-0"
              style={{
                color:       isActive ? color : '#9ca3af',
                borderColor: isActive ? color : 'transparent',
              }}
            >
              {SOURCE_LABELS[source] ?? source}
            </button>
          );
        })}

      </div>

      {/* Empty state */}
      {visible.length === 0 && (
        <p className="text-gray-400 text-sm mt-4">No articles available right now.</p>
      )}

      {/* Article list */}
      <ul>
        {visible.map((article, index) => (
          <ArticleRow key={`${article.url}-${index}`} article={article} />
        ))}
      </ul>
    </>
  );
}

// ---------------------------------------------------------------------------
// ArticleRow
// ---------------------------------------------------------------------------

function ArticleRow({ article }: { article: Article }) {
  const color = SOURCE_COLORS[article.source] ?? '#374151';

  return (
    <li className="py-4 border-b border-gray-100 last:border-0">

      <div className="flex items-center gap-2 mb-1">
        <span className="text-xs font-bold uppercase tracking-wide" style={{ color }}>
          {article.source}
        </span>
        <span className="text-xs text-gray-400">{relativeTime(article.publishedAt)}</span>
      </div>

      <a
        href={article.url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-[15px] font-semibold text-gray-900 leading-snug hover:underline decoration-gray-400 underline-offset-2 block"
      >
        {article.title}
      </a>

      {article.snippet && (
        <p className="text-sm text-gray-500 mt-1 leading-relaxed">
          {article.snippet}
        </p>
      )}

    </li>
  );
}
