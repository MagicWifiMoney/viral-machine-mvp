import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { createReferenceVideo, initDb } from "@/lib/db";
import { deepAnalyzeYouTube } from "@/lib/youtubeDeepAnalysis";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function isYouTubeUrl(raw: string): boolean {
  try {
    const url = new URL(raw);
    return url.hostname.includes("youtube.com") || url.hostname.includes("youtu.be");
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  await initDb();

  const body = (await request.json()) as {
    url?: string;
    notes?: string;
  };

  const url = String(body.url ?? "").trim();
  const notes = String(body.notes ?? "").trim();

  if (!url || !isYouTubeUrl(url)) {
    return NextResponse.json(
      { ok: false, error: "Please provide a valid YouTube URL." },
      { status: 400 }
    );
  }

  try {
    const analyzed = await deepAnalyzeYouTube(url, notes);

    const id = crypto.randomUUID();
    await createReferenceVideo({
      id,
      sourceUrl: url,
      title: analyzed.title,
      authorName: analyzed.authorName,
      notes: notes || null,
      styleJson: {
        ...analyzed.styleProfile,
        technical: analyzed.technical,
        mode: "deep_video_analysis"
      }
    });

    return NextResponse.json({
      ok: true,
      referenceId: id,
      reference: {
        url,
        title: analyzed.title,
        authorName: analyzed.authorName,
        styleProfile: analyzed.styleProfile,
        technical: analyzed.technical
      }
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Deep analysis failed. Try quick mode or check local tool setup."
      },
      { status: 500 }
    );
  }
}
