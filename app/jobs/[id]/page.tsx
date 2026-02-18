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
    job: { id: string; status: string };
    groups: {
      aEditpack: string[];
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
          <a href={`/api/jobs/${id}`}>Refresh JSON</a>
        </p>
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
