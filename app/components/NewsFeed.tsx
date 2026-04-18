'use client';

// app/components/NewsFeed.tsx
//
// Handles source filtering, story clustering, article display, and auto-refresh.
//
// In "All" mode:
//   - Articles are clustered by story (see lib/cluster.ts)
//   - Multi-source clusters render as ClusterCard (expandable)
//   - Single-source or unclustered articles render as ArticleRow
//   - Clusters with the most sources appear first
//
// In single-source filter mode:
//   - Clustering is skipped — articles shown flat in date order
//
// Auto-refresh: polls /api/articles every 15 minutes in the background.

import { useState, useMemo, useEffect, useCallback } from 'react';
import { relativeTime, type Article } from '@/lib/feeds';
import { clusterArticles, type Cluster } from '@/lib/cluster';

const ALL_SOURCES   = ['Economic Times', 'The Hindu', 'Livemint', 'NDTV', 'Yahoo India', 'India Today', 'Times of India', 'Hindustan Times'];
const REFRESH_MS    = 15 * 60 * 1000;
const CLOCK_TICK_MS = 60 * 1000;

const SOURCE_LABELS: Record<string, string> = {
  'Economic Times':  'ET',
  'Times of India':  'TOI',
  'Hindustan Times': 'HT',
};

const SOURCE_COLORS: Record<string, string> = {
  'Economic Times':  '#b45309',
  'The Hindu':       '#b91c1c',
  'Livemint':        '#1d4ed8',
  'NDTV':            '#c2410c',
  'Yahoo India':     '#7e22ce',
  'India Today':     '#0369a1',
  'Times of India':  '#dc2626',
  'Hindustan Times': '#0f766e',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function label(source: string) {
  return SOURCE_LABELS[source] ?? source;
}

function normalizeArticles(
  raw: (Article | (Omit<Article, 'publishedAt'> & { publishedAt: string | Date }))[]
): Article[] {
  return raw.map((a) => ({
    ...a,
    publishedAt: a.publishedAt instanceof Date ? a.publishedAt : new Date(a.publishedAt),
  }));
}

// ---------------------------------------------------------------------------
// NewsFeed
// ---------------------------------------------------------------------------

export default function NewsFeed({ articles: initialArticles }: { articles: Article[] }) {
  const [articles,     setArticles]     = useState<Article[]>(() => normalizeArticles(initialArticles));
  const [lastUpdated,  setLastUpdated]  = useState<Date>(() => new Date());
  const [,             clockTick]       = useState(0);
  const [activeSource, setActiveSource] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/articles');
      if (!res.ok) return;
      setArticles(normalizeArticles(await res.json()));
      setLastUpdated(new Date());
    } catch {
      // Keep existing articles on failure
    }
  }, []);

  useEffect(() => {
    const refreshInterval = setInterval(refresh, REFRESH_MS);
    const clockInterval   = setInterval(() => clockTick((n) => n + 1), CLOCK_TICK_MS);
    return () => { clearInterval(refreshInterval); clearInterval(clockInterval); };
  }, [refresh]);

  function selectSource(source: string) {
    setActiveSource((prev) => (prev === source ? null : source));
  }

  // In "All" mode: cluster articles, sort by coverage breadth
  // In single-source mode: flat date-ordered list, no clustering
  const view = useMemo(() => {
    if (activeSource !== null) {
      return {
        mode: 'list' as const,
        items: articles.filter((a) => a.source === activeSource),
      };
    }
    return {
      mode: 'clusters' as const,
      items: clusterArticles(articles),
    };
  }, [articles, activeSource]);

  return (
    <>
      <p className="text-xs text-gray-400 mb-4">
        Last updated: {relativeTime(lastUpdated)}
      </p>

      {/* Source filter tabs */}
      <div className="flex gap-x-6 mb-6 border-b border-gray-200 pb-3 overflow-x-auto scrollbar-none">
        <button
          onClick={() => setActiveSource(null)}
          className="text-sm font-semibold pb-3 -mb-3 transition-colors border-b-2 cursor-pointer whitespace-nowrap shrink-0"
          style={activeSource === null
            ? { color: '#111827', borderColor: '#111827' }
            : { color: '#9ca3af', borderColor: 'transparent' }}
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
              {label(source)}
            </button>
          );
        })}
      </div>

      {/* Article / cluster list */}
      {view.items.length === 0 && (
        <p className="text-gray-400 text-sm mt-4">No articles available right now.</p>
      )}

      <ul>
        {view.mode === 'list'
          ? view.items.map((article, i) => (
              <ArticleRow key={`${article.url}-${i}`} article={article} />
            ))
          : view.items.map((cluster) =>
              cluster.sources.length >= 2
                ? <ClusterCard key={cluster.id} cluster={cluster} />
                : <ArticleRow key={cluster.id} article={cluster.articles[0]} />
            )
        }
      </ul>
    </>
  );
}

