import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { createPublishQueueItem, getOutputById, initDb } from "@/lib/db";
import { requireAdminOr401 } from "@/lib/auth";
import { schedulePostBridgePost } from "@/lib/postBridge";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await requireAdminOr401();
  if (auth) return auth;
  await initDb();

  const contentType = request.headers.get("content-type") ?? "";
  let outputId = "";
  let channel: "tiktok" | "instagram_reels" | undefined;
  let caption = "";
  let scheduledFor = "";
  let redirectTo = "";

  if (contentType.includes("application/json")) {
    const body = (await request.json()) as {
      outputId?: string;
      channel?: "tiktok" | "instagram_reels";
      caption?: string;
      scheduledFor?: string;
      redirectTo?: string;
    };
    outputId = String(body.outputId ?? "").trim();
    channel = body.channel;
    caption = String(body.caption ?? "").trim();
    scheduledFor = String(body.scheduledFor ?? "").trim();
    redirectTo = String(body.redirectTo ?? "").trim();
  } else {
    const form = await request.formData();
    outputId = String(form.get("outputId") ?? "").trim();
    const rawChannel = String(form.get("channel") ?? "").trim();
    channel = rawChannel === "tiktok" || rawChannel === "instagram_reels" ? rawChannel : undefined;
    caption = String(form.get("caption") ?? "").trim();
    scheduledFor = String(form.get("scheduledFor") ?? "").trim();
    redirectTo = String(form.get("redirectTo") ?? "").trim();
  }

  if (!outputId || (channel !== "tiktok" && channel !== "instagram_reels") || !caption || !scheduledFor) {
    if (contentType.includes("application/json")) {
      return NextResponse.json({ ok: false, error: "Invalid schedule request" }, { status: 400 });
    }
    return NextResponse.redirect(new URL(redirectTo || "/", request.url));
  }

  const output = await getOutputById(outputId);
  if (!output) {
    if (contentType.includes("application/json")) {
      return NextResponse.json({ ok: false, error: "Output not found" }, { status: 404 });
    }
    return NextResponse.redirect(new URL(redirectTo || "/", request.url));
  }

  const queueId = crypto.randomUUID();
  const scheduled = await schedulePostBridgePost({
    channel,
    mediaUrl: output.blob_url,
    caption,
    scheduledFor
  });

  if (!scheduled.ok) {
    await createPublishQueueItem({
      id: queueId,
      outputId: output.id,
      channel,
      scheduledFor,
      status: "failed",
      payloadJson: { caption, mediaUrl: output.blob_url },
      error: scheduled.error
    });
    if (contentType.includes("application/json")) {
      return NextResponse.json({ ok: false, error: scheduled.error, queueId }, { status: 500 });
    }
    return NextResponse.redirect(new URL(redirectTo || "/", request.url));
  }

  await createPublishQueueItem({
    id: queueId,
    outputId: output.id,
    channel,
    scheduledFor,
    status: scheduled.status,
    externalPostId: scheduled.externalPostId,
    payloadJson: scheduled.raw
  });

  if (contentType.includes("application/json")) {
    return NextResponse.json({ ok: true, queueId, externalPostId: scheduled.externalPostId });
  }
  return NextResponse.redirect(new URL(redirectTo || "/", request.url));
}
