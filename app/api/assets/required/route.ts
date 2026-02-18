import { NextResponse } from "next/server";
import { getAssetCoverage } from "@/lib/assets";
import { initDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  await initDb();
  const coverage = await getAssetCoverage();
  return NextResponse.json({ ok: true, ...coverage });
}
