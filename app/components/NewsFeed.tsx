'use client';

// app/components/NewsFeed.tsx
//
// Handles source filtering, category filtering, story clustering,
// article display, and auto-refresh.
//
// Filter logic:
//   - Source filter and category filter work together (AND)
//   - Both default to "All" (no filter)
//   - Clicking an active filter resets it to "All"
//
// Clustering:
//   - Active in "All source" mode only (disabled when a source is selected)
//   - Applied AFTER category filter, so selecting "Politics" shows clustered political stories
//   - Multi-source clusters → ClusterCard; single-source → ArticleRow

import { useState, useMemo, useEffect, useCallback } from 'react';
import { relativeTime, type Article } from '@/lib/feeds';
import { clusterArticles, type Cluster } from '@/lib/cluster';
import { CATEGORY_PRIORITY, type Category } from '@/lib/categorize';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

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

// Tab underline color + pill background/text for each category
const CATEGORY_STYLE: Record<Category, { tab: string; bg: string; text: string }> = {
  Politics:      { tab: '#1d4ed8', bg: '#eff6ff', text: '#1d4ed8' },
  Markets:       { tab: '#16a34a', bg: '#f0fdf4', text: '#15803d' },
  Sports:        { tab: '#ea580c', bg: '#fff7ed', text: '#c2410c' },
  World:         { tab: '#dc2626', bg: '#fef2f2', text: '#b91c1c' },
  Tech:          { tab: '#7c3aed', bg: '#f5f3ff', text: '#6d28d9' },
  Entertainment: { tab: '#c026d3', bg: '#fdf4ff', text: '#a21caf' },
  Lifestyle:     { tab: '#0d9488', bg: '#f0fdfa', text: '#0f766e' },
  General:       { tab: '#6b7280', bg: '#f9fafb', text: '#4b5563' },
};

// Display categories in filter row (skip General — it's the default)
const FILTER_CATEGORIES = CATEGORY_PRIORITY.filter((c) => c !== 'General');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sourceLabel(source: string) {
  return SOURCE_LABELS[source] ?? source;
}

function normalizeArticles(
  raw: (Article | (Omit<Article, 'publishedAt'> & { publishedAt: string | Date }))[]
): Article[] {
  return raw.map((a) => ({
    ...a,
    publishedAt: a.publishedAt instanceof Date ? a.publishedAt : new Date(a.publishedAt),
    category: (a as Article).category ?? 'General',
  }));
}

// ---------------------------------------------------------------------------
// NewsFeed
// ---------------------------------------------------------------------------

