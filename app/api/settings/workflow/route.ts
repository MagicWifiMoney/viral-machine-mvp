import { NextResponse } from "next/server";
import { initDb, setAppSetting } from "@/lib/db";
import { requireAdminOr401 } from "@/lib/auth";
import { getWorkflowDefault } from "@/lib/settings";
import type { WorkflowMode } from "@/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAdminOr401();
  if (auth) {
    return auth;
  }

  await initDb();
  const defaultMode = await getWorkflowDefault();
  return NextResponse.json({ ok: true, defaultMode });
}

export async function POST(request: Request) {
  const auth = await requireAdminOr401();
  if (auth) {
    return auth;
  }

  await initDb();
  const body = (await request.json()) as { defaultMode?: WorkflowMode };

  if (body.defaultMode !== "autonomous" && body.defaultMode !== "approval") {
    return NextResponse.json({ ok: false, error: "Invalid workflow mode" }, { status: 400 });
  }

  await setAppSetting("workflow", { defaultMode: body.defaultMode });
  return NextResponse.json({ ok: true, defaultMode: body.defaultMode });
}
