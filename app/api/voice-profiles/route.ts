import crypto from "node:crypto";
import { NextResponse } from "next/server";
import {
  clearVoiceProfileDefaults,
  createVoiceProfile,
  initDb,
  listVoiceProfiles
} from "@/lib/db";
import { requireAdminOr401 } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAdminOr401();
  if (auth) {
    return auth;
  }

  await initDb();
  const profiles = await listVoiceProfiles();
  return NextResponse.json({ ok: true, profiles });
}

export async function POST(request: Request) {
  const auth = await requireAdminOr401();
  if (auth) {
    return auth;
  }

  await initDb();
  const body = (await request.json()) as {
    name?: string;
    externalVoiceId?: string;
    isDefault?: boolean;
  };

  const name = String(body.name ?? "").trim();
  const externalVoiceId = String(body.externalVoiceId ?? "").trim();
  const isDefault = Boolean(body.isDefault);

  if (!name || !externalVoiceId) {
    return NextResponse.json(
      { ok: false, error: "name and externalVoiceId are required" },
      { status: 400 }
    );
  }

  if (isDefault) {
    await clearVoiceProfileDefaults();
  }

  await createVoiceProfile({
    id: crypto.randomUUID(),
    name,
    provider: "elevenlabs",
    externalVoiceId,
    isDefault
  });

  const profiles = await listVoiceProfiles();
  return NextResponse.json({ ok: true, profiles });
}
