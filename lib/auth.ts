import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import crypto from "node:crypto";

const COOKIE_NAME = "admin_session";

function sessionValue(password: string): string {
  return crypto.createHash("sha256").update(password).digest("hex");
}

export async function isAdminAuthenticated(): Promise<boolean> {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) {
    return true;
  }

  const cookieStore = await cookies();
  const session = cookieStore.get(COOKIE_NAME)?.value;
  if (!session) {
    return false;
  }

  return session === sessionValue(password);
}

export async function requireAdminOr401(): Promise<NextResponse | null> {
  const ok = await isAdminAuthenticated();
  if (ok) {
    return null;
  }
  return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
}

export function buildAdminSessionCookie(password: string): string {
  return sessionValue(password);
}

export const ADMIN_SESSION_COOKIE = COOKIE_NAME;
