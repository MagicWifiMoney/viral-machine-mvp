import crypto from "node:crypto";
import { insertTrendPattern } from "@/lib/db";

const DEFAULT_QUERIES = [
  "side hustle",
  "ai automation",
  "money tips",
  "creator growth",
  "productivity hacks"
];

type YouTubeSearchItem = {
  id?: { videoId?: string };
  snippet?: { title?: string };
};

function scoreTitle(title: string): number {
  let score = 40;
  if (/\d/.test(title)) score += 15;
  if (title.toLowerCase().includes("how")) score += 10;
  if (title.length < 55) score += 10;
  if (title.includes("?")) score += 5;
  return Math.min(100, score);
}

function patternFromTitle(title: string): Record<string, unknown> {
  return {
    hookStyle: title.split(" ").slice(0, 6).join(" "),
    pacing: "fast",
    structure: ["hook", "value", "proof", "cta"],
    titleTemplate: title
  };
}

async function fetchYouTubeTitles(query: string): Promise<string[]> {
  const key = process.env.TREND_INGEST_YOUTUBE_API_KEY;
  if (!key) {
    return [
      `${query}: 3 mistakes killing retention`,
      `${query}: this script format is everywhere`,
      `${query}: do this before your first 1k views`
    ];
  }

  const url =
    "https://www.googleapis.com/youtube/v3/search" +
    `?part=snippet&type=video&maxResults=8&videoDuration=short&q=${encodeURIComponent(
      `${query} shorts`
    )}&key=${key}`;
  const response = await fetch(url);
  if (!response.ok) {
    return [];
  }
  const data = (await response.json()) as { items?: YouTubeSearchItem[] };
  return (data.items ?? [])
    .map((item) => item.snippet?.title?.trim())
    .filter((title): title is string => Boolean(title));
}

export async function ingestYouTubeTrends(queries = DEFAULT_QUERIES): Promise<{
  inserted: number;
}> {
  let inserted = 0;
  for (const query of queries) {
    const titles = await fetchYouTubeTitles(query);
    for (const title of titles) {
      await insertTrendPattern({
        id: crypto.randomUUID(),
        source: "youtube_shorts",
        query,
        title,
        patternJson: patternFromTitle(title),
        score: scoreTitle(title)
      });
      inserted += 1;
    }
  }
  return { inserted };
}
