import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { initDb, insertOutputRating } from "@/lib/db";
import { requireAdminOr401 } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await requireAdminOr401();
  if (auth) return auth;
  await initDb();

  const contentType = request.headers.get("content-type") ?? "";
  let outputId = "";
  let rating = "";
  let note = "";

  if (contentType.includes("application/json")) {
    const body = (await request.json()) as { outputId?: string; rating?: string; note?: string };
    outputId = String(body.outputId ?? "").trim();
    rating = String(body.rating ?? "").trim();
    note = String(body.note ?? "").trim();
  } else {
    const form = await request.formData();
    outputId = String(form.get("outputId") ?? "").trim();
    rating = String(form.get("rating") ?? "").trim();
    note = String(form.get("note") ?? "").trim();
  }

  if (!outputId || !["win", "neutral", "loss"].includes(rating)) {
    return NextResponse.json({ ok: false, error: "Invalid rating payload" }, { status: 400 });
  }

  await insertOutputRating({
    id: crypto.randomUUID(),
    outputId,
    rating: rating as "win" | "neutral" | "loss",
    note: note || null
  });

  if (contentType.includes("application/json")) {
    return NextResponse.json({ ok: true });
  }

  const referer = request.headers.get("referer") ?? "/";
  return NextResponse.redirect(referer);
}
