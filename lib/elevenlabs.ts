import { put } from "@vercel/blob";
import { getOptionalEnv } from "@/lib/env";

const ELEVENLABS_BASE = "https://api.elevenlabs.io/v1";

function getApiKey(): string | null {
  return getOptionalEnv("ELEVENLABS_API_KEY") ?? null;
}

function getModelId(): string {
  return getOptionalEnv("ELEVENLABS_DEFAULT_MODEL") ?? "eleven_multilingual_v2";
}

export async function synthesizeVoiceover(args: {
  voiceId: string;
  text: string;
  outputKey: string;
}): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const apiKey = getApiKey();
  if (!apiKey) {
    return { ok: false, error: "ELEVENLABS_API_KEY is not set" };
  }

  try {
    const response = await fetch(`${ELEVENLABS_BASE}/text-to-speech/${args.voiceId}`, {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model_id: getModelId(),
        text: args.text,
        output_format: "mp3_44100_128"
      })
    });

    if (!response.ok) {
      const body = await response.text();
      return { ok: false, error: `ElevenLabs request failed (${response.status}): ${body.slice(0, 200)}` };
    }

    const bytes = Buffer.from(await response.arrayBuffer());

    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return {
        ok: true,
        url: `data:audio/mpeg;base64,${bytes.toString("base64")}`
      };
    }

    const uploaded = await put(args.outputKey, bytes, {
      access: "public",
      contentType: "audio/mpeg"
    });

    return { ok: true, url: uploaded.url };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Unknown ElevenLabs error"
    };
  }
}
