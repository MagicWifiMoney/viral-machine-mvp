import { NextResponse } from "next/server";
import { getAppSetting, initDb, setAppSetting } from "@/lib/db";
import { requireAdminOr401 } from "@/lib/auth";
import { getCostPresetConfig } from "@/lib/costPresets";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAdminOr401();
  if (auth) return auth;
  await initDb();
  const setting = await getAppSetting<{ defaultPreset?: "cheap" | "balanced" | "max_quality" }>("cost_presets");
  const defaultPreset = setting?.defaultPreset ?? "balanced";
  return NextResponse.json({
    ok: true,
    defaultPreset,
    presets: {
      cheap: getCostPresetConfig("cheap"),
      balanced: getCostPresetConfig("balanced"),
      max_quality: getCostPresetConfig("max_quality")
    }
  });
}

export async function POST(request: Request) {
  const auth = await requireAdminOr401();
  if (auth) return auth;
  await initDb();
  const body = (await request.json()) as { defaultPreset?: "cheap" | "balanced" | "max_quality" };
  const defaultPreset =
    body.defaultPreset === "cheap" || body.defaultPreset === "max_quality" || body.defaultPreset === "balanced"
      ? body.defaultPreset
      : null;
  if (!defaultPreset) {
    return NextResponse.json({ ok: false, error: "Invalid defaultPreset" }, { status: 400 });
  }
  await setAppSetting("cost_presets", { defaultPreset });
  return NextResponse.json({ ok: true, defaultPreset });
}
