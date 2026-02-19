"use client";

import { useEffect, useState } from "react";

export function GrowthLabControls() {
  const [claims, setClaims] = useState("Save time with AI edits\nRepurpose one idea into many posts");
  const [defaultCta, setDefaultCta] = useState("Comment \"BLUEPRINT\" for the template");
  const [tone, setTone] = useState("direct, practical, no fluff");
  const [bannedWords, setBannedWords] = useState("guaranteed, passive income");
  const [defaultPreset, setDefaultPreset] = useState<"cheap" | "balanced" | "max_quality">("balanced");
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const [brandRes, presetRes] = await Promise.all([
          fetch("/api/brand-brain"),
          fetch("/api/cost-presets")
        ]);
        const brand = (await brandRes.json()) as {
          ok?: boolean;
          brandBrain?: {
            claims_json?: string[];
            default_cta?: string | null;
            tone?: string | null;
            banned_words_json?: string[];
          };
        };
        const preset = (await presetRes.json()) as {
          ok?: boolean;
          defaultPreset?: "cheap" | "balanced" | "max_quality";
        };
        if (brand.ok && brand.brandBrain) {
          setClaims((brand.brandBrain.claims_json ?? []).join("\n"));
          setDefaultCta(brand.brandBrain.default_cta ?? "");
          setTone(brand.brandBrain.tone ?? "");
          setBannedWords((brand.brandBrain.banned_words_json ?? []).join(", "));
        }
        if (preset.ok && preset.defaultPreset) {
          setDefaultPreset(preset.defaultPreset);
        }
      } catch {
        setMessage("Could not load growth lab settings.");
      }
    }
    void load();
  }, []);

  async function saveBrandBrain() {
    setMessage("Saving brand brain...");
    const response = await fetch("/api/brand-brain", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        claims: claims
          .split("\n")
          .map((x) => x.trim())
          .filter(Boolean),
        defaultCta,
        tone,
        bannedWords: bannedWords
          .split(",")
          .map((x) => x.trim())
          .filter(Boolean)
      })
    });
    setMessage(response.ok ? "Brand brain saved." : "Could not save brand brain.");
  }

  async function ingestTrends() {
    setMessage("Ingesting trends...");
    const response = await fetch("/api/trends/ingest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    });
    const data = (await response.json()) as { inserted?: number };
    setMessage(response.ok ? `Ingested ${data.inserted ?? 0} trends.` : "Trend ingest failed.");
  }

  async function saveCostPreset() {
    setMessage("Saving cost preset...");
    const response = await fetch("/api/cost-presets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ defaultPreset })
    });
    setMessage(response.ok ? "Cost preset saved." : "Could not save cost preset.");
  }

  return (
    <>
      <div className="card">
        <h2>Brand Brain</h2>
        <label>Claims (one per line)</label>
        <textarea
          value={claims}
          onChange={(event) => setClaims(event.target.value)}
          style={{ width: "100%", minHeight: 110, marginBottom: 12 }}
        />
        <label>Default CTA</label>
        <input value={defaultCta} onChange={(event) => setDefaultCta(event.target.value)} />
        <label>Tone</label>
        <input value={tone} onChange={(event) => setTone(event.target.value)} />
        <label>Banned words (comma separated)</label>
        <input value={bannedWords} onChange={(event) => setBannedWords(event.target.value)} />
        <button type="button" onClick={saveBrandBrain}>
          Save Brand Brain
        </button>
      </div>

      <div className="card">
        <h2>Trend Miner</h2>
        <p>Ingests fresh YouTube Shorts trend patterns for hook/style guidance.</p>
        <button type="button" onClick={ingestTrends}>
          Ingest Trends Now
        </button>
      </div>

      <div className="card">
        <h2>Cost Optimizer</h2>
        <label>Default cost preset</label>
        <select
          value={defaultPreset}
          onChange={(event) =>
            setDefaultPreset(event.target.value as "cheap" | "balanced" | "max_quality")
          }
        >
          <option value="cheap">Cheap</option>
          <option value="balanced">Balanced</option>
          <option value="max_quality">Max quality</option>
        </select>
        <button type="button" onClick={saveCostPreset}>
          Save Cost Preset
        </button>
      </div>
      <small>{message}</small>
    </>
  );
}
