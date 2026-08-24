"use client";

import React, { useEffect, useState } from "react";
import { Save, ExternalLink, ChevronDown, ChevronUp, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

interface UserSettings {
  discord_webhook_url: string;
  slack_webhook_url: string;
  jira_domain: string;
  jira_email: string;
  jira_api_token: string;
  jira_project_key: string;
  trello_api_key: string;
  trello_token: string;
  trello_list_id: string;
}

const DEFAULTS: UserSettings = {
  discord_webhook_url: "",
  slack_webhook_url: "",
  jira_domain: "",
  jira_email: "",
  jira_api_token: "",
  jira_project_key: "",
  trello_api_key: "",
  trello_token: "",
  trello_list_id: "",
};

function GuideStep({ step, children }: { step: number; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", gap: "10px", padding: "6px 0", fontSize: "13px", color: "var(--text-secondary)" }}>
      <span style={{ color: "var(--accent)", fontWeight: 600, minWidth: "18px" }}>{step}.</span>
      <span>{children}</span>
    </div>
  );
}

function SetupGuide({ title, steps, link }: { title: string; steps: string[]; link: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ marginTop: "8px", border: "1px solid var(--border)", borderRadius: "8px", overflow: "hidden" }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 14px",
          background: "var(--bg-elevated)",
          border: "none",
          color: "var(--text-secondary)",
          cursor: "pointer",
          fontSize: "12px",
          fontFamily: "var(--font-mono)",
        }}
      >
        <span>{title}</span>
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>
      {open && (
        <div style={{ padding: "12px 14px", background: "var(--bg-surface)" }}>
          {steps.map((s, i) => (
            <GuideStep key={i} step={i + 1}>{s}</GuideStep>
          ))}
          <a
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
              marginTop: "8px",
              fontSize: "12px",
              color: "var(--accent)",
              textDecoration: "none",
            }}
          >
            Open {title} <ExternalLink size={12} />
          </a>
        </div>
      )}
    </div>
  );
}

