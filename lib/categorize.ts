// lib/categorize.ts
//
// Assigns a single category to an article based on keyword matching.
//
// RULES:
//   - Check title first, then snippet (concatenated)
//   - Case-insensitive — everything is lowercased before matching
//   - Each article gets exactly ONE category
//   - If multiple categories match, priority order wins:
//     Politics > Markets > World > Sports > Tech > Entertainment > Lifestyle > General
//   - If nothing matches → "General"

export type Category =
  | 'Politics'
  | 'Markets'
  | 'Sports'
  | 'World'
  | 'Tech'
  | 'Entertainment'
  | 'Lifestyle'
  | 'General';

// Priority order — first match in this list wins
export const CATEGORY_PRIORITY: Category[] = [
  'Politics', 'Markets', 'World', 'Sports', 'Tech', 'Entertainment', 'Lifestyle', 'General',
];

// Keywords are stored lowercase so we only lowercase once per article
const KEYWORDS: Record<Exclude<Category, 'General'>, string[]> = {
  Politics: [
    'election', 'bjp', 'congress', 'modi', 'rahul', 'parliament', 'bill',
    'vote', 'minister', 'mla', ' mp ', 'constituency', 'delimitation',
    'reservation', 'opposition', 'government', 'cabinet', 'tmc', 'aap',
    'dmk', 'aiadmk', 'poll', 'campaign', 'mamata', 'priyanka', 'amit shah',
    'lok sabha', 'rajya sabha', 'chief minister', 'governor',
    'apology', 'vhp', ' rss ', 'hindutva', 'political', 'party',
  ],
  Markets: [
    'stock', 'share', 'nifty', 'sensex', 'bse', 'nse',
    'mutual fund', 'fii', 'dii', 'ipo', 'earnings',
    'q4', 'q3', 'q2', 'q1', 'quarterly results', 'hdfc', 'tcs', 'infosys',
    'reliance industries', 'ongc', 'gold price', 'crude oil', 'oil price',
    'rupee', 'forex', 'rbi', 'inflation', 'gdp', 'dearness allowance',
    'market cap', 'dividend', 'buyback', 'price target', 'analyst rating',
    'interest rate', 'repo rate', 'fiscal', 'revenue', 'net profit',
  ],
  World: [
    ' us ', 'trump', 'iran', 'israel', 'china', 'russia', 'ukraine',
    'hormuz', 'ceasefire', 'nato', ' eu ', 'war', 'nuclear', 'sanctions',
    'lebanon', 'gaza', 'pakistan', 'biden', 'pentagon', 'white house',
    'united nations', 'kremlin', 'beijing', 'washington',
  ],
  Sports: [
    'ipl', 'cricket', 'match', 'wicket', 'century', 'runs', 'innings',
    'bowling', 'batting', 'csk', ' mi ', 'rcb', 'pbks', 'kkr', ' gt ',
    ' dc ', 'srh', 'lsg', ' rr ', 'fifa', 'football', 'tennis',
    'olympic', 'tournament', 'trophy', 'stadium', 'player', 'score',
    'injury', 'hamstring', 'physio', 'fitness test', 'ruled out',
  ],
  Tech: [
    ' ai ', 'artificial intelligence', 'startup', 'google', 'apple',
    'microsoft', 'meta', ' app ', 'software', 'coding', 'cognizant',
    'wipro', 'cyber', 'data breach', 'hack', 'chip', 'semiconductor',
    'gemini', 'chatgpt', 'claude', 'openai', 'robot', 'automation',
    'cloud', 'saas', 'tech',
  ],
  Entertainment: [
    'bollywood', 'movie', 'film', 'box office', 'ott', 'netflix',
    'actor', 'actress', 'director', 'trailer', 'song', 'album',
    'series', 'review', 'amazon prime', 'disney', 'hotstar',
    'hollywood', 'celebrity', 'award',
    'pregnancy', 'pregnant', 'deepika', 'ranveer', 'alia bhatt',
    'shah rukh', 'salman khan', 'katrina kaif', 'celebrity wedding',
    'star wedding', 'newborn', 'star couple', 'karan johar',
  ],
  Lifestyle: [
    'health', 'fitness', 'food', 'recipe', 'travel', 'weather',
    'temperature', 'diet', 'yoga', 'meditation', 'supplement',
    'skincare', 'fashion', 'lifestyle', 'wellness', 'mental health',
    'wildlife', 'animal', 'environment', 'climate change', 'nature',
    'forest', 'honey', 'bees', 'birds', 'endangered',
  ],
};

// ---------------------------------------------------------------------------
// categorize  (exported — called in lib/feeds.ts during article fetch)
//
// Checks the combined title + snippet text against each category's keywords
// in priority order. Returns the first matching category, or "General".
// ---------------------------------------------------------------------------

export function categorize(title: string, snippet: string): Category {
  // Pad with spaces so word-boundary keywords like ' mp ' don't false-match
  const text = ` ${title} ${snippet} `.toLowerCase();

  for (const cat of CATEGORY_PRIORITY) {
    if (cat === 'General') return 'General';
    if (KEYWORDS[cat].some((kw) => text.includes(kw))) {
      return cat;
    }
  }

  return 'General';
}

// ---------------------------------------------------------------------------
// majorityCategory  (exported — called in lib/cluster.ts)
//
// Given a list of articles in a cluster, returns the most common category.
// Ties are broken by CATEGORY_PRIORITY order (Politics beats Markets, etc.)
// ---------------------------------------------------------------------------

export function majorityCategory(categories: Category[]): Category {
  const counts: Partial<Record<Category, number>> = {};
  for (const cat of categories) {
    counts[cat] = (counts[cat] ?? 0) + 1;
  }

  let best: Category = 'General';
  let bestCount = 0;

  // Iterate in priority order so ties favour higher-priority categories
  for (const cat of CATEGORY_PRIORITY) {
    const count = counts[cat] ?? 0;
    if (count > bestCount) {
      bestCount = count;
      best = cat;
    }
  }

  return best;
}
