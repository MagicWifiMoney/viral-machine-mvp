import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type DeepAnalysisResult = {
  title: string | null;
  authorName: string | null;
  styleProfile: Record<string, unknown>;
  technical: {
    source: "deep_video";
    sampledFrames: number;
    extractedAtSeconds: number[];
  };
};

type OEmbed = {
  title?: string;
  author_name?: string;
};

async function run(binary: string, args: string[], cwd?: string): Promise<string> {
  const { stdout, stderr } = await execFileAsync(binary, args, {
    cwd,
    maxBuffer: 20 * 1024 * 1024
  });

  return [stdout, stderr].filter(Boolean).join("\n");
}

async function commandExists(binary: string): Promise<boolean> {
  try {
    await run("which", [binary]);
    return true;
  } catch {
    return false;
  }
}

async function fetchOEmbed(url: string): Promise<{ title: string | null; authorName: string | null }> {
  try {
    const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
    const response = await fetch(oembedUrl);
    if (!response.ok) {
      return { title: null, authorName: null };
    }

    const data = (await response.json()) as OEmbed;
    return { title: data.title ?? null, authorName: data.author_name ?? null };
  } catch {
    return { title: null, authorName: null };
  }
}

function parseJsonObject(raw: string): Record<string, unknown> {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Could not parse JSON style analysis from model response.");
  }

  return JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>;
}

async function analyzeFramesWithOpenAI(frameDataUrls: string[], notes: string): Promise<Record<string, unknown>> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is required for deep analysis.");
  }

  const inputContent: Array<Record<string, unknown>> = [
    {
      type: "input_text",
      text:
        "Analyze these sampled frames from one short-form video and return JSON only. " +
        "Classify whether it is mostly: talking_head, live_action_broll, slideshow, screen_recording, animation_2d, animation_3d, hand_drawn, mixed. " +
        "Also provide pacing, scene density, hook style, editing pattern, recommended recreation strategy in a new voice. " +
        "Keys required: primary_format, format_mix, pacing, scene_density, hook_pattern, visual_language, editing_pattern, recreation_playbook, creative_constraints. " +
        (notes ? `User notes: ${notes}` : "")
    }
  ];

  for (const image of frameDataUrls) {
    inputContent.push({
      type: "input_image",
      image_url: image,
      detail: "low"
    });
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "gpt-4.1-mini",
      input: [
        {
          role: "user",
          content: inputContent
        }
      ]
    })
  });

  const raw = (await response.json()) as Record<string, unknown>;

  if (!response.ok) {
    const err = raw.error as Record<string, unknown> | undefined;
    const msg = typeof err?.message === "string" ? err.message : "OpenAI vision request failed";
    throw new Error(msg);
  }

  const outputText = String(raw.output_text ?? "");
  return parseJsonObject(outputText);
}

export async function deepAnalyzeYouTube(url: string, notes: string): Promise<DeepAnalysisResult> {
  const hasYtDlp = await commandExists("yt-dlp");
  const hasFfmpeg = await commandExists("ffmpeg");

  if (!hasYtDlp || !hasFfmpeg) {
    const missing = [!hasYtDlp ? "yt-dlp" : null, !hasFfmpeg ? "ffmpeg" : null]
      .filter(Boolean)
      .join(", ");
    throw new Error(`Deep analysis requires local tools: ${missing}`);
  }

  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "vm-ref-"));

  try {
    const outTemplate = path.join(tempRoot, "source.%(ext)s");
    await run("yt-dlp", ["-f", "mp4", "--no-playlist", "-o", outTemplate, url]);

    const files = await readdir(tempRoot);
    const source = files.find((f) => f.startsWith("source."));
    if (!source) {
      throw new Error("Could not download source video from URL.");
    }

    const videoPath = path.join(tempRoot, source);
    const framesDir = path.join(tempRoot, "frames");
    await run("mkdir", ["-p", framesDir]);

    await run("ffmpeg", [
      "-y",
      "-i",
      videoPath,
      "-vf",
      "fps=1/4",
      "-frames:v",
      "10",
      path.join(framesDir, "frame-%03d.jpg")
    ]);

    const frameFiles = (await readdir(framesDir)).filter((f) => f.endsWith(".jpg")).sort();
    if (frameFiles.length === 0) {
      throw new Error("Could not extract frames from source video.");
    }

    const selected = frameFiles.slice(0, 8);
    const frameDataUrls: string[] = [];
    for (const file of selected) {
      const bytes = await readFile(path.join(framesDir, file));
      frameDataUrls.push(`data:image/jpeg;base64,${bytes.toString("base64")}`);
    }

    const styleProfile = await analyzeFramesWithOpenAI(frameDataUrls, notes);
    const { title, authorName } = await fetchOEmbed(url);

    const extractedAtSeconds = selected.map((_, i) => i * 4);

    return {
      title,
      authorName,
      styleProfile,
      technical: {
        source: "deep_video",
        sampledFrames: selected.length,
        extractedAtSeconds
      }
    };
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
}
