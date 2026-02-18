"use client";

import { FormEvent, useState } from "react";

export function AdminLogin({ title = "Admin Login" }: { title?: string }) {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const response = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password })
    });

    const data = (await response.json()) as { ok?: boolean; error?: string };

    setLoading(false);

    if (!response.ok || !data.ok) {
      setError(data.error ?? "Login failed");
      return;
    }

    window.location.reload();
  }

  return (
    <div className="card">
      <h2>{title}</h2>
      <form onSubmit={onSubmit}>
        <label htmlFor="password">Admin password</label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Enter ADMIN_PASSWORD"
          required
        />
        <button disabled={loading}>{loading ? "Signing in..." : "Sign in"}</button>
        {error ? <p className="error">{error}</p> : null}
      </form>
    </div>
  );
}
