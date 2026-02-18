import express from "express";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const app = express();
app.use(express.json({ limit: "2mb" }));

const PORT = Number(process.env.PORT || 8788);
const API_KEY = process.env.WORKER_API_KEY || "";

function requireAuth(req, res, next) {
  if (!API_KEY) {
    return next();
  }
  const auth = req.header("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (token !== API_KEY) {
    return res.status(401).json({ ok: false, error: "Unauthorized worker request" });
  }
  return next();
}

async function run(binary, args, cwd) {
  const { stdout, stderr } = await execFileAsync(binary, args, {
    cwd,
    maxBuffer: 30 * 1024 * 1024
  });
  return [stdout, stderr].filter(Boolean).join("\n");
}

async function fetchOEmbed(url) {
  try {
    const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
    const response = await fetch(oembedUrl);
    if (!response.ok) {
      return { title: null, authorName: null };
    }
    const data = await response.json();
    return {
      title: data.title ?? null,
      authorName: data.author_name ?? null
    };
  } catch {
    return { title: null, authorName: null };
  }
}

function parseJsonObject(raw) {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    return null;
  }
  try {
    return JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
}

function fallbackStyleProfile(rawText) {
  return {
    primary_format: "mixed",
    format_mix: ["unknown"],
    pacing: "unknown",
    scene_density: "unknown",
    hook_pattern: "unknown",
    visual_language: "unknown",
    editing_pattern: "unknown",
    recreation_playbook: [
      "Start with a strong first-second hook.",
      "Use fast cuts and on-screen text for key claims.",
      "Alternate presenter shots with supporting visuals."
    ],
    creative_constraints: [
      "Model output was not strict JSON; this is a fallback profile.",
      "Review and refine before production use."
    ],
    raw_model_output_excerpt: String(rawText || "").slice(0, 1200)
  };
}

async function analyzeFramesWithOpenAI(frameDataUrls, notes) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is required on worker service.");
  }

  const content = [
    {
      type: "input_text",
      text:
        "Analyze sampled frames from one short-form video and return JSON only. " +
        "Classify format mix: talking_head, live_action_broll, slideshow, screen_recording, animation_2d, animation_3d, hand_drawn, mixed. " +
        "Return keys: primary_format, format_mix, pacing, scene_density, hook_pattern, visual_language, editing_pattern, recreation_playbook, creative_constraints. " +
        (notes ? `User notes: ${notes}` : "")
    }
  ];

  for (const image of frameDataUrls) {
    content.push({
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
      input: [{ role: "user", content }]
    })
  });

  const raw = await response.json();
  if (!response.ok) {
    const msg = raw?.error?.message || "OpenAI request failed";
    throw new Error(msg);
  }

  const modelText = String(raw.output_text || "");
  const parsed = parseJsonObject(modelText);
  if (parsed) {
    return parsed;
  }

  return fallbackStyleProfile(modelText);
}

async function deepAnalyzeYouTube(url, notes) {
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
    const frameDataUrls = [];
    for (const file of selected) {
      const bytes = await readFile(path.join(framesDir, file));
      frameDataUrls.push(`data:image/jpeg;base64,${bytes.toString("base64")}`);
    }

    const styleProfile = await analyzeFramesWithOpenAI(frameDataUrls, notes);
    const meta = await fetchOEmbed(url);

    return {
      title: meta.title,
      authorName: meta.authorName,
      styleProfile,
      technical: {
        source: "deep_video",
        sampledFrames: selected.length,
        extractedAtSeconds: selected.map((_, i) => i * 4)
      }
    };
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
}

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'worker-service', ts: new Date().toISOString() });
});

app.post('/deep-analyze', requireAuth, async (req, res) => {
  try {
    const { url = '', notes = '' } = req.body || {};
    if (!url || (!url.includes('youtube.com') && !url.includes('youtu.be'))) {
      return res.status(400).json({ ok: false, error: 'Please provide a valid YouTube URL.' });
    }

    const result = await deepAnalyzeYouTube(String(url), String(notes || ''));
    return res.json({ ok: true, ...result });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Deep analyze failed'
    });
  }
});

app.listen(PORT, () => {
  console.log(`worker-service listening on ${PORT}`);
});
