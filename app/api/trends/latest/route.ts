import { NextResponse } from "next/server";
import { initDb, listLatestTrends } from "@/lib/db";
import { requireAdminOr401 } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAdminOr401();
  if (auth) return auth;
  await initDb();
  const trends = await listLatestTrends(30);
  return NextResponse.json({ ok: true, trends });
}
