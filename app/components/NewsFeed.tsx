'use client';

// app/components/NewsFeed.tsx
//
// This is a "Client Component" — it runs in the browser so it can respond
// to clicks (the filter pills). The articles themselves are fetched on the
// server (in page.tsx) and passed in as a prop, so there's no loading delay.
//
// What it does:
//   - Renders a pill/button for each source
//   - Tracks which sources are active (all on by default)
//   - Filters the article list to only show active sources

import { useState } from 'react';
import { relativeTime, type Article } from '@/lib/feeds';

// The full list of sources — must match the names used in lib/feeds.ts
const ALL_SOURCES = ['Moneycontrol', 'The Hindu', 'Livemint', 'NDTV', 'Hacker News'];

export default function NewsFeed({ articles }: { articles: Article[] }) {
  // activeSources is a Set of source names that are currently "on"
  // Starts with all sources selected
  const [activeSources, setActiveSources] = useState<Set<string>>(
    new Set(ALL_SOURCES)
  );

  // Toggle a source on or off when its pill is clicked
  function toggle(source: string) {
    setActiveSources((prev) => {
      const next = new Set(prev);
      if (next.has(source)) {
        next.delete(source);
      } else {
        next.add(source);
      }
      return next;
    });
  }

  // Only show articles whose source is currently active
  const visible = articles.filter((a) => activeSources.has(a.source));

  return (
    <>
      {/* Filter pills */}
      <div className="flex flex-wrap gap-2 mb-6">
        {ALL_SOURCES.map((source) => {
          const isActive = activeSources.has(source);
          return (
            <button
              key={source}
              onClick={() => toggle(source)}
              className={`px-3 py-1 rounded-full text-sm font-medium border transition-colors cursor-pointer ${
                isActive
                  ? 'bg-gray-800 text-white border-gray-800'
                  : 'bg-white text-gray-400 border-gray-300 hover:border-gray-500 hover:text-gray-600'
              }`}
            >
              {source}
            </button>
          );
        })}
      </div>

      {/* Empty state */}
      {visible.length === 0 && (
        <p className="text-gray-400 text-sm">
          No sources selected. Click a pill above to show articles.
        </p>
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
// ArticleCard — moved here from page.tsx since it lives alongside the list
// ---------------------------------------------------------------------------

function ArticleCard({ article }: { article: Article }) {
  return (
    <li className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">

      {/* Source badge + timestamp */}
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs font-semibold text-white bg-gray-700 rounded px-2 py-0.5">
          {article.source}
        </span>
        <span className="text-xs text-gray-400">
          {relativeTime(article.publishedAt)}
        </span>
      </div>

      {/* Headline */}
      <a
        href={article.url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-base font-semibold text-gray-900 hover:text-blue-600 hover:underline leading-snug block"
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
