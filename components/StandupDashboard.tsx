"use client";

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

interface StandupAnalysis {
  developer: string;
  repository: string;
  branch: string;
  summary: string;
  yesterday_progress: string[];
  today_focus: string[];
  blockers_and_risks: string[];
  code_review: {
    complexity_score: number;
    code_health: "High" | "Medium" | "Low";
    highlights: string[];
    risks: string[];
    security_or_debt_flags: string[];
  };
}

const HEALTH_STYLES: Record<string, { bg: string; color: string; border: string }> = {
  High: { bg: "var(--green-dim)", color: "var(--green)", border: "rgba(52,211,153,0.25)" },
  Medium: { bg: "var(--amber-dim)", color: "var(--amber)", border: "rgba(251,191,36,0.25)" },
  Low: { bg: "var(--red-dim)", color: "var(--red)", border: "rgba(248,113,113,0.25)" },
};

export default function StandupDashboard({ userId }: { userId?: string }) {
  const [repos, setRepos] = useState<any[]>([]);
  const [selectedRepo, setSelectedRepo] = useState("");
  const [commits, setCommits] = useState<any[]>([]);
  const [selectedShas, setSelectedShas] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchingCommits, setFetchingCommits] = useState(false);
  const [result, setResult] = useState<StandupAnalysis | null>(null);
  const [error, setError] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [selectedModel, setSelectedModel] = useState("gemini");
  const [discordWebhook, setDiscordWebhook] = useState("");
  const [slackWebhook, setSlackWebhook] = useState("");
  const [platforms, setPlatforms] = useState<string[]>([]);

  const modelOptions = [
    { id: "gemini", name: "Gemini (Recommended)" },
    { id: "llama-3.3-70b-versatile", name: "Llama 3.3 70B" },
    { id: "llama-3.1-8b-instant", name: "Llama 3.1 8B" },
  ];

  useEffect(() => {
    const savedToken = localStorage.getItem("github_token");
    if (savedToken) {
      setToken(savedToken);
      fetchRepos(savedToken);
    }
    setCheckingAuth(false);
  }, []);

  const fetchRepos = async (authToken: string) => {
    try {
      const res = await fetch("/api/github-all-repos", {
        headers: { "x-github-token": authToken },
      });
      const data = await res.json();
      if (data.success) setRepos(data.repos);
      else setError(data.error || "Failed to load repositories.");
    } catch {
      setError("Failed to load repositories.");
    }
  };

  const handleRepoChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const fullRepo = e.target.value;
    setSelectedRepo(fullRepo);
    setSelectedShas([]);
    setCommits([]);
    setResult(null);

    if (fullRepo && token) {
      const [owner, repo] = fullRepo.split("/");
      setFetchingCommits(true);
      try {
        const res = await fetch(`/api/commits?owner=${owner}&repo=${repo}`, {
          headers: { "x-github-token": token },
        });
        const data = await res.json();
        if (data.success) setCommits(data.commits);
      } catch {
        setError("Failed to fetch commits.");
      } finally {
        setFetchingCommits(false);
      }
    }
  };

  const toggleSha = (sha: string) => {
    setSelectedShas((prev) =>
      prev.includes(sha) ? prev.filter((s) => s !== sha) : [...prev, sha]
    );
  };

  const selectLast24Hours = () => {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    setSelectedShas(commits.filter((c) => new Date(c.date) > yesterday).map((c) => c.sha));
  };

  const selectAllCommits = () => setSelectedShas(commits.map((c) => c.sha));

  const togglePlatform = (p: string) => {
    setPlatforms((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));
  };

  const generateStandup = async () => {
    if (!selectedRepo || !token || selectedShas.length === 0) return;
    setLoading(true);
    setError("");
    setResult(null);

    const [owner, repo] = selectedRepo.split("/");

    try {
      const res = await fetch("/api/standup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-github-token": token,
        },
        body: JSON.stringify({
          owner,
          repo,
          branch: "main",
          commitShas: selectedShas,
          userId,
          model: selectedModel,
          platforms,
          discordWebhook: discordWebhook || undefined,
          slackWebhook: slackWebhook || undefined,
        }),
      });

      const data = await res.json();
      if (data.success && data.analysis) {
        setResult(data.analysis);
        const delivered = Object.entries(data.webhooks || {})
          .filter(([_, v]) => v)
          .map(([k]) => k);
        if (delivered.length > 0) {
          toast.success(`Delivered to: ${delivered.join(", ")}`);
        }
        toast.success("Standup generated!");
      } else if (data.warning) {
        toast.warning(data.warning);
      } else {
        setError(data.error || "Something went wrong.");
      }
    } catch {
      setError("Connection failed.");
    } finally {
      setLoading(false);
    }
  };

  const todayLabel = useMemo(() => {
    return new Date().toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }, []);

  if (checkingAuth) {
    return (
      <div className="review-page">
        <div className="panel-label">Checking authentication...</div>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="review-page">
        <div className="summary-panel">
          <div className="panel-label">GitHub token required</div>
          <p className="panel-subtle">Set your Personal Access Token to load repositories.</p>
          <div className="summary-actions">
            <a className="btn-primary" href="/settings">Open Settings</a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="review-page">
      <div className="review-header">
        <div>
          <h1 className="review-title">Auto Standup</h1>
          <p className="review-date">{todayLabel}</p>
        </div>
        <div className="review-stats">
          <div className="stat-chip">
            <span className="stat-number">{commits.length}</span>
            <span className="stat-label">commits</span>
          </div>
          <div className="stat-chip">
            <span className="stat-number">{selectedShas.length}</span>
            <span className="stat-label green">selected</span>
          </div>
        </div>
      </div>

      <div className="review-body">
        <section className="commits-panel">
          <div className="panel-label">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="4" /><line x1="1.05" y1="12" x2="7" y2="12" /><line x1="17.01" y1="12" x2="22.96" y2="12" /></svg>
            GitHub activity
          </div>

          <div className="panel-controls">
            <div className="control-row">
              <label className="control-label">AI model</label>
              <select value={selectedModel} onChange={(e) => setSelectedModel(e.target.value)} className="control-select">
                {modelOptions.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>

            <div className="control-row">
              <label className="control-label">Repository</label>
              <select value={selectedRepo} onChange={handleRepoChange} className="control-select">
                <option value="">Choose a repo...</option>
                {repos.map((r) => (
                  <option key={`${r.owner}/${r.name}`} value={`${r.owner}/${r.name}`}>
                    {r.owner}/{r.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="control-actions">
              <button onClick={selectLast24Hours} className="control-action" disabled={!commits.length}>
                Past 24 hours
              </button>
              <button onClick={selectAllCommits} className="control-action" disabled={!commits.length}>
                All commits
              </button>
            </div>
          </div>

          <div className="commits-list">
            {fetchingCommits ? (
              <div className="panel-subtle">Fetching commits...</div>
            ) : commits.length > 0 ? (
              commits.map((c) => (
                <div key={c.sha} className="commit-card" onClick={() => toggleSha(c.sha)}>
                  <input className="commit-check" type="checkbox" checked={selectedShas.includes(c.sha)} onChange={() => toggleSha(c.sha)} onClick={(e) => e.stopPropagation()} />
                  <div className="commit-body">
                    <div className="commit-top">
                      <span className="commit-repo">{selectedRepo}</span>
                      <span className="commit-time">{new Date(c.date).toLocaleTimeString()}</span>
                    </div>
                    <p className="commit-message">{c.message}</p>
                    <div className="commit-meta">
                      <span className="commit-sha">{c.sha.slice(0, 7)}</span>
                      <span className="panel-subtle">{c.author}</span>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="panel-subtle">No commits found.</div>
            )}
          </div>

          {error && <div className="alert-banner">{error}</div>}

          <div className="panel-controls" style={{ marginTop: "1rem", borderTop: "1px solid var(--border)", paddingTop: "1rem" }}>
            <div className="control-row">
              <label className="control-label">Deliver to</label>
              <div className="control-actions">
                {["discord", "slack", "trello", "jira"].map((p) => (
                  <button
                    key={p}
                    className={`control-action ${platforms.includes(p) ? "active" : ""}`}
                    onClick={() => togglePlatform(p)}
                    style={platforms.includes(p) ? { color: "var(--accent)", borderBottom: "1px solid var(--accent)" } : undefined}
                  >
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <div className="control-row">
              <label className="control-label">Discord Webhook (override)</label>
              <input type="text" value={discordWebhook} onChange={(e) => setDiscordWebhook(e.target.value)} placeholder="https://discord.com/api/webhooks/..." className="control-select" />
            </div>
            <div className="control-row">
              <label className="control-label">Slack Webhook (override)</label>
              <input type="text" value={slackWebhook} onChange={(e) => setSlackWebhook(e.target.value)} placeholder="https://hooks.slack.com/services/..." className="control-select" />
            </div>
          </div>

          <div className="summary-actions" style={{ marginTop: "0.75rem" }}>
            <button className="btn-primary" onClick={generateStandup} disabled={loading || selectedShas.length === 0}>
              {loading ? <span className="spinner" /> : null}
              {loading ? "Generating..." : `Generate (${selectedShas.length})`}
            </button>
          </div>
        </section>

        <section className="summary-panel">
          <div className="panel-label">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 2a10 10 0 1 0 10 10" /><path d="M22 2L11 13" /><path d="M15 2h7v7" /></svg>
            AI standup summary
            <span className="ai-badge">2-prompt pipeline</span>
          </div>

          {!result && !loading && (
            <div className="review-empty-state">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" style={{ opacity: 0.2 }}><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" /></svg>
              <p>Select commits and generate a standup</p>
              <span>AI will analyze commits and deliver to your platforms</span>
            </div>
          )}

          {loading && (
            <div className="review-loading-state">
              <div className="review-loading-pulse" />
              <span className="spinner" />
              <p>Running 2-prompt analysis pipeline...</p>
            </div>
          )}

          {result && (
            <div className="review-result">
              <div className="review-result-header">
                <div className="review-result-badges">
                  <div className="review-risk-badge" style={{ background: HEALTH_STYLES[result.code_review.code_health]?.bg, color: HEALTH_STYLES[result.code_review.code_health]?.color, borderColor: HEALTH_STYLES[result.code_review.code_health]?.border }}>
                    {result.code_review.code_health.toUpperCase()} HEALTH
                  </div>
                </div>
                <div className="review-result-counts">
                  <span className="review-count-item">{result.code_review.complexity_score}/10 complexity</span>
                  <span className="review-count-sep">|</span>
                  <span className="review-count-item">{result.yesterday_progress.length} done</span>
                  <span className="review-count-sep">|</span>
                  <span className="review-count-item">{result.today_focus.length} planned</span>
                </div>
              </div>

              <div className="review-summary-card">
                <div className="review-summary-card-label">Summary</div>
                <p className="review-summary-text">{result.summary}</p>
              </div>

              {result.yesterday_progress.length > 0 && (
                <div className="review-summary-card">
                  <div className="review-summary-card-label">Yesterday's Progress</div>
                  {result.yesterday_progress.map((item, i) => (
                    <div key={i} style={{ display: "flex", gap: "8px", padding: "4px 0", fontSize: "13px", color: "var(--text-secondary)" }}>
                      <span style={{ color: "var(--green)" }}>✓</span>
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              )}

              {result.today_focus.length > 0 && (
                <div className="review-summary-card">
                  <div className="review-summary-card-label">Today's Focus</div>
                  {result.today_focus.map((item, i) => (
                    <div key={i} style={{ display: "flex", gap: "8px", padding: "4px 0", fontSize: "13px", color: "var(--text-secondary)" }}>
                      <span style={{ color: "var(--accent)" }}>→</span>
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              )}

              {result.blockers_and_risks.length > 0 && (
                <div className="review-blockers-card">
                  <div className="review-blockers-header">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                    Blockers & Risks
                  </div>
                  {result.blockers_and_risks.map((b, i) => (
                    <div key={i} className="review-blocker-item">{b}</div>
                  ))}
                </div>
              )}

              {result.code_review.highlights.length > 0 && (
                <div className="review-summary-card">
                  <div className="review-summary-card-label">Code Review Highlights</div>
                  {result.code_review.highlights.map((item, i) => (
                    <div key={i} style={{ display: "flex", gap: "8px", padding: "4px 0", fontSize: "13px", color: "var(--text-secondary)" }}>
                      <span style={{ color: "var(--accent)" }}>★</span>
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              )}

              {result.code_review.security_or_debt_flags.length > 0 && (
                <div className="review-blockers-card" style={{ background: "var(--amber-dim)", borderColor: "rgba(251,191,36,0.2)" }}>
                  <div className="review-blockers-header" style={{ color: "var(--amber)" }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                    Security & Debt Flags
                  </div>
                  {result.code_review.security_or_debt_flags.map((item, i) => (
                    <div key={i} className="review-blocker-item" style={{ color: "var(--amber)" }}>{item}</div>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
