import { NextResponse } from "next/server";
import { initDb, listRatingsByJob } from "@/lib/db";
import { requireAdminOr401 } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminOr401();
  if (auth) return auth;
  await initDb();
  const { id } = await context.params;
  const ratings = await listRatingsByJob(id);
  return NextResponse.json({ ok: true, ratings });
}
