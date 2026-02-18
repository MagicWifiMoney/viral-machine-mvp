import { AdminLogin } from "@/components/AdminLogin";
import { TopNav } from "@/components/TopNav";
import { isAdminAuthenticated } from "@/lib/auth";
import { listAssets } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function AssetsPage() {
  const isAdmin = await isAdminAuthenticated();

  if (!isAdmin) {
    return (
      <main>
        <h1>Assets</h1>
        <AdminLogin title="Assets Login" />
      </main>
    );
  }

  const assets = await listAssets();

  return (
    <main>
      <h1>Assets</h1>
      <TopNav />

      <div className="card">
        <h2>Upload Asset</h2>
        <form action="/api/assets/upload" method="post" encType="multipart/form-data">
          <label htmlFor="kind">kind</label>
          <select id="kind" name="kind" required>
            <option value="broll">broll</option>
            <option value="proof">proof</option>
            <option value="music">music</option>
          </select>

          <label htmlFor="category">category</label>
          <input id="category" name="category" placeholder="aroll_facecam" required />

          <label htmlFor="file">file</label>
          <input id="file" name="file" type="file" required />

          <button type="submit">Upload</button>
        </form>
      </div>

      <div className="card">
        <h2>Current Assets</h2>
        {assets.length === 0 ? <p>No assets uploaded yet.</p> : null}
        <ul>
          {assets.map((asset) => (
            <li key={asset.id}>
              <strong>
                {asset.kind}/{asset.category}
              </strong>{" "}
              <a href={asset.blob_url} target="_blank" rel="noreferrer">
                file
              </a>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
