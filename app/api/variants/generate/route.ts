import { NextResponse } from "next/server";
import { requireAdminOr401 } from "@/lib/auth";
import { generateConcept } from "@/lib/concepts";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await requireAdminOr401();
  if (auth) return auth;
  const body = (await request.json()) as { mode?: "A" | "B"; count?: number; hookIndex?: number };
  const mode = body.mode === "B" ? "B" : "A";
  const count = Math.max(1, Math.min(6, Number(body.count ?? 3)));
  const hookIndex = Number(body.hookIndex ?? 0);

  const variants = Array.from({ length: count }).map((_, variantIndex) =>
    generateConcept(hookIndex, mode, undefined, {
      variantIndex,
      variantCount: count
    })
  );

  return NextResponse.json({ ok: true, variants });
}
