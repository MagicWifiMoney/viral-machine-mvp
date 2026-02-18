import { NextResponse } from "next/server";
import { runMainWorker } from "@/lib/workers";

export const dynamic = "force-dynamic";

export async function GET() {
  const result = await runMainWorker();
  return NextResponse.json(result);
}

export const POST = GET;
