import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { createJob, createJobItem, initDb } from "@/lib/db";
import { generateConcept } from "@/lib/concepts";
import { DEFAULT_A_COUNT, DEFAULT_B_COUNT } from "@/lib/constants";
import { requireAdminOr401 } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await requireAdminOr401();
  if (auth) {
    return auth;
  }

  await initDb();

  const contentType = request.headers.get("content-type") ?? "";
  let count = DEFAULT_A_COUNT + DEFAULT_B_COUNT;
  let aCount = DEFAULT_A_COUNT;
  let bCount = DEFAULT_B_COUNT;

  if (contentType.includes("application/json")) {
    const body = (await request.json()) as {
      count?: number;
      split?: { a?: number; b?: number };
    };

    count = body.count ?? count;
    aCount = body.split?.a ?? aCount;
    bCount = body.split?.b ?? bCount;
  }

  if (aCount + bCount !== count) {
    return NextResponse.json(
      { ok: false, error: "Split must sum to count" },
      { status: 400 }
    );
  }

  const jobId = crypto.randomUUID();

  await createJob({
    id: jobId,
    status: "queued",
    requested_count: count,
    a_count: aCount,
    b_count: bCount
  });

  for (let i = 0; i < aCount; i += 1) {
    await createJobItem({
      id: crypto.randomUUID(),
      jobId,
      mode: "A",
      status: "queued",
      conceptJson: generateConcept(i, "A")
    });
  }

  for (let i = 0; i < bCount; i += 1) {
    await createJobItem({
      id: crypto.randomUUID(),
      jobId,
      mode: "B",
      status: "queued",
      conceptJson: generateConcept(i, "B")
    });
  }

  if (contentType.includes("application/json")) {
    return NextResponse.json({ ok: true, jobId });
  }

  return NextResponse.redirect(new URL(`/jobs/${jobId}`, request.url));
}
