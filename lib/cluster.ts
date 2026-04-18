// lib/cluster.ts
//
// Story clustering — groups articles covering the same event into one card.
//
// ALGORITHM (word-overlap, no AI required):
//   1. Normalize each title: lowercase, strip punctuation, remove stopwords
//   2. For each article, check if it overlaps with an existing cluster by
//      counting shared significant words. Threshold: 3+ shared words = same story.
//   3. If a match is found, add the article to that cluster and expand the
//      cluster's word set (union) so future articles can match via any member.
//   4. If no match, start a new cluster.
//   5. After clustering, keep only clusters with 2+ unique sources as "real"
//      clusters (same-source duplicates stay as individual articles).
//   6. Sort: multi-source clusters first (by source count desc), then by
//      most recent article time.
//
// This file is intentionally kept separate from the UI so we can swap the
// algorithm later (e.g. embedding-based AI clustering) without touching components.

import type { Article } from './feeds';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Cluster = {
  id: string;
  title: string;       // headline from the most recent article
  snippet: string;     // snippet from the most recent article
  url: string;         // link from the most recent article
  articles: Article[]; // all articles, sorted newest-first
  sources: string[];   // unique source names in this cluster
  latestAt: Date;
  isTrending: boolean; // true when 3+ unique sources cover this story
};

// ---------------------------------------------------------------------------
// Stopwords — common words that carry no story-matching signal
// ---------------------------------------------------------------------------

const STOPWORDS = new Set([
  'the', 'a', 'an', 'in', 'on', 'at', 'for', 'to', 'is', 'of', 'and',
  'says', 'said', 'that', 'with', 'from', 'by', 'as', 'its', 'are',
  'was', 'be', 'has', 'have', 'it', 'this', 'after', 'over', 'up',
  'about', 'into', 'will', 'not', 'but', 'or', 'new', 'more', 'than',
  'he', 'she', 'his', 'her', 'they', 'their', 'we', 'who', 'how',
  'all', 'amid', 'after', 'before', 'during', 'out', 'no', 'amid',
]);

// ---------------------------------------------------------------------------
// getSignificantWords
//
// Strips punctuation, lowercases, removes stopwords and very short words.
// Returns a Set so intersection checks are O(n).
// ---------------------------------------------------------------------------

function getSignificantWords(title: string): Set<string> {
  return new Set(
    title
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOPWORDS.has(w))
  );
}

// ---------------------------------------------------------------------------
// countOverlap — count shared words between two Sets
// ---------------------------------------------------------------------------

function countOverlap(a: Set<string>, b: Set<string>): number {
  let count = 0;
  // Iterate the smaller set for efficiency
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  for (const word of small) {
    if (large.has(word)) count++;
  }
  return count;
}

// ---------------------------------------------------------------------------
// clusterArticles  (exported — called by NewsFeed)
//
// Takes the full sorted article list and returns an array of Clusters.
// Articles that don't match any cluster become single-article Clusters.
// ---------------------------------------------------------------------------

const OVERLAP_THRESHOLD = 3; // shared significant words needed to group

export function clusterArticles(articles: Article[]): Cluster[] {
  // Internal working structure while we build clusters
  type RawCluster = {
    words: Set<string>; // union of all member article words
    articles: Article[];
  };

  const raw: RawCluster[] = [];

  for (const article of articles) {
    const words = getSignificantWords(article.title);

    // Try to find an existing cluster with enough word overlap
    let matched = false;
    for (const cluster of raw) {
      if (countOverlap(cluster.words, words) >= OVERLAP_THRESHOLD) {
        cluster.articles.push(article);
        // Expand the cluster's word set so later articles can match via any member
        for (const w of words) cluster.words.add(w);
        matched = true;
        break;
      }
    }

    if (!matched) {
      raw.push({ words, articles: [article] });
    }
  }

  // Convert raw clusters → typed Cluster objects
  const clusters: Cluster[] = raw.map((raw, i) => {
    // Sort articles within the cluster newest-first
    const sorted = [...raw.articles].sort(
      (a, b) => b.publishedAt.getTime() - a.publishedAt.getTime()
    );
    const latest = sorted[0];
    const sources = [...new Set(sorted.map((a) => a.source))];

    return {
      id:          `cluster-${i}-${latest.url}`,
      title:       latest.title,
      snippet:     latest.snippet,
      url:         latest.url,
      articles:    sorted,
      sources,
      latestAt:    latest.publishedAt,
      isTrending:  sources.length >= 3,
    };
  });

  // Sort: most-covered stories first, then by recency
  return clusters.sort((a, b) => {
    if (b.sources.length !== a.sources.length) {
      return b.sources.length - a.sources.length;
    }
    return b.latestAt.getTime() - a.latestAt.getTime();
  });
}
