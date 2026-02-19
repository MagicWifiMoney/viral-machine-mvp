"use client";

import { useEffect, useState } from "react";

type VoiceProfile = {
  id: string;
  name: string;
  external_voice_id: string;
  is_default: boolean;
};

export function BatchRunner() {
  const [workflowMode, setWorkflowMode] = useState<"autonomous" | "approval">("autonomous");
  const [videoProvider, setVideoProvider] = useState<"auto" | "openai" | "gemini">("auto");
  const [variantCount, setVariantCount] = useState(3);
  const [costPreset, setCostPreset] = useState<"cheap" | "balanced" | "max_quality">("balanced");
  const [voiceProfileId, setVoiceProfileId] = useState("");
  const [profiles, setProfiles] = useState<VoiceProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const [settingsRes, profilesRes] = await Promise.all([
          fetch("/api/settings/workflow"),
          fetch("/api/voice-profiles")
        ]);
        const settingsData = (await settingsRes.json()) as {
          ok?: boolean;
          defaultMode?: "autonomous" | "approval";
        };
        const profilesData = (await profilesRes.json()) as {
          ok?: boolean;
          profiles?: VoiceProfile[];
        };

        if (settingsData.ok && settingsData.defaultMode) {
          setWorkflowMode(settingsData.defaultMode);
        }
        if (profilesData.ok && Array.isArray(profilesData.profiles)) {
          setProfiles(profilesData.profiles);
          const defaultProfile = profilesData.profiles.find((profile) => profile.is_default);
          if (defaultProfile) {
            setVoiceProfileId(defaultProfile.id);
          }
        }
      } catch {
        setMessage("Could not load defaults. You can still queue jobs.");
      }
    }

    void load();
  }, []);

  async function submit() {
    setLoading(true);
    setMessage("Queueing batch...");
    try {
      const response = await fetch("/api/queue-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          count: 20,
          split: { a: 10, b: 10 },
          workflowMode,
          videoProvider,
          variantCount,
          costPreset,
          useTrendContext: true,
          useBrandBrain: true,
          voiceProfileId: voiceProfileId || undefined
        })
      });
      const data = (await response.json()) as {
        ok?: boolean;
        error?: string;
        jobId?: string;
      };
      if (!response.ok || !data.ok || !data.jobId) {
        setMessage(data.error ?? "Could not queue batch");
        return;
      }
      window.location.href = `/jobs/${data.jobId}`;
    } catch {
      setMessage("Request failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card">
      <h2>Batch Runner</h2>
      <p>Creates 20 items split A10/B10. Choose autonomous or approval mode per job.</p>

      <label htmlFor="workflow-mode">Workflow mode</label>
      <select
        id="workflow-mode"
        value={workflowMode}
        onChange={(event) => setWorkflowMode(event.target.value as "autonomous" | "approval")}
      >
        <option value="autonomous">Autonomous (no approvals)</option>
        <option value="approval">Approval required</option>
      </select>

      <label htmlFor="voice-profile">Voice profile (optional)</label>
      <select
        id="voice-profile"
        value={voiceProfileId}
        onChange={(event) => setVoiceProfileId(event.target.value)}
      >
        <option value="">None</option>
        {profiles.map((profile) => (
          <option key={profile.id} value={profile.id}>
            {profile.name} {profile.is_default ? "(default)" : ""}
          </option>
        ))}
      </select>

      <label htmlFor="video-provider">B video provider</label>
      <select
        id="video-provider"
        value={videoProvider}
        onChange={(event) =>
          setVideoProvider(event.target.value as "auto" | "openai" | "gemini")
        }
      >
        <option value="auto">Auto (use env default/fallback)</option>
        <option value="gemini">Gemini Veo</option>
        <option value="openai">OpenAI Sora</option>
      </select>

      <label htmlFor="variant-count">Variants per idea</label>
      <select
        id="variant-count"
        value={String(variantCount)}
        onChange={(event) => setVariantCount(Number(event.target.value))}
      >
        <option value="2">2</option>
        <option value="3">3</option>
        <option value="4">4</option>
      </select>

      <label htmlFor="cost-preset">Cost preset</label>
      <select
        id="cost-preset"
        value={costPreset}
        onChange={(event) =>
          setCostPreset(event.target.value as "cheap" | "balanced" | "max_quality")
        }
      >
        <option value="cheap">Cheap</option>
        <option value="balanced">Balanced</option>
        <option value="max_quality">Max Quality</option>
      </select>

      <button type="button" onClick={submit} disabled={loading}>
        {loading ? "Queueing..." : "Generate 20 + Queue A10/B10"}
      </button>
      <br />
      <small>{message}</small>
    </div>
  );
}
