// app/page.tsx
//
// The homepage. This file's only job is to:
//   1. Fetch all articles on the server (fast, no CORS issues)
//   2. Pass them to NewsFeed, which handles filtering and rendering
//
// Keeping data-fetching here and interactivity in NewsFeed is the
// recommended Next.js pattern for mixing server and client code.

import { getAllArticles } from '@/lib/feeds';
import NewsFeed from '@/app/components/NewsFeed';

export default async function Page() {
  const articles = await getAllArticles();

  return (
    <main className="max-w-3xl mx-auto px-4 py-10">

      <header className="mb-8 border-b-2 border-gray-900 pb-4">
        <h1 className="text-4xl font-extrabold tracking-tight text-gray-900">Indian News</h1>
        <p className="text-sm text-gray-400 mt-1">
          Economic Times · The Hindu · Livemint · NDTV · Yahoo India · India Today · Times of India · Firstpost
        </p>
      </header>

      <NewsFeed articles={articles} />

    </main>
  );
}
