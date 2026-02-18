import { NextResponse } from "next/server";
import { initDb } from "@/lib/db";

export const dynamic = "force-dynamic";

async function handler() {
  try {
    await initDb();
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "init-db failed" },
      { status: 500 }
    );
  }
}

export const GET = handler;
export const POST = handler;
