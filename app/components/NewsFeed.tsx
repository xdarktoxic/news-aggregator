'use client';

// app/components/NewsFeed.tsx

import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { relativeTime, type Article } from '@/lib/feeds';
import { clusterArticles, type Cluster } from '@/lib/cluster';
import { CATEGORY_PRIORITY, type Category } from '@/lib/categorize';
import type { ArticleInput } from '@/lib/summarize';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ALL_SOURCES = [
  'Economic Times', 'The Hindu', 'Livemint', 'NDTV',
  'Indian Express', 'India Today', 'Times of India', 'Hindustan Times',
  'CNBC-TV18',
];

const REFRESH_MS    = 15 * 60 * 1000;
const CLOCK_TICK_MS = 60 * 1000;

const SOURCE_LABELS: Record<string, string> = {
  'Economic Times':  'ET',
  'Times of India':  'TOI',
  'Hindustan Times': 'HT',
  'Indian Express':  'IE',
  'CNBC-TV18':       'CNBC',
};

const SOURCE_COLORS: Record<string, string> = {
  'Economic Times':  '#f59e0b',
  'The Hindu':       '#f87171',
  'Livemint':        '#60a5fa',
  'NDTV':            '#fb923c',
  'Indian Express':  '#a78bfa',
  'India Today':     '#38bdf8',
  'Times of India':  '#f87171',
  'Hindustan Times': '#2dd4bf',
  'CNBC-TV18':       '#f43f5e',
};

const CATEGORY_COLOR: Record<Category, string> = {
  Politics:      '#3b82f6',
  Markets:       '#22c55e',
  Sports:        '#f97316',
  World:         '#ef4444',
  Tech:          '#a855f7',
  Entertainment: '#ec4899',
  Lifestyle:     '#14b8a6',
  General:       '#6b7280',
};