// ---------------------------------------------------------------------------
// ClusterCard — shown when 2+ sources cover the same story
// ---------------------------------------------------------------------------

function ClusterCard({ cluster }: { cluster: Cluster }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <li className="py-4 border-b border-gray-100 last:border-0">

      {/* Trending / source count badge */}
      <div className="flex items-center gap-2 mb-1.5">
        {cluster.isTrending && (
          <span className="text-[10px] font-bold uppercase tracking-widest text-amber-600">
            Trending
          </span>
        )}
        <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
          {cluster.isTrending ? '·' : ''} {cluster.sources.length} sources
        </span>
      </div>

      {/* Headline — links to the most recent article */}
      <a
        href={cluster.url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-[15px] font-semibold text-gray-900 leading-snug hover:underline decoration-gray-400 underline-offset-2 block mb-2"
      >
        {cluster.title}
      </a>

      {/* Source badges */}
      <div className="flex flex-wrap gap-x-2 gap-y-1 mb-2">
        {cluster.sources.map((source) => (
          <span
            key={source}
            className="text-[11px] font-bold uppercase tracking-wide"
            style={{ color: SOURCE_COLORS[source] ?? '#374151' }}
          >
            {label(source)}
          </span>
        ))}
      </div>

      {/* Snippet */}
      {cluster.snippet && (
        <p className="text-sm text-gray-500 leading-relaxed mb-2">
          {cluster.snippet}
        </p>
      )}

      {/* Expandable article links */}
      <button
        onClick={() => setExpanded((e) => !e)}
        className="text-xs text-gray-400 hover:text-gray-600 cursor-pointer transition-colors"
      >
        {expanded ? '▴ Hide articles' : `▾ See all ${cluster.articles.length} articles`}
      </button>

      {expanded && (
        <ul className="mt-2 space-y-1.5 pl-3 border-l-2 border-gray-100">
          {cluster.articles.map((article, i) => (
            <li key={`${article.url}-${i}`} className="flex items-baseline gap-2">
              <span
                className="text-[10px] font-bold uppercase tracking-wide shrink-0"
                style={{ color: SOURCE_COLORS[article.source] ?? '#374151' }}
              >
                {label(article.source)}
              </span>
              <a
                href={article.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-gray-700 hover:text-blue-600 hover:underline leading-snug"
              >
                {article.title}
              </a>
            </li>
          ))}
        </ul>
      )}

    </li>
  );
}

// ---------------------------------------------------------------------------
// ArticleRow — single article, no clustering
// ---------------------------------------------------------------------------

function ArticleRow({ article }: { article: Article }) {
  const color = SOURCE_COLORS[article.source] ?? '#374151';
  return (
    <li className="py-4 border-b border-gray-100 last:border-0">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xs font-bold uppercase tracking-wide" style={{ color }}>
          {label(article.source)}
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
        <p className="text-sm text-gray-500 mt-1 leading-relaxed">{article.snippet}</p>
      )}
    </li>
  );
}
