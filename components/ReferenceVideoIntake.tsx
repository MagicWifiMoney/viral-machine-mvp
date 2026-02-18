"use client";

import { useState } from "react";

type AnalyzeResponse = {
  ok?: boolean;
  error?: string;
  reference?: {
    title?: string | null;
    authorName?: string | null;
    url?: string;
  };
};

export function ReferenceVideoIntake() {
  const [url, setUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [loadingMode, setLoadingMode] = useState<"quick" | "deep" | null>(null);
  const [message, setMessage] = useState("");

  async function submit(mode: "quick" | "deep") {
    setLoadingMode(mode);
    setMessage(mode === "deep" ? "Running deep video analysis..." : "Analyzing reference...");

    try {
      const endpoint = mode === "deep" ? "/api/reference/deep-analyze" : "/api/reference/analyze";
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, notes })
      });

      const data = (await response.json()) as AnalyzeResponse;

      if (!response.ok || !data.ok) {
        setMessage(data.error ?? "Could not analyze that link.");
        return;
      }

      const title = data.reference?.title ? `“${data.reference.title}”` : "your reference";
      const suffix =
        mode === "deep"
          ? " Deep style profile saved from real frames."
          : " Quick style profile saved.";
      setMessage(`Saved ${title}.${suffix} New batches will follow this profile.`);
    } catch {
      setMessage("Request failed. Please try again.");
    } finally {
      setLoadingMode(null);
    }
  }

  return (
    <div className="card">
      <h2>Build From a YouTube Reference</h2>
      <p>
        Paste a YouTube link you want to emulate. The app will build a style profile,
        then future batches use that profile with your own voice and assets.
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void submit("quick");
        }}
      >
        <label htmlFor="yt-url">YouTube URL</label>
        <input
          id="yt-url"
          placeholder="https://www.youtube.com/watch?v=..."
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          required
        />

        <label htmlFor="yt-notes">Your notes (optional)</label>
        <input
          id="yt-notes"
          placeholder="ex: keep same pacing but more direct CTA"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
        />

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button type="submit" disabled={loadingMode !== null}>
            {loadingMode === "quick" ? "Saving..." : "Use Quick Reference"}
          </button>
          <button
            type="button"
            className="secondary"
            disabled={loadingMode !== null}
            onClick={() => void submit("deep")}
          >
            {loadingMode === "deep" ? "Analyzing Video..." : "Deep Analyze Video Style"}
          </button>
        </div>
      </form>
      <small>
        Deep mode inspects real frames and needs local tools (`yt-dlp` + `ffmpeg`) plus OpenAI key.
      </small>
      <br />
      <small>{message}</small>
    </div>
  );
}
