import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { createReferenceVideo, initDb } from "@/lib/db";
import { detectReferencePlatform, isSupportedReferenceUrl } from "@/lib/referencePlatforms";

export const dynamic = "force-dynamic";

function buildStyleProfile(title: string, author: string, notes: string) {
  return {
    strategy:
      "Recreate structure and pacing from reference while using your own voice, footage, and claims.",
    tone: "direct, high-retention, short-form",
    pacing: "fast cuts every 1-2 seconds with clear on-screen text",
    visualStyle: "UGC vertical framing with B-roll support",
    hookPattern: `Inspired by reference title: ${title}`,
    creatorReference: author,
    customNotes: notes || null,
    compliance:
      "Do not copy exact wording. Use original script and your own proof/assets."
  };
}

export async function POST(request: Request) {
  await initDb();

  const body = (await request.json()) as {
    url?: string;
    notes?: string;
  };

  const url = String(body.url ?? "").trim();
  const notes = String(body.notes ?? "").trim();
  const platform = detectReferencePlatform(url);

  if (!url || !isSupportedReferenceUrl(url)) {
    return NextResponse.json(
      { ok: false, error: "Please provide a valid YouTube or TikTok URL." },
      { status: 400 }
    );
  }

  let title: string | null = null;
  let authorName: string | null = null;

  try {
    if (platform === "youtube") {
      const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
      const response = await fetch(oembedUrl, { method: "GET" });
      if (response.ok) {
        const data = (await response.json()) as {
          title?: string;
          author_name?: string;
        };
        title = data.title ?? null;
        authorName = data.author_name ?? null;
      }
    } else if (platform === "tiktok") {
      const parsed = new URL(url);
      title = "TikTok reference";
      const segments = parsed.pathname.split("/").filter(Boolean);
      const userSegment = segments.find((segment) => segment.startsWith("@"));
      authorName = userSegment ? userSegment.slice(1) : "TikTok creator";
    }
  } catch {
    // Non-fatal: we still store URL + notes.
  }

  const styleProfile = buildStyleProfile(
    title ?? "YouTube reference",
    authorName ?? "Unknown creator",
    notes
  );

  const id = crypto.randomUUID();
  await createReferenceVideo({
    id,
    sourceUrl: url,
    platform,
    extractor: platform === "youtube" ? "youtube_oembed_quick" : "tiktok_quick_parser",
    title,
    authorName,
    notes: notes || null,
    styleJson: styleProfile
  });

  return NextResponse.json({
    ok: true,
    referenceId: id,
    reference: {
      url,
      title,
      authorName,
      notes,
      styleProfile
    }
  });
}