function PlatformSection({
  title,
  icon,
  color,
  fields,
  values,
  onChange,
  guide,
}: {
  title: string;
  icon: string;
  color: string;
  fields: { key: keyof UserSettings; label: string; type: string; placeholder: string }[];
  values: UserSettings;
  onChange: (key: keyof UserSettings, val: string) => void;
  guide: { title: string; steps: string[]; link: string };
}) {
  const filledCount = fields.filter((f) => values[f.key].trim() !== "").length;
  const isComplete = filledCount === fields.length;

  return (
    <div className="settings-section">
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <span style={{ fontSize: "20px" }}>{icon}</span>
        <div className="settings-section-title" style={{ margin: 0 }}>{title}</div>
        {isComplete && <CheckCircle2 size={16} style={{ color: "var(--green)" }} />}
        <span style={{
          marginLeft: "auto",
          fontSize: "11px",
          padding: "2px 8px",
          borderRadius: "10px",
          background: isComplete ? "var(--green-dim, rgba(52,211,153,0.1))" : "var(--amber-dim, rgba(251,191,36,0.1))",
          color: isComplete ? "var(--green)" : "var(--amber)",
          border: `1px solid ${isComplete ? "rgba(52,211,153,0.3)" : "rgba(251,191,36,0.3)"}`,
        }}>
          {filledCount}/{fields.length}
        </span>
      </div>
      {fields.map((f) => (
        <div className="settings-field" key={f.key}>
          <label className="settings-label">{f.label}</label>
          <input
            type={f.type}
            value={values[f.key]}
            onChange={(e) => onChange(f.key, e.target.value)}
            placeholder={f.placeholder}
            className="settings-input"
          />
        </div>
      ))}
      <SetupGuide {...guide} />
    </div>
  );
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<UserSettings>(DEFAULTS);
  const [githubToken, setGithubToken] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const savedToken = localStorage.getItem("github_token");
    if (savedToken) setGithubToken(savedToken);

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setUserId(session.user.id);
        loadSettings(session.user.id);
      } else {
        setLoading(false);
      }
    });
  }, []);

  const loadSettings = async (uid: string) => {
    try {
      const res = await fetch(`/api/settings?userId=${uid}`);
      const data = await res.json();
      if (data.success && data.settings) {
        setSettings(data.settings);
      }
    } catch (e) {
      console.error("Failed to load settings:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (key: keyof UserSettings, val: string) => {
    setSettings((prev) => ({ ...prev, [key]: val }));
  };

  const handleSave = async () => {
    localStorage.setItem("github_token", githubToken);
    if (userId) {
      setSaving(true);
      try {
        const res = await fetch("/api/settings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId, settings }),
        });
        const data = await res.json();
        if (data.success) {
          toast.success("Settings saved to your profile");
        } else {
          toast.error(data.error || "Failed to save");
        }
      } catch {
        toast.error("Failed to save settings");
      } finally {
        setSaving(false);
      }
    } else {
      toast.success("GitHub token saved locally");
    }
  };

  if (loading) {
    return <div className="settings-page"><div className="settings-card"><p className="settings-note">Loading...</p></div></div>;
  }

  return (
    <div className="settings-page">
      <div className="settings-card">
        <div style={{ marginBottom: "24px" }}>
          <h2 style={{ fontSize: "18px", fontWeight: 600, margin: "0 0 4px" }}>Integration Settings</h2>
          <p style={{ fontSize: "13px", color: "var(--text-secondary)", margin: 0 }}>
            Configure your platform credentials. Keep API tokens private.
          </p>
        </div>

        <div className="settings-section">
          <div className="settings-section-title">GitHub</div>
          <div className="settings-field">
            <label className="settings-label">Personal Access Token</label>
            <input
              type="password"
              value={githubToken}
              onChange={(e) => setGithubToken(e.target.value)}
              placeholder="ghp_xxxxxxxxxxxx"
              className="settings-input"
            />
            <p className="settings-note">Fallback token if Supabase session expires.</p>
          </div>
        </div>

        <PlatformSection
          title="Discord"
          icon="💬"
          color="#5865F2"
          values={settings}
          onChange={handleChange}
          fields={[
            { key: "discord_webhook_url", label: "Webhook URL", type: "text", placeholder: "https://discord.com/api/webhooks/..." },
          ]}
          guide={{
            title: "How to get your Discord Webhook URL",
            steps: [
              "Open Discord and go to your target server and channel.",
              "Click the gear icon (Edit Channel) next to the channel name.",
              'Select "Integrations" from the left sidebar and click "Webhooks".',
              'Click "New Webhook", name it "Shadow Standup Bot", and click "Copy Webhook URL".',
              "Paste the URL above.",
            ],
            link: "https://discord.com/app",
          }}
        />

        <PlatformSection
          title="Slack"
          icon="#"
          color="#4A154B"
          values={settings}
          onChange={handleChange}
          fields={[
            { key: "slack_webhook_url", label: "Incoming Webhook URL", type: "text", placeholder: "https://hooks.slack.com/services/..." },
          ]}
          guide={{
            title: "How to get your Slack Webhook URL",
            steps: [
              'Go to api.slack.com/apps and click "Create New App" -> "From scratch".',
              'Name it "Shadow Standup", select your workspace, and click "Create App".',
              'Click "Incoming Webhooks" under Features on the left.',
              'Toggle "Activate Incoming Webhooks" to ON.',
              'Click "Add New Webhook to Workspace", select your channel, and click "Allow".',
              "Copy the generated Webhook URL and paste it above.",
            ],
            link: "https://api.slack.com/apps",
          }}
        />

        <PlatformSection
          title="Jira"
          icon="🎫"
          color="#0052CC"
          values={settings}
          onChange={handleChange}
          fields={[
            { key: "jira_domain", label: "Workspace Domain", type: "text", placeholder: "https://yourdomain.atlassian.net" },
            { key: "jira_email", label: "Account Email", type: "email", placeholder: "you@example.com" },
            { key: "jira_api_token", label: "API Token", type: "password", placeholder: "Your Jira API token" },
            { key: "jira_project_key", label: "Project Key", type: "text", placeholder: "e.g. KAN" },
          ]}
          guide={{
            title: "How to get your Jira credentials",
            steps: [
              "Copy your Jira site URL from the browser address bar (e.g. https://yourdomain.atlassian.net).",
              "Go to id.atlassian.net/manage-profile/security/api-tokens.",
              'Click "Create API token", label it "shadow-standup-key", and click "Create".',
              "Copy the API token string.",
              "Open your Jira project board and copy the Project Key from the URL (e.g. /projects/KAN/ -> Key is KAN).",
              "Paste all values above.",
            ],
            link: "https://id.atlassian.net/manage-profile/security/api-tokens",
          }}
        />

        <PlatformSection
          title="Trello"
          icon="📋"
          color="#0079BF"
          values={settings}
          onChange={handleChange}
          fields={[
            { key: "trello_api_key", label: "API Key", type: "password", placeholder: "Your Trello API Key" },
            { key: "trello_token", label: "User Token", type: "password", placeholder: "Your Trello User Token" },
            { key: "trello_list_id", label: "Target List ID", type: "text", placeholder: "The list ID for standup reports" },
          ]}
          guide={{
            title: "How to get your Trello credentials",
            steps: [
              'Log into Trello, open your workspace, and create a board named "Daily Standups".',
              'Add a list column named "Standup Reports".',
              'Go to trello.com/power-ups/admin, click "New", fill in app name "Shadow Standup", select workspace, set https://example.com as Iframe URL, and click "Save".',
              'Click "API Key" on the left, click "Generate a new API Key", and copy it.',
              'Click the blue "Token" link next to the API Key, click "Allow", and copy your User Token.',
              'Append .json to your board URL (e.g. trello.com/b/boardID/daily-standups.json), search for "lists":, and copy the "id" of your "Standup Reports" list.',
              "Paste the API Key, User Token, and List ID above.",
            ],
            link: "https://trello.com/power-ups/admin",
          }}
        />

        <div className="settings-actions">
          <p className="settings-note">
            {userId ? "Settings saved to your Supabase profile." : "GitHub token saved to browser localStorage."}
          </p>
          <button onClick={handleSave} className="btn-primary" disabled={saving}>
            <Save size={16} />
            {saving ? "Saving..." : "Save All Settings"}
          </button>
        </div>
      </div>
    </div>
  );
}
