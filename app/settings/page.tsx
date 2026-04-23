"use client";

import React, { useState } from "react";
import { Save } from "lucide-react";
import { toast } from "sonner";

export default function SettingsPage() {
  const [githubToken, setGithubToken] = useState('');

  React.useEffect(() => {
    const savedToken = localStorage.getItem("github_token");
    if (savedToken) setGithubToken(savedToken);
  }, []);

  const handleSave = () => {
    localStorage.setItem("github_token", githubToken);
    toast.success("Preferences saved successfully");
  };

  return (
    <div className="settings-page">
      <div className="settings-card">
        <div className="settings-section">
          <div className="settings-section-title">GitHub Configuration</div>
          <div className="settings-field">
            <label className="settings-label">Personal Access Token (Fallback)</label>
            <input
              type="password"
              value={githubToken}
              onChange={(e) => setGithubToken(e.target.value)}
              placeholder="ghp_xxxxxxxxxxxx"
              className="settings-input"
            />
            <p className="settings-note">
              Ensures the app works even if the Supabase session token expires.
            </p>
          </div>
        </div>

        <div className="settings-section">
          <div className="settings-section-title">Notifications & Delivery</div>
          <div className="settings-field">
            <label className="settings-label">Preferred Generation Time</label>
            <select className="settings-select">
              <option>5:00 PM</option>
              <option>6:00 PM</option>
              <option>9:00 AM</option>
            </select>
          </div>
          <div className="settings-field">
            <label className="settings-label">Slack Webhook URL</label>
            <input
              type="text"
              placeholder="https://hooks.slack.com/..."
              className="settings-input"
            />
          </div>
        </div>

        <div className="settings-actions">
          <p className="settings-note">Changes are saved to your local profile.</p>
          <button onClick={handleSave} className="btn-primary">
            <Save size={16} />
            Save Preferences
          </button>
        </div>
      </div>
    </div>
  );
}
