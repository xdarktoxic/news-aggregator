// app/page.tsx

import { getAllArticles } from '@/lib/feeds';
import NewsFeed from '@/app/components/NewsFeed';

// Never cache this page — always fetch fresh RSS data on every request
export const revalidate = 0;

export default async function Page() {
  const articles = await getAllArticles();

  return (
    <main className="w-full px-4 md:px-8 py-10">

      {/* ── Masthead ── */}
      <header className="text-center mb-3">
        <h1
          className="pulse-logo"
          style={{
            fontFamily:    'var(--font-serif)',
            fontWeight:    700,
            color:         '#ffffff',
            lineHeight:    1,
            letterSpacing: '-0.01em',
          }}
        >
          Pulse
        </h1>
      </header>

      <NewsFeed articles={articles} />

    </main>
  );
}
