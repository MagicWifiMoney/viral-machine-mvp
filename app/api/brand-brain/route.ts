import { NextResponse } from "next/server";
import { getBrandBrain, initDb, upsertBrandBrain } from "@/lib/db";
import { requireAdminOr401 } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAdminOr401();
  if (auth) return auth;
  await initDb();
  const brandBrain = await getBrandBrain();
  return NextResponse.json({ ok: true, brandBrain });
}

export async function POST(request: Request) {
  const auth = await requireAdminOr401();
  if (auth) return auth;
  await initDb();

  const body = (await request.json()) as {
    claims?: string[];
    defaultCta?: string;
    tone?: string;
    bannedWords?: string[];
  };

  await upsertBrandBrain({
    claims: Array.isArray(body.claims) ? body.claims.map((x) => String(x).trim()).filter(Boolean) : [],
    defaultCta: String(body.defaultCta ?? "").trim() || null,
    tone: String(body.tone ?? "").trim() || null,
    bannedWords: Array.isArray(body.bannedWords)
      ? body.bannedWords.map((x) => String(x).trim()).filter(Boolean)
      : []
  });

  const brandBrain = await getBrandBrain();
  return NextResponse.json({ ok: true, brandBrain });
}
