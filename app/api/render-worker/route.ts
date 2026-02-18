import { NextResponse } from "next/server";
import { runRenderWorker } from "@/lib/workers";

export const dynamic = "force-dynamic";

export async function GET() {
  const result = await runRenderWorker();
  return NextResponse.json(result);
}

export const POST = GET;
