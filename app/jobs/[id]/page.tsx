import { TopNav } from "@/components/TopNav";

export const dynamic = "force-dynamic";

async function fetchJob(id: string) {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const response = await fetch(`${baseUrl}/api/jobs/${id}`, { cache: "no-store" });
  if (!response.ok) {
    return null;
  }
  return (await response.json()) as {
    ok: boolean;
    job: { id: string; status: string; workflow_mode?: string };
    items: Array<{
      id: string;
      mode: string;
      status: string;
      approval_status: string;
      quality_score: number | null;
      estimated_cost_usd: string | null;
      concept_json?: {
        variantIndex?: number;
        variantCount?: number;
        titleCandidates?: Array<{ text: string; score: number }>;
        thumbnailPromptCandidates?: Array<{ text: string; score: number }>;
      };
    }>;
    outputRecords: Array<{
      id: string;
      outputId: string;
      type: string;
      url: string;
      jobItemId: string;
    }>;
    ratings: Array<{ output_id: string; rating: string; note?: string | null }>;
    publishQueue: Array<{
      id: string;
      output_id: string;
      channel: string;
      status: string;
      scheduled_for: string;
      external_post_id?: string | null;
      error?: string | null;
    }>;
    costSummary?: { estimatedTotalUsd: number };
    groups: {
      aEditpack: string[];
      aVoiceoverMp3: string[];
      aMp4: string[];
      bMp4: string[];
    };
  };
}

