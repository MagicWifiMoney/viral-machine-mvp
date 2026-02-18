"use client";

import { useEffect, useState } from "react";

type VoiceProfile = {
  id: string;
  name: string;
  external_voice_id: string;
  is_default: boolean;
};

export function VoiceStudio() {
  const [profiles, setProfiles] = useState<VoiceProfile[]>([]);
  const [name, setName] = useState("");
  const [externalVoiceId, setExternalVoiceId] = useState("");
  const [testMessage, setTestMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const response = await fetch("/api/voice-profiles");
    const data = (await response.json()) as { ok?: boolean; profiles?: VoiceProfile[] };
    if (response.ok && data.ok && Array.isArray(data.profiles)) {
      setProfiles(data.profiles);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function createProfile() {
    setBusy(true);
    setTestMessage("Creating voice profile...");
    try {
      const response = await fetch("/api/voice-profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          externalVoiceId
        })
      });
      const data = (await response.json()) as { ok?: boolean; error?: string; profiles?: VoiceProfile[] };
      if (!response.ok || !data.ok) {
        setTestMessage(data.error ?? "Could not create voice profile.");
        return;
      }
      setProfiles(data.profiles ?? []);
      setName("");
      setExternalVoiceId("");
      setTestMessage("Voice profile created.");
    } catch {
      setTestMessage("Request failed.");
    } finally {
      setBusy(false);
    }
  }

  async function setDefault(id: string) {
    setBusy(true);
    setTestMessage("Updating default...");
    try {
      const response = await fetch(`/api/voice-profiles/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isDefault: true })
      });
      const data = (await response.json()) as { ok?: boolean; profiles?: VoiceProfile[] };
      if (!response.ok || !data.ok) {
        setTestMessage("Could not set default.");
        return;
      }
      setProfiles(data.profiles ?? []);
      setTestMessage("Default voice updated.");
    } catch {
      setTestMessage("Request failed.");
    } finally {
      setBusy(false);
    }
  }

  async function runTest(id: string) {
    setBusy(true);
    setTestMessage("Generating test audio...");
    try {
      const response = await fetch(`/api/voice-profiles/${id}/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: "This is a quick test for your viral machine voice profile."
        })
      });
      const data = (await response.json()) as { ok?: boolean; error?: string; url?: string };
      if (!response.ok || !data.ok || !data.url) {
        setTestMessage(data.error ?? "Test generation failed.");
        return;
      }
      setTestMessage(`Test generated: ${data.url}`);
    } catch {
      setTestMessage("Request failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="card">
        <h2>Add ElevenLabs Voice</h2>
        <label htmlFor="voice-name">Display name</label>
        <input
          id="voice-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Founder Voice"
        />
        <label htmlFor="voice-id">ElevenLabs Voice ID</label>
        <input
          id="voice-id"
          value={externalVoiceId}
          onChange={(event) => setExternalVoiceId(event.target.value)}
          placeholder="pNInz6obpgDQGcFmaJgB"
        />
        <button type="button" onClick={createProfile} disabled={busy}>
          {busy ? "Saving..." : "Add Voice Profile"}
        </button>
      </div>

      <div className="card">
        <h2>Voice Profiles</h2>
        {profiles.length === 0 ? <p>No voices yet.</p> : null}
        <ul>
          {profiles.map((profile) => (
            <li key={profile.id}>
              <strong>{profile.name}</strong> ({profile.external_voice_id})
              {profile.is_default ? " [default]" : ""}
              <div style={{ display: "inline-flex", gap: 8, marginLeft: 10 }}>
                <button
                  type="button"
                  className="secondary"
                  disabled={busy}
                  onClick={() => void setDefault(profile.id)}
                >
                  Set Default
                </button>
                <button type="button" disabled={busy} onClick={() => void runTest(profile.id)}>
                  Test Voice
                </button>
              </div>
            </li>
          ))}
        </ul>
        <small>{testMessage}</small>
      </div>
    </>
  );
}
