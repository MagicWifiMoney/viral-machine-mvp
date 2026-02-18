import { AdminLogin } from "@/components/AdminLogin";
import { ReferenceVideoIntake } from "@/components/ReferenceVideoIntake";
import { TopNav } from "@/components/TopNav";
import { WorkerControls } from "@/components/WorkerControls";
import { isAdminAuthenticated } from "@/lib/auth";

export default async function HomePage() {
  const isAdmin = await isAdminAuthenticated();

  if (!isAdmin) {
    return (
      <main>
        <h1>Viral Machine MVP</h1>
        <AdminLogin />
      </main>
    );
  }

  return (
    <main>
      <h1>Viral Machine MVP</h1>
      <TopNav />

      <ReferenceVideoIntake />

      <div className="card">
        <h2>Batch Runner</h2>
        <p>Creates 20 items split across A10/B10 and sends you to the jobs page.</p>
        <form action="/api/queue-batch" method="post">
          <button type="submit">Generate 20 + Queue A10/B10</button>
        </form>
      </div>

      <div className="card">
        <h2>How to Use (Quick Guide)</h2>
        <p>1. Upload your media in the <a href="/assets">Assets page</a> first.</p>
        <p>2. Click <strong>Generate 20 + Queue A10/B10</strong>.</p>
        <p>3. If the job says <strong>queued</strong> or <strong>running</strong>, click <strong>Run Worker</strong> below.</p>
        <p>4. Open your job page and refresh every 20–30 seconds.</p>
        <p>5. Results:</p>
        <p>- <strong>A editpack</strong> = JSON content plans</p>
        <p>- <strong>B mp4</strong> = generated videos</p>
        <p>- <strong>A mp4</strong> appears only if A rendering is enabled</p>
      </div>

      <div className="card">
        <h2>Worker Controls</h2>
        <WorkerControls />
      </div>
    </main>
  );
}
