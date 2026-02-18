import { NextResponse } from "next/server";
import { getVoiceProfileById, initDb } from "@/lib/db";
import { requireAdminOr401 } from "@/lib/auth";
import { synthesizeVoiceover } from "@/lib/elevenlabs";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminOr401();
  if (auth) {
    return auth;
  }

  await initDb();
  const { id } = await context.params;
  const profile = await getVoiceProfileById(id);
  if (!profile) {
    return NextResponse.json({ ok: false, error: "Voice profile not found" }, { status: 404 });
  }

  const body = (await request.json()) as { text?: string };
  const text =
    String(body.text ?? "").trim() || "Testing voice profile for viral short form content.";

  const result = await synthesizeVoiceover({
    voiceId: profile.external_voice_id,
    text,
    outputKey: `voice-tests/${profile.id}-${Date.now()}.mp3`
  });

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
  }

  return NextResponse.json({ ok: true, url: result.url });
}