export default async function JobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await fetchJob(id);

  if (!data) {
    return (
      <main>
        <TopNav />
        <div className="card">Job not found.</div>
      </main>
    );
  }

  return (
    <main>
      <h1>Job {id}</h1>
      <TopNav />

      <div className="card">
        <p>
          Status: <span className="status-badge">{data.job.status}</span>
        </p>
        <p>
          Workflow mode: <span className="status-badge">{data.job.workflow_mode ?? "autonomous"}</span>
        </p>
        <p>Estimated total cost: ${data.costSummary?.estimatedTotalUsd ?? 0}</p>
        <p>
          <a href={`/api/jobs/${id}`}>Refresh JSON</a>
        </p>
      </div>

      <div className="card">
        <h2>Variants + Creative Lab</h2>
        <ul>
          {data.items.slice(0, 10).map((item) => (
            <li key={item.id}>
              {item.mode} variant {(item.concept_json?.variantIndex ?? 0) + 1}/
              {item.concept_json?.variantCount ?? 1} | score {item.quality_score ?? "-"} | est $
              {item.estimated_cost_usd ?? "0"}
              <br />
              <small>
                Top title: {item.concept_json?.titleCandidates?.[0]?.text ?? "n/a"}
              </small>
            </li>
          ))}
        </ul>
      </div>

      <div className="card">
        <h2>Approval Queue</h2>
        {data.items.filter((item) => item.approval_status === "pending").length === 0 ? (
          <p>No pending approvals.</p>
        ) : null}
        <ul>
          {data.items
            .filter((item) => item.approval_status === "pending")
            .map((item) => (
              <li key={item.id}>
                <strong>{item.mode}</strong> | score: {item.quality_score ?? "-"} | est: $
                {item.estimated_cost_usd ?? "0"}
                <div style={{ display: "flex", gap: 8, marginTop: 8, marginBottom: 8 }}>
                  <form action={`/api/jobs/${id}/approve-item`} method="post">
                    <input type="hidden" name="jobItemId" value={item.id} />
                    <input type="hidden" name="action" value="approve" />
                    <button type="submit">Approve</button>
                  </form>
                  <form action={`/api/jobs/${id}/approve-item`} method="post">
                    <input type="hidden" name="jobItemId" value={item.id} />
                    <input type="hidden" name="action" value="reject" />
                    <button type="submit" className="secondary">
                      Reject
                    </button>
                  </form>
                </div>
              </li>
            ))}
        </ul>
      </div>

      <div className="card">
        <h2>A editpack</h2>
        {data.groups.aEditpack.length === 0 ? <p>None yet.</p> : null}
        <ul>
          {data.groups.aEditpack.map((link) => (
            <li key={link}>
              <a href={link} target="_blank" rel="noreferrer">
                {link}
              </a>
            </li>
          ))}
        </ul>
      </div>

      <div className="card">
        <h2>A voiceover mp3</h2>
        {data.groups.aVoiceoverMp3.length === 0 ? <p>None yet.</p> : null}
        <ul>
          {data.groups.aVoiceoverMp3.map((link) => (
            <li key={link}>
              <a href={link} target="_blank" rel="noreferrer">
                {link}
              </a>
            </li>
          ))}
        </ul>
      </div>

      <div className="card">
        <h2>B mp4</h2>
        {data.groups.bMp4.length === 0 ? <p>None yet.</p> : null}
        <ul>
          {data.groups.bMp4.map((link) => (
            <li key={link}>
              <a href={link} target="_blank" rel="noreferrer">
                {link}
              </a>
            </li>
          ))}
        </ul>
      </div>

      <div className="card">
        <h2>Ratings + Publish Queue</h2>
        {data.outputRecords.length === 0 ? <p>No outputs yet.</p> : null}
        <ul>
          {data.outputRecords.map((output) => (
            <li key={output.id}>
              <a href={output.url} target="_blank" rel="noreferrer">
                {output.type}
              </a>
              <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                <form action="/api/ratings" method="post">
                  <input type="hidden" name="outputId" value={output.id} />
                  <input type="hidden" name="rating" value="win" />
                  <button type="submit">Rate Win</button>
                </form>
                <form action="/api/ratings" method="post">
                  <input type="hidden" name="outputId" value={output.id} />
                  <input type="hidden" name="rating" value="neutral" />
                  <button type="submit" className="secondary">
                    Rate Neutral
                  </button>
                </form>
                <form action="/api/ratings" method="post">
                  <input type="hidden" name="outputId" value={output.id} />
                  <input type="hidden" name="rating" value="loss" />
                  <button type="submit" className="secondary">
                    Rate Loss
                  </button>
                </form>
              </div>

              {(output.type === "B_MP4" || output.type === "A_MP4") && (
                <form action="/api/publish/schedule" method="post">
                  <input type="hidden" name="outputId" value={output.id} />
                  <input type="hidden" name="redirectTo" value={`/jobs/${id}`} />
                  <label>Channel</label>
                  <select name="channel" defaultValue="tiktok">
                    <option value="tiktok">TikTok</option>
                    <option value="instagram_reels">Instagram Reels</option>
                  </select>
                  <label>Caption</label>
                  <input
                    name="caption"
                    defaultValue="New drop from Viral Machine. Save this and remix for your niche."
                  />
                  <label>Scheduled (ISO)</label>
                  <input
                    name="scheduledFor"
                    defaultValue={new Date(Date.now() + 60 * 60 * 1000).toISOString()}
                  />
                  <button type="submit">Schedule via Post Bridge</button>
                </form>
              )}
            </li>
          ))}
        </ul>
        <h3>Scheduled Posts</h3>
        {data.publishQueue.length === 0 ? <p>None yet.</p> : null}
        <ul>
          {data.publishQueue.map((row) => (
            <li key={row.id}>
              {row.channel} | {row.status} | {row.scheduled_for}
              {row.external_post_id ? ` | ${row.external_post_id}` : ""}
              {row.error ? ` | error: ${row.error}` : ""}
            </li>
          ))}
        </ul>
      </div>

      <div className="card">
        <h2>A mp4</h2>
        {data.groups.aMp4.length === 0 ? <p>None yet (rendering may be disabled).</p> : null}
        <ul>
          {data.groups.aMp4.map((link) => (
            <li key={link}>
              <a href={link} target="_blank" rel="noreferrer">
                {link}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
