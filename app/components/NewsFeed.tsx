'use client';

// app/components/NewsFeed.tsx
//
// Handles source filtering and article display.
//
// Filter behaviour:
//   - Default ("All"): shows all sources, with a balanced top 10
//   - Click a source pill: shows ONLY that source's articles
//   - Click the active pill again, or click "All": resets to all sources
//
// Balanced top 10 (when "All" is active):
//   Picks the newest article from each of the 5 sources first,
//   then fills the remaining 5 slots with the next newest articles,
//   so one feed can never crowd out the others at the top.

import { useState, useMemo } from 'react';
import { relativeTime, type Article } from '@/lib/feeds';

const ALL_SOURCES = ['Moneycontrol', 'The Hindu', 'Livemint', 'NDTV', 'Hacker News'];

// ---------------------------------------------------------------------------
// getBalancedArticles
//
// Ensures the first 10 articles always include at least one from each source.
// After the top 10, remaining articles continue in chronological order.
// ---------------------------------------------------------------------------

function getBalancedArticles(articles: Article[]): Article[] {
  // Step 1: pick the single newest article from each source
  const pinnedUrls = new Set<string>();
  const pinned: Article[] = [];

  for (const source of ALL_SOURCES) {
    const first = articles.find((a) => a.source === source);
    if (first) {
      pinned.push(first);
      pinnedUrls.add(first.url);
    }
  }

  // Step 2: fill remaining top-10 slots with next-newest articles not already pinned
  const unpinned = articles.filter((a) => !pinnedUrls.has(a.url));
  const slotsLeft = 10 - pinned.length;
  const top10 = [...pinned, ...unpinned.slice(0, slotsLeft)]
    .sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());

  // Step 3: append everything else in chronological order after the top 10
  const top10Urls = new Set(top10.map((a) => a.url));
  const rest = articles.filter((a) => !top10Urls.has(a.url));

  return [...top10, ...rest];
}

// ---------------------------------------------------------------------------
// NewsFeed
// ---------------------------------------------------------------------------

export default function NewsFeed({ articles }: { articles: Article[] }) {
  // null = "All" mode, string = single source selected exclusively
  const [activeSource, setActiveSource] = useState<string | null>(null);

  function selectSource(source: string) {
    // Clicking the already-active pill resets to "All"
    setActiveSource((prev) => (prev === source ? null : source));
  }

  const visible = useMemo(() => {
    if (activeSource !== null) {
      // Show only the selected source
      return articles.filter((a) => a.source === activeSource);
    }
    // Show all sources with balanced top 10
    return getBalancedArticles(articles);
  }, [articles, activeSource]);

  return (
    <>
      {/* Filter pills */}
      <div className="flex flex-wrap gap-2 mb-6">

        {/* "All" pill — resets to the balanced full feed */}
        <button
          onClick={() => setActiveSource(null)}
          className={`px-3 py-1 rounded-full text-sm font-medium border transition-colors cursor-pointer ${
            activeSource === null
              ? 'bg-gray-800 text-white border-gray-800'
              : 'bg-white text-gray-400 border-gray-300 hover:border-gray-500 hover:text-gray-600'
          }`}
        >
          All
        </button>

        {/* One pill per source */}
        {ALL_SOURCES.map((source) => (
          <button
            key={source}
            onClick={() => selectSource(source)}
            className={`px-3 py-1 rounded-full text-sm font-medium border transition-colors cursor-pointer ${
              activeSource === source
                ? 'bg-gray-800 text-white border-gray-800'
                : 'bg-white text-gray-400 border-gray-300 hover:border-gray-500 hover:text-gray-600'
            }`}
          >
            {source}
          </button>
        ))}

      </div>

      {/* Empty state (e.g. a source returned 0 articles) */}
      {visible.length === 0 && (
        <p className="text-gray-400 text-sm">No articles available for this source right now.</p>
      )}

      {/* Article list */}
      <ul className="space-y-4">
        {visible.map((article, index) => (
          <ArticleCard key={`${article.url}-${index}`} article={article} />
        ))}
      </ul>
    </>
  );
}

// ---------------------------------------------------------------------------
// ArticleCard
// ---------------------------------------------------------------------------

function ArticleCard({ article }: { article: Article }) {
  return (
    <li className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">

      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs font-semibold text-white bg-gray-700 rounded px-2 py-0.5">
          {article.source}
        </span>
        <span className="text-xs text-gray-400">
          {relativeTime(article.publishedAt)}
        </span>
      </div>

      <a
        href={article.url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-base font-semibold text-gray-900 hover:text-blue-600 hover:underline leading-snug block"
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
