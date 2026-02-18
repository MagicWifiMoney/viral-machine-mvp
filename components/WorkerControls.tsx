"use client";

import { useState } from "react";

type WorkerResult = {
  ok?: boolean;
  processed?: number;
  rendered?: number;
  skipped?: boolean;
  errors?: string[];
};

export function WorkerControls() {
  const [loading, setLoading] = useState<"worker" | "render" | "both" | null>(null);
  const [message, setMessage] = useState<string>("");

  async function runWorker() {
    setLoading("worker");
    setMessage("Running worker...");
    try {
      const response = await fetch("/api/worker");
      const result = (await response.json()) as WorkerResult;

      if (!response.ok || result.ok === false) {
        setMessage(`Worker failed. ${result.errors?.[0] ?? "Please try again."}`);
        return;
      }

      setMessage(`Worker finished. Processed ${result.processed ?? 0} item(s).`);
    } catch {
      setMessage("Worker request failed. Please try again.");
    } finally {
      setLoading(null);
    }
  }

  async function runRenderWorker() {
    setLoading("render");
    setMessage("Running render worker...");
    try {
      const response = await fetch("/api/render-worker");
      const result = (await response.json()) as WorkerResult;

      if (!response.ok || result.ok === false) {
        setMessage("Render worker failed. Please try again.");
        return;
      }

      if (result.skipped) {
        setMessage("Render worker ran, but A render is currently disabled.");
        return;
      }

      setMessage(`Render worker finished. Rendered ${result.rendered ?? 0} item(s).`);
    } catch {
      setMessage("Render worker request failed. Please try again.");
    } finally {
      setLoading(null);
    }
  }

  async function runBoth() {
    setLoading("both");
    setMessage("Running both workers...");
    try {
      const workerResponse = await fetch("/api/worker");
      const workerResult = (await workerResponse.json()) as WorkerResult;

      if (!workerResponse.ok || workerResult.ok === false) {
        setMessage(`Worker failed. ${workerResult.errors?.[0] ?? "Please try again."}`);
        return;
      }

      const renderResponse = await fetch("/api/render-worker");
      const renderResult = (await renderResponse.json()) as WorkerResult;

      if (!renderResponse.ok || renderResult.ok === false) {
        setMessage("Worker ran, but render worker failed.");
        return;
      }

      const renderPart = renderResult.skipped
        ? "Render is disabled."
        : `Rendered ${renderResult.rendered ?? 0} item(s).`;

      setMessage(
        `Done. Processed ${workerResult.processed ?? 0} item(s). ${renderPart}`
      );
    } catch {
      setMessage("Request failed while running workers. Please try again.");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div>
      <p>
        Use these buttons if your job is stuck on <strong>queued</strong>.
      </p>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
        <button type="button" onClick={runWorker} disabled={loading !== null}>
          {loading === "worker" ? "Running Worker..." : "Run Worker"}
        </button>
        <button
          type="button"
          className="secondary"
          onClick={runRenderWorker}
          disabled={loading !== null}
        >
          {loading === "render" ? "Running Render..." : "Run Render Worker"}
        </button>
        <button type="button" onClick={runBoth} disabled={loading !== null}>
          {loading === "both" ? "Running Both..." : "Run Both"}
        </button>
      </div>
      <small>{message}</small>
    </div>
  );
}
