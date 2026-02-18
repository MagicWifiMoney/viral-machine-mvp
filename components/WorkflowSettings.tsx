"use client";

import { useEffect, useState } from "react";

export function WorkflowSettings() {
  const [defaultMode, setDefaultMode] = useState<"autonomous" | "approval">("autonomous");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const response = await fetch("/api/settings/workflow");
        const data = (await response.json()) as {
          ok?: boolean;
          defaultMode?: "autonomous" | "approval";
        };
        if (response.ok && data.ok && data.defaultMode) {
          setDefaultMode(data.defaultMode);
        }
      } catch {
        setMessage("Could not load workflow setting.");
      }
    }
    void load();
  }, []);

  async function save() {
    setSaving(true);
    setMessage("Saving...");
    try {
      const response = await fetch("/api/settings/workflow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ defaultMode })
      });
      const data = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !data.ok) {
        setMessage(data.error ?? "Save failed.");
        return;
      }
      setMessage("Saved default workflow mode.");
    } catch {
      setMessage("Request failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card">
      <h2>Workflow Defaults</h2>
      <p>Choose whether new jobs default to autonomous or require manual approvals.</p>
      <label htmlFor="default-workflow">Default workflow mode</label>
      <select
        id="default-workflow"
        value={defaultMode}
        onChange={(event) => setDefaultMode(event.target.value as "autonomous" | "approval")}
      >
        <option value="autonomous">Autonomous</option>
        <option value="approval">Approval required</option>
      </select>
      <button type="button" onClick={save} disabled={saving}>
        {saving ? "Saving..." : "Save Default"}
      </button>
      <br />
      <small>{message}</small>
    </div>
  );
}
