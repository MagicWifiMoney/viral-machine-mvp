import { AdminLogin } from "@/components/AdminLogin";
import { BatchRunner } from "@/components/BatchRunner";
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

      <BatchRunner />

      <div className="card">
        <h2>How to Use (Quick Guide)</h2>
        <p>1. Optional: paste a YouTube or TikTok URL above and click <strong>Deep Analyze Video Style</strong>.</p>
        <p>2. Upload your media in the <a href="/assets">Assets page</a>.</p>
        <p>3. Set workflow mode + video provider, then click <strong>Generate 20 + Queue A10/B10</strong>.</p>
        <p>4. If status is <strong>queued</strong> or <strong>running</strong>, click <strong>Run Worker</strong> below (or <strong>Run Both</strong>).</p>
        <p>5. In approval mode, approve/reject pending items on the job page.</p>
        <p>6. Open your job page and refresh every 20-30 seconds.</p>
        <p>7. Output types:</p>
        <p>- <strong>A editpack</strong>: JSON shot list/script instructions</p>
        <p>- <strong>A voiceover mp3</strong>: ElevenLabs narration (if voice profile selected)</p>
        <p>- <strong>B mp4</strong>: generated video output</p>
        <p>- <strong>A mp4</strong>: only appears if A rendering is enabled</p>
      </div>

      <div className="card">
        <h2>What To Upload</h2>
        <p>Minimum set on <a href="/assets">/assets</a> so results are not empty:</p>
        <p>- <strong>broll/aroll_facecam</strong>: vertical talking-head clip</p>
        <p>- <strong>broll/receipts_desk</strong>: desk/receipts footage</p>
        <p>- <strong>broll/laptop_dashboard_generic</strong>: laptop or dashboard footage</p>
        <p>- <strong>broll/airport_lifestyle</strong>: lifestyle/travel footage</p>
        <p>- <strong>proof/points_screenshot_generic</strong>: screenshot image</p>
        <p>- <strong>music/bed</strong>: background MP3</p>
      </div>

      <div className="card">
        <h2>Worker Controls</h2>
        <WorkerControls />
      </div>
    </main>
  );
}