export default function NewsFeed({ articles: initialArticles }: { articles: Article[] }) {
  const [articles,      setArticles]      = useState<Article[]>(() => normalizeArticles(initialArticles));
  const [lastUpdated,   setLastUpdated]   = useState<Date>(() => new Date());
  const [,              clockTick]        = useState(0);
  const [activeSource,  setActiveSource]  = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<Category | null>(null);

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
    const ri = setInterval(refresh, REFRESH_MS);
    const ci = setInterval(() => clockTick((n) => n + 1), CLOCK_TICK_MS);
    return () => { clearInterval(ri); clearInterval(ci); };
  }, [refresh]);

  function selectSource(source: string) {
    setActiveSource((prev) => (prev === source ? null : source));
  }

  function selectCategory(cat: Category) {
    setActiveCategory((prev) => (prev === cat ? null : cat));
  }

  const view = useMemo(() => {
    // Apply both filters (AND logic)
    let filtered = articles;
    if (activeSource   !== null) filtered = filtered.filter((a) => a.source   === activeSource);
    if (activeCategory !== null) filtered = filtered.filter((a) => a.category === activeCategory);

    // Cluster only when no source is selected
    if (activeSource !== null) {
      return { mode: 'list' as const, items: filtered };
    }
    return { mode: 'clusters' as const, items: clusterArticles(filtered) };
  }, [articles, activeSource, activeCategory]);

  return (
    <>
      <p className="text-xs text-gray-400 mb-4">
        Last updated: {relativeTime(lastUpdated)}
      </p>

      {/* ── Row 1: Source filter tabs ── */}
      <div className="flex gap-x-6 border-b border-gray-200 pb-3 overflow-x-auto scrollbar-none">
        <TabButton
          label="All"
          isActive={activeSource === null}
          activeColor="#111827"
          onClick={() => setActiveSource(null)}
        />
        {ALL_SOURCES.map((source) => (
          <TabButton
            key={source}
            label={sourceLabel(source)}
            isActive={activeSource === source}
            activeColor={SOURCE_COLORS[source]}
            onClick={() => selectSource(source)}
          />
        ))}
      </div>

      {/* ── Row 2: Category filter tabs ── */}
      <div className="flex gap-x-5 mt-3 mb-6 border-b border-gray-100 pb-3 overflow-x-auto scrollbar-none">
        <TabButton
          label="All topics"
          isActive={activeCategory === null}
          activeColor="#111827"
          onClick={() => setActiveCategory(null)}
          small
        />
        {FILTER_CATEGORIES.map((cat) => (
          <TabButton
            key={cat}
            label={cat}
            isActive={activeCategory === cat}
            activeColor={CATEGORY_STYLE[cat].tab}
            onClick={() => selectCategory(cat)}
            small
          />
        ))}
      </div>

      {/* Article / cluster list */}
      {view.items.length === 0 && (
        <p className="text-gray-400 text-sm mt-4">No articles match the selected filters.</p>
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
// TabButton — reused for both filter rows
// ---------------------------------------------------------------------------

function TabButton({
  label, isActive, activeColor, onClick, small = false,
}: {
  label: string;
  isActive: boolean;
  activeColor: string;
  onClick: () => void;
  small?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`${small ? 'text-xs' : 'text-sm'} font-semibold pb-3 -mb-3 transition-colors border-b-2 cursor-pointer whitespace-nowrap shrink-0`}
      style={{
        color:       isActive ? activeColor : '#9ca3af',
        borderColor: isActive ? activeColor : 'transparent',
      }}
    >
      {label}
    </button>
  );
}

// ---------------------------------------------------------------------------
// CategoryPill — small colored pill shown on every article/cluster
// ---------------------------------------------------------------------------

function CategoryPill({ category }: { category: Category }) {
  const style = CATEGORY_STYLE[category];
  return (
    <span
      className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
      style={{ backgroundColor: style.bg, color: style.text }}
    >
      {category}
    </span>
  );
}

// ---------------------------------------------------------------------------
// ClusterCard
// ---------------------------------------------------------------------------

function ClusterCard({ cluster }: { cluster: Cluster }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <li className="py-4 border-b border-gray-100 last:border-0">

      {/* Trending / source count + category */}
      <div className="flex items-center gap-2 mb-1.5">
        {cluster.isTrending && (
          <span className="text-[10px] font-bold uppercase tracking-widest text-amber-600">
            Trending
          </span>
        )}
        <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
          {cluster.isTrending ? '·' : ''} {cluster.sources.length} sources
        </span>
        <CategoryPill category={cluster.category} />
      </div>

      {/* Headline */}
      <a
        href={cluster.url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-[15px] font-semibold text-gray-900 leading-snug hover:underline decoration-gray-400 underline-offset-2 block mb-2"
      >
        {cluster.title}
      </a>

      {/* Source labels */}
      <div className="flex flex-wrap gap-x-2 gap-y-1 mb-2">
        {cluster.sources.map((source) => (
          <span
            key={source}
            className="text-[11px] font-bold uppercase tracking-wide"
            style={{ color: SOURCE_COLORS[source] ?? '#374151' }}
          >
            {sourceLabel(source)}
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
                {sourceLabel(article.source)}
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
// ArticleRow
// ---------------------------------------------------------------------------

function ArticleRow({ article }: { article: Article }) {
  const color = SOURCE_COLORS[article.source] ?? '#374151';
  return (
    <li className="py-4 border-b border-gray-100 last:border-0">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xs font-bold uppercase tracking-wide" style={{ color }}>
          {sourceLabel(article.source)}
        </span>
        <span className="text-xs text-gray-400">{relativeTime(article.publishedAt)}</span>
        <CategoryPill category={article.category} />
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
