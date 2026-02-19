import { NextResponse } from "next/server";
import { requireAdminOr401 } from "@/lib/auth";
import { generateThumbnailPromptCandidates, generateTitleCandidates } from "@/lib/thumbnailLab";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await requireAdminOr401();
  if (auth) return auth;
  const body = (await request.json()) as { hook?: string; cta?: string };
  const hook = String(body.hook ?? "").trim();
  const cta = String(body.cta ?? "Comment \"BLUEPRINT\"").trim();
  if (!hook) {
    return NextResponse.json({ ok: false, error: "hook is required" }, { status: 400 });
  }
  return NextResponse.json({
    ok: true,
    titleCandidates: generateTitleCandidates(hook, cta),
    thumbnailPromptCandidates: generateThumbnailPromptCandidates(hook)
  });
}
