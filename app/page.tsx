import { AdminLogin } from "@/components/AdminLogin";
import { TopNav } from "@/components/TopNav";
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

      <div className="card">
        <h2>Batch Runner</h2>
        <p>Creates 20 items split across A10/B10 and sends you to the jobs page.</p>
        <form action="/api/queue-batch" method="post">
          <button type="submit">Generate 20 + Queue A10/B10</button>
        </form>
      </div>

      <div className="card">
        <h2>Worker Controls</h2>
        <p>
          <a href="/api/worker">Run /api/worker</a>
          {" | "}
          <a href="/api/render-worker">Run /api/render-worker</a>
        </p>
      </div>
    </main>
  );
}
