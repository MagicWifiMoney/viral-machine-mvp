import { NextResponse } from "next/server";
import { initDb, refreshJobStatus, setJobItemApproval } from "@/lib/db";
import { requireAdminOr401 } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminOr401();
  if (auth) {
    return auth;
  }

  await initDb();
  const { id: jobId } = await context.params;

  const contentType = request.headers.get("content-type") ?? "";
  let jobItemId = "";
  let action: "approve" | "reject" | undefined;
  let note = "";

  if (contentType.includes("application/json")) {
    const body = (await request.json()) as {
      jobItemId?: string;
      action?: "approve" | "reject";
      note?: string;
    };
    jobItemId = String(body.jobItemId ?? "").trim();
    action = body.action;
    note = String(body.note ?? "").trim();
  } else {
    const form = await request.formData();
    jobItemId = String(form.get("jobItemId") ?? "").trim();
    const rawAction = String(form.get("action") ?? "").trim();
    action = rawAction === "approve" || rawAction === "reject" ? rawAction : undefined;
    note = String(form.get("note") ?? "").trim();
  }

  if (!jobItemId || (action !== "approve" && action !== "reject")) {
    return NextResponse.json({ ok: false, error: "Invalid approval request" }, { status: 400 });
  }

  if (action === "approve") {
    await setJobItemApproval({
      jobItemId,
      status: "approved",
      itemStatus: "queued",
      note: note || null
    });
  } else {
    await setJobItemApproval({
      jobItemId,
      status: "rejected",
      itemStatus: "skipped",
      note: note || null
    });
  }

  await refreshJobStatus(jobId);
  if (contentType.includes("application/json")) {
    return NextResponse.json({ ok: true });
  }
  return NextResponse.redirect(new URL(`/jobs/${jobId}`, request.url));
}
