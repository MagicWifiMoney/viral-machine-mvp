import { NextResponse } from "next/server";
import { getPublishQueueById, initDb, updatePublishQueueStatus } from "@/lib/db";
import { requireAdminOr401 } from "@/lib/auth";
import { getPostBridgeStatus } from "@/lib/postBridge";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminOr401();
  if (auth) return auth;
  await initDb();
  const { id } = await context.params;

  const queueItem = await getPublishQueueById(id);
  if (!queueItem) {
    return NextResponse.json({ ok: false, error: "Publish queue item not found" }, { status: 404 });
  }

  if (!queueItem.external_post_id) {
    return NextResponse.json({ ok: true, status: queueItem.status, queueItem });
  }

  const status = await getPostBridgeStatus(queueItem.external_post_id);
  if (!status.ok) {
    await updatePublishQueueStatus({
      id,
      status: "status_check_failed",
      error: status.error ?? "Unknown status check error"
    });
    return NextResponse.json({ ok: false, error: status.error, queueItem }, { status: 500 });
  }

  await updatePublishQueueStatus({ id, status: status.status ?? "unknown" });
  const updated = await getPublishQueueById(id);
  return NextResponse.json({ ok: true, status: status.status, queueItem: updated });
}
