import crypto from "node:crypto";
import { put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { initDb, upsertAsset } from "@/lib/db";
import { requireAdminOr401 } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await requireAdminOr401();
  if (auth) {
    return auth;
  }

  await initDb();

  const formData = await request.formData();
  const kind = String(formData.get("kind") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  const file = formData.get("file");

  if (!kind || !category || !(file instanceof File)) {
    return NextResponse.json(
      { ok: false, error: "kind, category, and file are required" },
      { status: 400 }
    );
  }

  const key = `assets/${kind}/${category}-${Date.now()}-${file.name}`;
  let assetUrl: string;

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const uploaded = await put(key, file, {
      access: "public",
      contentType: file.type || "application/octet-stream"
    });
    assetUrl = uploaded.url;
  } else {
    const buffer = Buffer.from(await file.arrayBuffer());
    const mime = file.type || "application/octet-stream";
    assetUrl = `data:${mime};base64,${buffer.toString("base64")}`;
  }

  await upsertAsset({
    id: crypto.randomUUID(),
    kind,
    category,
    blobUrl: assetUrl,
    mime: file.type || "application/octet-stream"
  });

  const accept = request.headers.get("accept") ?? "";
  if (accept.includes("text/html")) {
    return NextResponse.redirect(new URL("/assets", request.url));
  }

  return NextResponse.json({ ok: true, url: assetUrl });
}
