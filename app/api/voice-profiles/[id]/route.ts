import { NextResponse } from "next/server";
import {
  clearVoiceProfileDefaults,
  initDb,
  listVoiceProfiles,
  updateVoiceProfile
} from "@/lib/db";
import { requireAdminOr401 } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminOr401();
  if (auth) {
    return auth;
  }

  await initDb();
  const { id } = await context.params;
  const body = (await request.json()) as {
    name?: string;
    externalVoiceId?: string;
    isDefault?: boolean;
  };

  if (body.isDefault) {
    await clearVoiceProfileDefaults();
  }

  await updateVoiceProfile({
    id,
    name: typeof body.name === "string" ? body.name.trim() : undefined,
    externalVoiceId:
      typeof body.externalVoiceId === "string" ? body.externalVoiceId.trim() : undefined,
    isDefault: typeof body.isDefault === "boolean" ? body.isDefault : undefined
  });

  const profiles = await listVoiceProfiles();
  return NextResponse.json({ ok: true, profiles });
}
