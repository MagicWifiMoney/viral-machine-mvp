import { NextResponse } from "next/server";
import { getLatestReferenceVideo, initDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  await initDb();
  const latest = await getLatestReferenceVideo();
  return NextResponse.json({ ok: true, reference: latest });
}
