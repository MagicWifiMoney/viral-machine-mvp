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
