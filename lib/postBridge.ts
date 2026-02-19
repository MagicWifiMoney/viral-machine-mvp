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
    const candidates = [
      {
        path: "/v1/posts/schedule",
        body: {
          workspaceId,
          channel: args.channel,
          mediaUrl: args.mediaUrl,
          caption: args.caption,
          scheduledFor: args.scheduledFor
        }
      },
      {
        path: "/v1/schedule",
        body: {
          workspaceId,
          platform: args.channel,
          media_url: args.mediaUrl,
          caption: args.caption,
          scheduled_for: args.scheduledFor
        }
      },
      {
        path: "/v1/publish/schedule",
        body: {
          workspaceId,
          channel: args.channel,
          assetUrl: args.mediaUrl,
          caption: args.caption,
          scheduledAt: args.scheduledFor
        }
      },
      ...(workspaceId
        ? [
            {
              path: `/v1/workspaces/${workspaceId}/posts/schedule`,
              body: {
                channel: args.channel,
                mediaUrl: args.mediaUrl,
                caption: args.caption,
                scheduledFor: args.scheduledFor
              }
            }
          ]
        : [])
    ];

    let lastStatus = 0;
    let lastRaw: Record<string, unknown> = {};

    for (const candidate of candidates) {
      const response = await fetch(`${baseUrl}${candidate.path}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(candidate.body)
      });

      const raw = (await response.json().catch(() => ({}))) as Record<string, unknown>;
      if (response.ok) {
        const externalPostId = String(raw.id ?? raw.postId ?? raw.externalPostId ?? "");
        const status = String(raw.status ?? "scheduled");
        if (!externalPostId) {
          return { ok: false, error: "Post Bridge response missing post id", raw };
        }
        return { ok: true, externalPostId, status, raw };
      }

      lastStatus = response.status;
      lastRaw = raw;
      if (response.status !== 404 && response.status !== 405) {
        return {
          ok: false,
          error: `Post Bridge schedule failed (${response.status})`,
          raw
        };
      }
    }

    return {
      ok: false,
      error: `Post Bridge schedule failed (${lastStatus || 404})`,
      raw: lastRaw
    };
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
    const paths = [
      `/v1/posts/${externalPostId}`,
      `/v1/post/${externalPostId}`,
      `/v1/publish/${externalPostId}`
    ];
    let lastStatus = 0;
    let lastRaw: Record<string, unknown> = {};

    for (const path of paths) {
      const response = await fetch(`${baseUrl}${path}`, {
        method: "GET",
        headers: { Authorization: `Bearer ${apiKey}` }
      });
      const raw = (await response.json().catch(() => ({}))) as Record<string, unknown>;
      if (response.ok) {
        return { ok: true, status: String(raw.status ?? "unknown"), raw };
      }

      lastStatus = response.status;
      lastRaw = raw;
      if (response.status !== 404 && response.status !== 405) {
        return { ok: false, error: `Status fetch failed (${response.status})`, raw };
      }
    }

    return {
      ok: false,
      error: `Status fetch failed (${lastStatus || 404})`,
      raw: lastRaw
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Unknown Post Bridge status error"
    };
  }
}
