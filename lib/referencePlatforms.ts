export type ReferencePlatform = "youtube" | "tiktok" | "instagram" | "unknown";

export function detectReferencePlatform(raw: string): ReferencePlatform {
  try {
    const url = new URL(raw);
    const host = url.hostname.toLowerCase();

    if (host.includes("youtube.com") || host.includes("youtu.be")) {
      return "youtube";
    }
    if (host.includes("tiktok.com") || host.includes("vm.tiktok.com")) {
      return "tiktok";
    }
    if (host.includes("instagram.com")) {
      return "instagram";
    }
    return "unknown";
  } catch {
    return "unknown";
  }
}

export function isSupportedReferenceUrl(raw: string): boolean {
  const platform = detectReferencePlatform(raw);
  return platform === "youtube" || platform === "tiktok";
}
