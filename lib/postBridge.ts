type ScheduleArgs = {
  channel: "tiktok" | "instagram_reels";
  mediaUrl: string;
  caption: string;
  scheduledFor: string;
};

type ScheduleResult =
  | { ok: true; externalPostId: string; status: string; raw: Record<string, unknown> }
  | { ok: false; error: string; raw?: Record<string, unknown> };

const DEFAULT_BASE_URL = "https://api.post-bridge.com";

function getConfig() {
  return {
    baseUrl: process.env.POST_BRIDGE_BASE_URL ?? DEFAULT_BASE_URL,
    apiKey: process.env.POST_BRIDGE_API_KEY,
    workspaceId: process.env.POST_BRIDGE_WORKSPACE_ID
  };
}

export async function schedulePostBridgePost(args: ScheduleArgs): Promise<ScheduleResult> {
  const { baseUrl, apiKey, workspaceId } = getConfig();
  if (!apiKey) {
    return { ok: false, error: "POST_BRIDGE_API_KEY is not set" };
  }

  try {
    const response = await fetch(`${baseUrl}/v1/posts/schedule`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        workspaceId,
        channel: args.channel,
        mediaUrl: args.mediaUrl,
        caption: args.caption,
        scheduledFor: args.scheduledFor
      })
    });

    const raw = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    if (!response.ok) {
      return {
        ok: false,
        error: `Post Bridge schedule failed (${response.status})`,
        raw
      };
    }

    const externalPostId = String(raw.id ?? raw.postId ?? raw.externalPostId ?? "");
    const status = String(raw.status ?? "scheduled");
    if (!externalPostId) {
      return { ok: false, error: "Post Bridge response missing post id", raw };
    }

    return { ok: true, externalPostId, status, raw };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Unknown Post Bridge error"
    };
  }
}

export async function getPostBridgeStatus(externalPostId: string): Promise<{
  ok: boolean;
  status?: string;
  raw?: Record<string, unknown>;
  error?: string;
}> {
  const { baseUrl, apiKey } = getConfig();
  if (!apiKey) {
    return { ok: false, error: "POST_BRIDGE_API_KEY is not set" };
  }

  try {
    const response = await fetch(`${baseUrl}/v1/posts/${externalPostId}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${apiKey}` }
    });
    const raw = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    if (!response.ok) {
      return { ok: false, error: `Status fetch failed (${response.status})`, raw };
    }
    return { ok: true, status: String(raw.status ?? "unknown"), raw };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Unknown Post Bridge status error"
    };
  }
}
