'use client';

// app/components/NewsFeed.tsx
//
// Handles source filtering and article display.
//
// Filter behaviour:
//   - Default ("All"): shows all sources with a balanced top 10 (max 2 per source)
//   - Click a source tab: shows ONLY that source
//   - Click the active tab again, or click "All": resets

import { useState, useMemo } from 'react';
import { relativeTime, type Article } from '@/lib/feeds';

const ALL_SOURCES = ['Moneycontrol', 'The Hindu', 'Livemint', 'NDTV', 'Yahoo India'];

// A distinct accent color for each source — used on the source label and active tab indicator
const SOURCE_COLORS: Record<string, string> = {
  'Moneycontrol': '#0a7c42',
  'The Hindu':    '#b91c1c',
  'Livemint':     '#1d4ed8',
  'NDTV':         '#c2410c',
  'Yahoo India':  '#7e22ce',
};

// ---------------------------------------------------------------------------
// getBalancedArticles — max 2 per source in the top 10
// ---------------------------------------------------------------------------

function getBalancedArticles(articles: Article[]): Article[] {
  const top10Urls = new Set<string>();
  const top10: Article[] = [];

  for (const source of ALL_SOURCES) {
    const fromSource = articles.filter((a) => a.source === source).slice(0, 2);
    for (const a of fromSource) {
      top10.push(a);
      top10Urls.add(a.url);
    }
  }

  top10.sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());
  const rest = articles.filter((a) => !top10Urls.has(a.url));
  return [...top10, ...rest];
}

// ---------------------------------------------------------------------------
// NewsFeed
// ---------------------------------------------------------------------------

export default function NewsFeed({ articles }: { articles: Article[] }) {
  const [activeSource, setActiveSource] = useState<string | null>(null);

  function selectSource(source: string) {
    setActiveSource((prev) => (prev === source ? null : source));
  }

  const visible = useMemo(() => {
    if (activeSource !== null) {
      return articles.filter((a) => a.source === activeSource);
    }
    return getBalancedArticles(articles);
  }, [articles, activeSource]);

  return (
    <>
      {/* Source filter tabs */}
      <div className="flex flex-wrap gap-x-6 gap-y-2 mb-6 border-b border-gray-200 pb-3">

        <button
          onClick={() => setActiveSource(null)}
          className="text-sm font-semibold pb-3 -mb-3 transition-colors border-b-2 cursor-pointer"
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
          const color = SOURCE_COLORS[source];
          return (
            <button
              key={source}
              onClick={() => selectSource(source)}
              className="text-sm font-semibold pb-3 -mb-3 transition-colors border-b-2 cursor-pointer"
              style={{
                color:       isActive ? color : '#9ca3af',
                borderColor: isActive ? color : 'transparent',
              }}
            >
              {source}
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
// ArticleRow — editorial list style, no card box
// ---------------------------------------------------------------------------

function ArticleRow({ article }: { article: Article }) {
  const color = SOURCE_COLORS[article.source] ?? '#374151';

  return (
    <li className="py-4 border-b border-gray-100 last:border-0">

      {/* Source + timestamp on one line */}
      <div className="flex items-center gap-2 mb-1">
        <span
          className="text-xs font-bold uppercase tracking-wide"
          style={{ color }}
        >
          {article.source}
        </span>
        <span className="text-xs text-gray-400">{relativeTime(article.publishedAt)}</span>
      </div>

      {/* Headline */}
      <a
        href={article.url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-[15px] font-semibold text-gray-900 leading-snug hover:underline decoration-gray-400 underline-offset-2 block"
      >
        {article.title}
      </a>

      {/* Snippet */}
      {article.snippet && (
        <p className="text-sm text-gray-500 mt-1 leading-relaxed">
          {article.snippet}
        </p>
      )}

    </li>
  );
}
