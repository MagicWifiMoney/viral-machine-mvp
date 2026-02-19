import { NextResponse } from "next/server";
import { getJobWithDetails, initDb, listPublishQueueByJob, listRatingsByJob } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  await initDb();
  const { id } = await context.params;

  const data = await getJobWithDetails(id);
  const [ratings, publishQueue] = await Promise.all([
    listRatingsByJob(id),
    listPublishQueueByJob(id)
  ]);

  if (!data.job) {
    return NextResponse.json({ ok: false, error: "Job not found" }, { status: 404 });
  }

  const groups = {
    aEditpack: data.outputs
      .filter((o) => o.type === "A_EDITPACK")
      .map((o) => o.blob_url),
    aVoiceoverMp3: data.outputs
      .filter((o) => o.type === "A_VOICEOVER_MP3")
      .map((o) => o.blob_url),
    aMp4: data.outputs.filter((o) => o.type === "A_MP4").map((o) => o.blob_url),
    bMp4: data.outputs.filter((o) => o.type === "B_MP4").map((o) => o.blob_url)
  };

  const estimatedTotalUsd = data.items.reduce((sum, item) => {
    const value = Number(item.estimated_cost_usd ?? 0);
    return sum + (Number.isFinite(value) ? value : 0);
  }, 0);

  const outputs = data.outputs.map((output) => ({
    ...output,
    estimatedCostUsd:
      typeof output.meta_json?.estimatedCostUsd === "number"
        ? output.meta_json.estimatedCostUsd
        : null,
    qualityScore:
      typeof output.meta_json?.qualityScore === "number" ? output.meta_json.qualityScore : null
  }));

  const outputRecords = data.outputs.map((output) => ({
    id: output.id,
    outputId: output.id,
    type: output.type,
    url: output.blob_url,
    jobItemId: output.job_item_id
  }));

  return NextResponse.json({
    ok: true,
    job: data.job,
    groups,
    outputs,
    outputRecords,
    items: data.items,
    ratings,
    publishQueue,
    costSummary: { estimatedTotalUsd: Math.round(estimatedTotalUsd * 1000) / 1000 }
  });
}
