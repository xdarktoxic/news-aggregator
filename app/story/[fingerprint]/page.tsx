// app/story/[fingerprint]/page.tsx
//
// Landing page for a push notification tap. Reads the persisted story from
// Firestore and shows the full AI summary + all source articles — so the user
// sees the synthesis immediately without having to find the story in the feed.

import { adminDb } from "@/lib/firebaseAdmin";
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type StoryArticle = { title: string; url: string; source: string };

type StoryData = {
  title:       string;
  summary:     string;
  url:         string;
  sources:     number;
  sourceNames: string[];
  articles:    StoryArticle[];
  notifiedAt:  { toDate: () => Date } | null;
};

type Props = { params: Promise<{ fingerprint: string }> };

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { fingerprint } = await params;
  const doc = await adminDb().collection("notified_clusters").doc(fingerprint).get();
  if (!doc.exists) return { title: "Story not found — Pulse" };
  const data = doc.data() as StoryData;
  return {
    title:       `${data.title} — Pulse`,
    description: data.summary,
  };
}

// ---------------------------------------------------------------------------
// Source colour map (same as NewsFeed)
// ---------------------------------------------------------------------------

const SOURCE_COLORS: Record<string, string> = {
  "Economic Times":  "#f59e0b",
  "The Hindu":       "#f87171",
  "Livemint":        "#60a5fa",
  "NDTV":            "#fb923c",
  "Indian Express":  "#a78bfa",
  "India Today":     "#38bdf8",
  "Times of India":  "#f87171",
  "Hindustan Times": "#2dd4bf",
  "CNBC-TV18":       "#f43f5e",
};

function sourceColor(name: string) {
  return SOURCE_COLORS[name] ?? "#888888";
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function StoryPage({ params }: Props) {
  const { fingerprint } = await params;
  const doc = await adminDb().collection("notified_clusters").doc(fingerprint).get();
  if (!doc.exists) notFound();

  const story = doc.data() as StoryData;
  const notifiedAt = story.notifiedAt?.toDate();

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text-primary)" }}>

      {/* ── Top bar ── */}
      <header style={{
        borderBottom: "1px solid var(--border)",
        padding: "14px 20px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        position: "sticky",
        top: 0,
        background: "var(--bg)",
        zIndex: 10,
      }}>
        <Link
          href="/"
          style={{
            fontFamily:  "var(--font-serif), serif",
            fontSize:    "22px",
            fontWeight:  700,
            color:       "var(--text-primary)",
            textDecoration: "none",
            letterSpacing: "-0.5px",
          }}
        >
          Pulse
        </Link>
        <Link
          href="/"
          style={{
            fontSize:   "13px",
            color:      "var(--text-secondary)",
            textDecoration: "none",
            display:    "flex",
            alignItems: "center",
            gap:        "4px",
          }}
        >
          ← Back to feed
        </Link>
      </header>

      {/* ── Story content ── */}
      <main style={{ maxWidth: "680px", margin: "0 auto", padding: "32px 20px 64px" }}>

        {/* Trending badge */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
          <span style={{
            display:        "inline-flex",
            alignItems:     "center",
            gap:            "5px",
            background:     "rgba(239,68,68,0.12)",
            border:         "1px solid rgba(239,68,68,0.3)",
            borderRadius:   "6px",
            padding:        "3px 10px",
            fontSize:       "12px",
            fontWeight:     600,
            color:          "#ef4444",
            letterSpacing:  "0.3px",
          }}>
            🔥 Trending
          </span>
          <span style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
            {story.sources} source{story.sources !== 1 ? "s" : ""}
          </span>
          {notifiedAt && (
            <span style={{ fontSize: "12px", color: "#555", marginLeft: "auto" }}>
              {notifiedAt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
        </div>

        {/* Headline */}
        <h1 style={{
          fontFamily:    "var(--font-serif), serif",
          fontSize:      "clamp(22px, 5vw, 30px)",
          fontWeight:    700,
          lineHeight:    1.25,
          marginBottom:  "24px",
          color:         "var(--text-primary)",
        }}>
          {story.title}
        </h1>

        {/* AI Summary */}
        <div style={{
          background:   "var(--card)",
          border:       "1px solid var(--border)",
          borderRadius: "12px",
          padding:      "20px 24px",
          marginBottom: "32px",
        }}>
          <p style={{
            fontSize:   "13px",
            fontWeight: 600,
            color:      "var(--text-secondary)",
            marginBottom: "10px",
            letterSpacing: "0.5px",
            textTransform: "uppercase",
          }}>
            AI Summary
          </p>
          <p style={{
            fontSize:   "16px",
            lineHeight: 1.65,
            color:      "var(--text-primary)",
            margin:     0,
          }}>
            {story.summary}
          </p>
        </div>

        {/* Source articles */}
        <p style={{
          fontSize:      "13px",
          fontWeight:    600,
          color:         "var(--text-secondary)",
          letterSpacing: "0.5px",
          textTransform: "uppercase",
          marginBottom:  "12px",
        }}>
          {story.articles.length} article{story.articles.length !== 1 ? "s" : ""} from {story.sources} source{story.sources !== 1 ? "s" : ""}
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {story.articles.map((article, i) => (
            <a
              key={i}
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display:        "block",
                background:     "var(--card)",
                border:         "1px solid var(--border)",
                borderRadius:   "10px",
                padding:        "14px 16px",
                textDecoration: "none",
                transition:     "border-color 0.15s",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                <span style={{
                  fontSize:     "11px",
                  fontWeight:   600,
                  color:        sourceColor(article.source),
                  letterSpacing: "0.3px",
                }}>
                  {article.source}
                </span>
                <span style={{ fontSize: "11px", color: "#444" }}>↗</span>
              </div>
              <p style={{
                fontSize:   "14px",
                lineHeight: 1.45,
                color:      "var(--text-primary)",
                margin:     0,
              }}>
                {article.title}
              </p>
            </a>
          ))}
        </div>

      </main>
    </div>
  );
}
