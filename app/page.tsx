// app/page.tsx
//
// The homepage of the news aggregator.
//
// This is a "Server Component" — Next.js runs this code on the server,
// fetches all the articles, builds the HTML, and sends it to the browser.
// The browser receives a fully-rendered page (fast, good for SEO).
//
// There is no client-side JavaScript for this page — it's pure HTML + CSS.

import { getAllArticles, relativeTime, type Article } from '@/lib/feeds';

// ---------------------------------------------------------------------------
// Page (default export)
//
// Next.js calls this function when someone visits "/".
// Because it's async, we can fetch data directly inside it.
// ---------------------------------------------------------------------------

export default async function Page() {
  const articles = await getAllArticles();

  return (
    <main className="max-w-3xl mx-auto px-4 py-10">

      {/* Header */}
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Indian News</h1>
        <p className="text-sm text-gray-500 mt-1">
          Latest from Moneycontrol, The Hindu, Livemint, NDTV &amp; Hacker News
        </p>
      </header>

      {/* No articles fallback */}
      {articles.length === 0 && (
        <p className="text-gray-500">
          Could not load any feeds right now. Please try refreshing the page.
        </p>
      )}

      {/* Article list */}
      <ul className="space-y-4">
        {articles.map((article, index) => (
          <ArticleCard key={`${article.url}-${index}`} article={article} />
        ))}
      </ul>

    </main>
  );
}

// ---------------------------------------------------------------------------
// ArticleCard
//
// Renders a single article. Kept as a separate component so it's easy to
// change the design later without touching the data-fetching logic above.
// ---------------------------------------------------------------------------

function ArticleCard({ article }: { article: Article }) {
  return (
    <li className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">

      {/* Top row: source badge + timestamp */}
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs font-semibold text-white bg-gray-700 rounded px-2 py-0.5">
          {article.source}
        </span>
        <span className="text-xs text-gray-400">
          {relativeTime(article.publishedAt)}
        </span>
      </div>

      {/* Headline — clicking opens the original article in a new tab */}
      <a
        href={article.url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-base font-semibold text-gray-900 hover:text-blue-600 hover:underline leading-snug block"
      >
        {article.title}
      </a>

      {/* Description snippet */}
      {article.snippet && (
        <p className="text-sm text-gray-500 mt-1 leading-relaxed">
          {article.snippet}
        </p>
      )}

    </li>
  );
}
