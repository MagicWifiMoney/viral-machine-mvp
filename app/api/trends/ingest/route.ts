import { NextResponse } from "next/server";
import { initDb } from "@/lib/db";
import { requireAdminOr401 } from "@/lib/auth";
import { ingestYouTubeTrends } from "@/lib/trendMiner";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await requireAdminOr401();
  if (auth) return auth;
  await initDb();

  const body = (await request.json().catch(() => ({}))) as { queries?: string[] };
  const queries = Array.isArray(body.queries) ? body.queries.map((x) => String(x).trim()).filter(Boolean) : undefined;

  const result = await ingestYouTubeTrends(queries);
  return NextResponse.json({ ok: true, ...result });
}
