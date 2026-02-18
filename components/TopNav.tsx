"use client";

export function TopNav() {
  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    window.location.href = "/";
  }

  return (
    <div className="card" style={{ display: "flex", gap: 12, alignItems: "center" }}>
      <a href="/">Home</a>
      <a href="/assets">Assets</a>
      <button type="button" className="secondary" onClick={logout}>
        Log out
      </button>
    </div>
  );
}
