import { NextResponse } from "next/server";
import { getJobWithDetails, initDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  await initDb();
  const { id } = await context.params;

  const data = await getJobWithDetails(id);

  if (!data.job) {
    return NextResponse.json({ ok: false, error: "Job not found" }, { status: 404 });
  }

  const groups = {
    aEditpack: data.outputs
      .filter((o) => o.type === "A_EDITPACK")
      .map((o) => o.blob_url),
    aMp4: data.outputs.filter((o) => o.type === "A_MP4").map((o) => o.blob_url),
    bMp4: data.outputs.filter((o) => o.type === "B_MP4").map((o) => o.blob_url)
  };

  return NextResponse.json({ ok: true, job: data.job, groups });
}
