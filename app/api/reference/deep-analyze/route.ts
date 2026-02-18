import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { createReferenceVideo, initDb } from "@/lib/db";
import { deepAnalyzeYouTube } from "@/lib/youtubeDeepAnalysis";
import { detectReferencePlatform, isSupportedReferenceUrl } from "@/lib/referencePlatforms";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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

  try {
    const workerBaseUrl = process.env.WORKER_BASE_URL?.trim();
    const workerApiKey = process.env.WORKER_API_KEY?.trim();

    const analyzed = workerBaseUrl
      ? await runDeepAnalyzeViaWorker(workerBaseUrl, workerApiKey, url, notes)
      : await deepAnalyzeYouTube(url, notes);

    const id = crypto.randomUUID();
    await createReferenceVideo({
      id,
      sourceUrl: url,
      platform,
      extractor: "worker_deep_analysis",
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

async function runDeepAnalyzeViaWorker(
  workerBaseUrl: string,
  workerApiKey: string | undefined,
  url: string,
  notes: string
): Promise<{
  title: string | null;
  authorName: string | null;
  styleProfile: Record<string, unknown>;
  technical: Record<string, unknown>;
}> {
  const endpoint = `${workerBaseUrl.replace(/\/$/, "")}/deep-analyze`;
  const headers: HeadersInit = { "Content-Type": "application/json" };
  if (workerApiKey) {
    headers.Authorization = `Bearer ${workerApiKey}`;
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify({ url, notes })
  });

  const data = (await response.json()) as {
    ok?: boolean;
    error?: string;
    title?: string | null;
    authorName?: string | null;
    styleProfile?: Record<string, unknown>;
    technical?: Record<string, unknown>;
  };

  if (!response.ok || !data.ok) {
    throw new Error(data.error ?? "Worker deep analysis failed");
  }

  return {
    title: data.title ?? null,
    authorName: data.authorName ?? null,
    styleProfile: data.styleProfile ?? {},
    technical: data.technical ?? {}
  };
}