const FILTER_CATEGORIES = CATEGORY_PRIORITY.filter((c) => c !== 'General');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sourceLabel(s: string) {
  return SOURCE_LABELS[s] ?? s;
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

function clientCacheKey(articles: Array<{ url: string }>): string {
  return [...articles].map((a) => a.url).sort().join('|');
}

// Hide snippet if it's too similar to the headline (>80% word overlap)
function isSimilarToHeadline(headline: string, snippet: string): boolean {
  if (!snippet || snippet.length < 10) return false;
  const words = (s: string) =>
    new Set(s.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter((w) => w.length > 2));
  const wH = words(headline);
  const wS = words(snippet);
  const [smaller, larger] = wH.size <= wS.size ? [wH, wS] : [wS, wH];
  if (smaller.size === 0) return false;
  let overlap = 0;
  for (const w of smaller) if (larger.has(w)) overlap++;
  return overlap / smaller.size > 0.8;
}

// Strip markdown artifacts (e.g. stray #) from AI-generated text
function cleanAI(text: string): string {
  return text.replace(/#/g, '').replace(/\s{2,}/g, ' ').trim();
}

// ---------------------------------------------------------------------------
// NewsFeed
// ---------------------------------------------------------------------------

export default function NewsFeed({ articles: initialArticles }: { articles: Article[] }) {
  const [articles,       setArticles]      = useState<Article[]>(() => normalizeArticles(initialArticles));
  const [lastUpdated,    setLastUpdated]   = useState<Date>(() => new Date());
  const [,               clockTick]        = useState(0);
  const [activeSource,   setActiveSource]  = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<Category | null>(null);
  const [isFlashing,     setIsFlashing]    = useState(false);
  const [summaries,      setSummaries]     = useState<Map<string, string>>(new Map());
  const [isLoading,      setIsLoading]     = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const flashTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fetchedKeys = useRef<Set<string>>(new Set());

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/articles');
      if (!res.ok) return;
      setArticles(normalizeArticles(await res.json()));
      setLastUpdated(new Date());
      setIsFlashing(false);
      requestAnimationFrame(() => setIsFlashing(true));
      if (flashTimer.current) clearTimeout(flashTimer.current);
      flashTimer.current = setTimeout(() => setIsFlashing(false), 700);
    } catch {}
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => {
    const ri = setInterval(refresh, REFRESH_MS);
    const ci = setInterval(() => clockTick((n) => n + 1), CLOCK_TICK_MS);
    return () => {
      clearInterval(ri);
      clearInterval(ci);
      if (flashTimer.current) clearTimeout(flashTimer.current);
    };
  }, [refresh]);

  useEffect(() => {
    const onScroll = () => {
      const total = document.documentElement.scrollHeight - window.innerHeight;
      setScrollProgress(total > 0 ? (window.scrollY / total) * 100 : 0);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const view = useMemo(() => {
    let filtered = articles;
    if (activeSource   !== null) filtered = filtered.filter((a) => a.source   === activeSource);
    if (activeCategory !== null) filtered = filtered.filter((a) => a.category === activeCategory);
    if (activeSource !== null) return { mode: 'list' as const, items: filtered };
    return { mode: 'clusters' as const, items: clusterArticles(filtered) };
  }, [articles, activeSource, activeCategory]);

  const trendingClusters = useMemo(() =>
    view.mode === 'clusters' ? (view.items as Cluster[]).filter((c) => c.isTrending) : [],
  [view]);

  const latestClusters = useMemo(() =>
    view.mode === 'clusters' ? (view.items as Cluster[]).filter((c) => !c.isTrending) : [],
  [view]);

  const listArticles = useMemo(() =>
    view.mode === 'list' ? (view.items as Article[]) : [],
  [view]);

  // All non-trending clusters sorted newest-first — pure chronological, no type priority
  const moreStoriesItems = useMemo(() =>
    [...latestClusters].sort((a, b) => {
      const ta = a.articles[0]?.publishedAt?.getTime() ?? 0;
      const tb = b.articles[0]?.publishedAt?.getTime() ?? 0;
      return tb - ta;
    }),
  [latestClusters]);

  useEffect(() => {
    for (const cluster of trendingClusters) {
      const key = clientCacheKey(cluster.articles);
      if (fetchedKeys.current.has(key)) continue;
      fetchedKeys.current.add(key);
      const payload: ArticleInput[] = cluster.articles.map((a) => ({
        source: a.source, title: a.title, snippet: a.snippet, url: a.url,
      }));
      fetch('/api/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ articles: payload }),
      })
        .then((r) => r.json())
        .then(({ summary }: { summary: string | null }) => {
          if (summary) setSummaries((prev) => new Map(prev).set(key, cleanAI(summary)));
        })
        .catch(() => {});
    }
  }, [trendingClusters]);

  const isEmpty =
    trendingClusters.length === 0 && latestClusters.length === 0 && listArticles.length === 0;

  return (
    <>
      {/* Scroll progress bar */}
      <div className="scroll-progress" style={{ width: `${scrollProgress}%` }} />

      {/* Loading shimmer bar */}
      {isLoading && <div className="loading-bar" />}

      {/* Tagline + Updated — single centered line */}
      <p
        className={`pulse-tagline text-center mb-4 ${isFlashing ? 'flash-update' : ''}`}
        style={{
          fontFamily:    'var(--font-sans)',
          color:         '#c0c0c0',
          letterSpacing: '0.5px',
        }}
      >
        Your news. Synthesized.&nbsp;&nbsp;·&nbsp;&nbsp;Updated {relativeTime(lastUpdated)}
      </p>

      {/* Masthead divider */}
      <div style={{ borderTop: '1px solid #222222', marginBottom: '20px' }} />

      {/* ── Source filter pills — centered ── */}
      <div className="overflow-x-auto scrollbar-none mb-2">
        <div className="flex justify-center gap-2" style={{ minWidth: 'max-content', margin: '0 auto' }}>
          <FilterPill label="All" isActive={activeSource === null} onClick={() => setActiveSource(null)} />
          {ALL_SOURCES.map((source) => (
            <FilterPill
              key={source}
              label={sourceLabel(source)}
              isActive={activeSource === source}
              onClick={() => setActiveSource((prev) => (prev === source ? null : source))}
            />
          ))}
        </div>
      </div>

      {/* ── Category filter pills — centered ── */}
      <div className="overflow-x-auto scrollbar-none mb-8" style={{ paddingBottom: '4px' }}>
        <div className="flex justify-center gap-2" style={{ minWidth: 'max-content', margin: '0 auto' }}>
          <FilterPill label="All topics" isActive={activeCategory === null} onClick={() => setActiveCategory(null)} small />
          {FILTER_CATEGORIES.map((cat) => (
            <FilterPill
              key={cat}
              label={cat}
              isActive={activeCategory === cat}
              onClick={() => setActiveCategory((prev) => (prev === cat ? null : cat))}
              small
            />
          ))}
        </div>
      </div>

      {isEmpty && (
        <p className="text-center" style={{ color: '#555555', fontSize: '14px' }}>
          No articles match the selected filters.
        </p>
      )}

      {/* ── TRENDING ── */}
      {trendingClusters.length > 0 && (
        <section>
          <SectionHeader label="Trending" color="#ef4444" pulse size="14px" />
          <div className="flex flex-col" style={{ gap: '12px' }}>
            {trendingClusters.map((cluster, i) => (
              <TrendingCard
                key={cluster.id}
                cluster={cluster}
                index={i}
                summary={summaries.get(clientCacheKey(cluster.articles))}
              />
            ))}
          </div>
        </section>
      )}

      {/* ── Divider between sections ── */}
      {trendingClusters.length > 0 && (moreStoriesItems.length > 0 || listArticles.length > 0) && (
        <div style={{ marginTop: '32px', borderTop: '1px solid #222222', marginBottom: '16px' }} />
      )}

      {/* ── MORE STORIES — unified chronological feed with time-block sub-headers ── */}
      {moreStoriesItems.length > 0 && (
        <section>
          <SectionHeader label="More Stories" color="#e5e5e5" rule size="15px" />
          {groupClustersByTime(moreStoriesItems).map((bucket, bi) => (
            <div key={bucket.label}>
              {/* Time bucket sub-header */}
              <div style={{
                display:      'flex',
                alignItems:   'center',
                gap:          '12px',
                marginTop:    bi === 0 ? '4px' : '24px',
                marginBottom: '10px',
              }}>
                <span style={{
                  fontFamily:    'var(--font-sans)',
                  fontSize:      '13px',
                  fontWeight:    700,
                  textTransform: 'uppercase' as const,
                  letterSpacing: '2px',
                  color:         '#c0c0c0',
                  whiteSpace:    'nowrap',
                }}>
                  {bucket.label}
                </span>
                {bucket.label !== 'Just now' && (
                  <div style={{ flex: 1, height: '1px', backgroundColor: '#333333' }} />
                )}
              </div>
              {/* Cards — uniform gap */}
              <div className="flex flex-col" style={{ gap: '8px' }}>
                {bucket.clusters.map((cluster, i) => (
                  <StoryCard key={cluster.id} cluster={cluster} index={i} />
                ))}
              </div>
            </div>
          ))}
        </section>
      )}

      {/* ── LIST MODE (source filter active) ── */}
      {listArticles.length > 0 && (
        <div className="flex flex-col" style={{ gap: '8px' }}>
          {listArticles.map((article, i) => (
            <ArticleRow key={`${article.url}-${i}`} article={article} index={i} />
          ))}
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Helpers (component-local)
// ---------------------------------------------------------------------------

// Shows first 3 sources, then "+X more" — avoids long comma chains at 5+ sources
function SourceList({ sources }: { sources: string[] }) {
  const visible = sources.slice(0, 3);
  const extra   = sources.length - 3;
  return (
    <>
      {visible.map((s) => sourceLabel(s)).join(' · ')}
      {extra > 0 && <span style={{ color: '#555555' }}> +{extra} more</span>}
    </>
  );
}

// Groups clusters into time buckets (newest-first within each bucket)
function groupClustersByTime(clusters: Cluster[]): { label: string; clusters: Cluster[] }[] {
  const now   = Date.now();
  const order = ['Just now', 'Few hours ago', 'Earlier today'] as const;
  const map   = Object.fromEntries(order.map((l) => [l, [] as Cluster[]]));

  for (const c of clusters) {
    const date = c.articles[0]?.publishedAt;
    const mins = date ? (now - date.getTime()) / 60_000 : Infinity;
    const label =
      mins < 60  ? 'Just now'
      : mins < 240 ? 'Few hours ago'
      :              'Earlier today';
    map[label].push(c);
  }

  return order
    .filter((l) => map[l].length > 0)
    .map((l) => ({ label: l, clusters: map[l] }));
}

// Short timestamps for single-source article rows ("8m" instead of "8m ago")
function shortTime(date: Date): string {
  const diffMs   = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  if (diffMins <  1)  return 'now';
  if (diffMins < 60)  return `${diffMins}m`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h`;
  return `${Math.floor(diffHours / 24)}d`;
}

// ---------------------------------------------------------------------------
// SectionHeader
// ---------------------------------------------------------------------------

function SectionHeader({ label, color, pulse = false, rule = false, size = '14px' }: {
  label: string; color: string; pulse?: boolean; rule?: boolean; size?: string;
}) {
  return (
    <div className="flex items-center gap-3 mb-3 card-animate">
      {pulse && (
        <span
          className="heartbeat shrink-0 rounded-full"
          style={{ width: '10px', height: '10px', backgroundColor: color }}
        />
      )}
      <span style={{
        color,
        fontSize:      size,
        fontWeight:    700,
        textTransform: 'uppercase' as const,
        letterSpacing: '3px',
        fontFamily:    'var(--font-sans)',
        whiteSpace:    'nowrap',
      }}>
        {label}
      </span>
      {rule && (
        <div style={{ flex: 1, height: '1px', backgroundColor: '#333333' }} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// FilterPill
// ---------------------------------------------------------------------------

function FilterPill({ label, isActive, onClick, small = false }: {
  label: string; isActive: boolean; onClick: () => void; small?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className="filter-pill shrink-0 cursor-pointer transition-all duration-200"
      style={{
        fontFamily:      'var(--font-sans)',
        fontSize:        '13px',
        fontWeight:      isActive ? 600 : 400,
        padding:         small ? '5px 14px' : '8px 16px',
        borderRadius:    '20px',
        color:           isActive ? '#0a0a0a' : '#888888',
        backgroundColor: isActive ? '#ffffff' : 'transparent',
        border:          isActive ? '1px solid #ffffff' : '1px solid #333333',
      }}
    >
      {label}
    </button>
  );
}

// ---------------------------------------------------------------------------
// CategoryTag
// ---------------------------------------------------------------------------

function CategoryTag({ category }: { category: Category }) {
  const color = CATEGORY_COLOR[category];
  return (
    <span className="inline-flex items-center gap-1">
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
      <span style={{
        fontSize:      '10px',
        fontWeight:    600,
        textTransform: 'uppercase' as const,
        letterSpacing: '0.05em',
        color,
        fontFamily:    'var(--font-sans)',
      }}>
        {category}
      </span>
    </span>
  );
}

// ---------------------------------------------------------------------------
// TrendingCard — full-featured card for 3+ source clusters
// ---------------------------------------------------------------------------

function TrendingCard({ cluster, index, summary }: {
  cluster: Cluster; index: number; summary?: string;
}) {
  const [expanded, setExpanded]   = useState(false);
  const [hovered,  setHovered]    = useState(false);
  const catColor = CATEGORY_COLOR[cluster.category];
  const clean    = summary ? cleanAI(summary) : null;

  return (
    <div
      className="card-animate"
      style={{
        animationDelay:  `${index * 50}ms`,
        backgroundColor: hovered ? '#1a1a1a' : '#141414',
        border:          '1px solid #1f1f1f',
        borderLeft:      `3px solid ${catColor}`,
        borderRadius:    '6px',
        padding:         '20px 24px',
        paddingLeft:     '22px',
        transition:      'background-color 200ms ease, transform 200ms ease, box-shadow 200ms ease',
        transform:       hovered ? 'translateY(-2px)' : 'translateY(0)',
        boxShadow:       hovered ? `0 4px 20px rgba(0,0,0,0.4), -3px 0 12px ${catColor}33` : 'none',
        cursor:          'default',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Meta row: trending indicator + category tag */}
      <div className="flex items-center gap-2 mb-3">
        <span
          className="heartbeat shrink-0 rounded-full"
          style={{ width: '10px', height: '10px', backgroundColor: '#ef4444' }}
        />
        <span style={{
          color:         '#ef4444',
          fontSize:      '14px',
          fontWeight:    700,
          textTransform: 'uppercase' as const,
          letterSpacing: '0.5px',
          fontFamily:    'var(--font-sans)',
        }}>
          Trending · {cluster.sources.length} sources
        </span>
        <span className="ml-auto">
          <CategoryTag category={cluster.category} />
        </span>
      </div>

      {/* Headline */}
      <a
        href={cluster.url}
        target="_blank"
        rel="noopener noreferrer"
        className="headline-trending block mb-3 hover:opacity-80 transition-opacity"
        style={{
          fontFamily: 'var(--font-serif)',
          fontWeight: 700,
          lineHeight: 1.3,
          color:      '#e5e5e5',
        }}
      >
        {cluster.title}
      </a>

      {/* Sources */}
      <p style={{
        color:         '#666666',
        fontSize:      '11px',
        textTransform: 'uppercase' as const,
        letterSpacing: '0.5px',
        fontFamily:    'var(--font-sans)',
        marginBottom:  clean || cluster.snippet ? '0' : '12px',
      }}>
        <SourceList sources={cluster.sources} />
      </p>

      {/* AI summary or RSS snippet */}
      {clean ? (
        <div style={{ marginTop: '12px', marginBottom: '12px' }}>
          <p style={{
            color:         '#888888',
            fontSize:      '11px',
            textTransform: 'uppercase' as const,
            letterSpacing: '1.5px',
            fontFamily:    'var(--font-sans)',
            marginBottom:  '6px',
          }}>
            ✦ AI Summary
          </p>
          <p className="ai-summary" style={{ color: '#c0c0c0', fontSize: '14px', lineHeight: 1.7, fontFamily: 'var(--font-sans)' }}>{clean}</p>
        </div>
      ) : cluster.snippet ? (
        <p style={{ color: '#999999', fontSize: '13px', lineHeight: 1.6, fontFamily: 'var(--font-sans)', marginTop: '8px', marginBottom: '12px', whiteSpace: 'normal', wordWrap: 'break-word' }}>{cluster.snippet}</p>
      ) : (
        <div style={{ marginBottom: '12px' }} />
      )}

      {/* Expand toggle */}
      <button
        onClick={() => setExpanded((e) => !e)}
        className="view-sources-btn"
      >
        {expanded ? 'Hide ‹' : `View ${cluster.sources.length} sources ›`}
      </button>

      {expanded && (
        <ul
          className="sources-expand mt-3 space-y-2 pl-3"
          style={{ borderLeft: '2px solid #222222' }}
        >
          {cluster.articles.map((article, i) => (
            <li
              key={`${article.url}-${i}`}
              className="flex items-baseline gap-2"
              style={{ animation: 'fadeInUp 0.2s ease-out both', animationDelay: `${i * 50}ms` }}
            >
              <span style={{
                color:         SOURCE_COLORS[article.source] ?? '#888',
                fontSize:      '10px',
                fontWeight:    700,
                textTransform: 'uppercase' as const,
                letterSpacing: '0.05em',
                flexShrink:    0,
                fontFamily:    'var(--font-sans)',
              }}>
                {sourceLabel(article.source)}
              </span>
              <a
                href={article.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: '#777777', fontSize: '13px', lineHeight: 1.4, fontFamily: 'var(--font-sans)' }}
                onMouseEnter={(e) => ((e.target as HTMLElement).style.color = '#e5e5e5')}
                onMouseLeave={(e) => ((e.target as HTMLElement).style.color = '#777777')}
              >
                {article.title}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// StoryCard — uniform card for ALL non-trending stories (multi- and single-source)
// ---------------------------------------------------------------------------

function StoryCard({ cluster, index }: { cluster: Cluster; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const [hovered,  setHovered]  = useState(false);
  const isMulti    = cluster.sources.length >= 2;
  const catColor   = CATEGORY_COLOR[cluster.category];
  const article    = cluster.articles[0];
  const sourceColor = SOURCE_COLORS[article?.source ?? ''] ?? '#888888';
  const rawSnippet = cluster.snippet ?? article?.snippet ?? '';
  const snippet    = rawSnippet && !isSimilarToHeadline(cluster.title, rawSnippet) ? rawSnippet : null;

  return (
    <div
      className="card-animate"
      style={{
        animationDelay:  `${index * 50}ms`,
        backgroundColor: hovered ? '#1a1a1a' : '#141414',
        border:          '1px solid #222222',
        borderLeft:      isMulti ? `3px solid ${catColor}` : '1px solid #222222',
        borderRadius:    '6px',
        padding:         '20px 24px',
        paddingLeft:     isMulti ? '22px' : '24px',
        transition:      'background-color 200ms ease',
        cursor:          'default',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {isMulti ? (
        /* ── Multi-source layout ── */
        <>
          <div className="flex items-start gap-3 mb-2">
            <a
              href={cluster.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                flex:       1,
                fontFamily: 'var(--font-sans)',
                fontSize:   '18px',
                fontWeight: 600,
                lineHeight: 1.35,
                color:      hovered ? '#e5e5e5' : '#e0e0e0',
                transition: 'color 200ms ease',
              }}
            >
              {cluster.title}
            </a>
            <span className="shrink-0" style={{ paddingTop: '3px' }}>
              <CategoryTag category={cluster.category} />
            </span>
          </div>

          <p style={{
            color:         '#666666',
            fontSize:      '11px',
            textTransform: 'uppercase' as const,
            letterSpacing: '0.5px',
            fontFamily:    'var(--font-sans)',
            marginBottom:  snippet ? '4px' : '8px',
          }}>
            <SourceList sources={cluster.sources} />
          </p>

          {snippet && (
            <p style={{ color: '#999999', fontSize: '13px', lineHeight: 1.6, fontFamily: 'var(--font-sans)', marginBottom: '8px', whiteSpace: 'normal', wordWrap: 'break-word' }}>
              {snippet}
            </p>
          )}

          <button onClick={() => setExpanded((e) => !e)} className="view-sources-btn">
            {expanded ? 'Hide ‹' : `View ${cluster.sources.length} sources ›`}
          </button>

          {expanded && (
            <ul className="sources-expand mt-2 space-y-1.5 pl-3" style={{ borderLeft: '2px solid #222222' }}>
              {cluster.articles.map((a, i) => (
                <li
                  key={`${a.url}-${i}`}
                  className="flex items-baseline gap-2"
                  style={{ animation: 'fadeInUp 0.2s ease-out both', animationDelay: `${i * 50}ms` }}
                >
                  <span style={{ color: SOURCE_COLORS[a.source] ?? '#888', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.05em', flexShrink: 0, fontFamily: 'var(--font-sans)' }}>
                    {sourceLabel(a.source)}
                  </span>
                  <a
                    href={a.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: '#777777', fontSize: '13px', lineHeight: 1.4, fontFamily: 'var(--font-sans)' }}
                    onMouseEnter={(e) => ((e.target as HTMLElement).style.color = '#e5e5e5')}
                    onMouseLeave={(e) => ((e.target as HTMLElement).style.color = '#777777')}
                  >
                    {a.title}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : (
        /* ── Single-source layout ── */
        <>
          <div className="flex items-center gap-2 mb-2">
            <span style={{ color: sourceColor, fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.5px', fontFamily: 'var(--font-sans)' }}>
              {sourceLabel(article.source)}
            </span>
            <span style={{ color: '#555555', fontSize: '11px', fontFamily: 'var(--font-sans)' }}>
              {shortTime(article.publishedAt)}
            </span>
            <span className="ml-auto">
              <CategoryTag category={cluster.category} />
            </span>
          </div>

          <a
            href={cluster.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display:    'block',
              fontFamily: 'var(--font-sans)',
              fontSize:   '18px',
              fontWeight: 600,
              lineHeight: 1.35,
              color:      hovered ? '#e5e5e5' : '#e0e0e0',
              transition: 'color 200ms ease',
            }}
          >
            {cluster.title}
          </a>

          {snippet && (
            <p style={{ color: '#999999', fontSize: '13px', lineHeight: 1.6, fontFamily: 'var(--font-sans)', marginTop: '4px', whiteSpace: 'normal', wordWrap: 'break-word' }}>
              {snippet}
            </p>
          )}
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ArticleRow — used only in list mode (source filter active)
// ---------------------------------------------------------------------------

function ArticleRow({ article, index }: { article: Article; index: number }) {
  const [hovered,   setHovered]  = useState(false);
  const sourceColor = SOURCE_COLORS[article.source] ?? '#888888';
  const snippet     = isSimilarToHeadline(article.title, article.snippet) ? null : article.snippet;

  return (
    <div
      className="card-animate"
      style={{
        animationDelay:  `${index * 50}ms`,
        backgroundColor: hovered ? '#1a1a1a' : '#141414',
        border:          '1px solid #222222',
        borderRadius:    '6px',
        padding:         '16px 20px',
        transition:      'background-color 200ms ease',
        cursor:          'default',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="flex items-center gap-2 mb-2">
        <span style={{ color: sourceColor, fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.5px', fontFamily: 'var(--font-sans)' }}>
          {sourceLabel(article.source)}
        </span>
        <span style={{ color: '#555555', fontSize: '11px', fontFamily: 'var(--font-sans)' }}>
          {shortTime(article.publishedAt)}
        </span>
        <span className="ml-auto"><CategoryTag category={article.category} /></span>
      </div>
      <a
        href={article.url}
        target="_blank"
        rel="noopener noreferrer"
        style={{ display: 'block', fontFamily: 'var(--font-sans)', fontSize: '17px', fontWeight: 600, lineHeight: 1.35, color: hovered ? '#e5e5e5' : '#e0e0e0', transition: 'color 200ms ease' }}
      >
        {article.title}
      </a>
      {snippet && (
        <p style={{ color: '#999999', fontSize: '13px', lineHeight: 1.6, fontFamily: 'var(--font-sans)', marginTop: '4px', whiteSpace: 'normal', wordWrap: 'break-word' }}>{snippet}</p>
      )}
    </div>
  );
}
