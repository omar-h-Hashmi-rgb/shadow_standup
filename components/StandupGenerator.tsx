"use client";

import React, { useEffect, useMemo, useState } from "react";

export default function StandupGenerator({
  onGenerated,
  userId,
}: {
  onGenerated?: () => void;
  userId?: string;
}) {
  const [repos, setRepos] = useState<any[]>([]);
  const [selectedRepo, setSelectedRepo] = useState<string>("");
  const [commits, setCommits] = useState<any[]>([]);
  const [selectedShas, setSelectedShas] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchingCommits, setFetchingCommits] = useState(false);
  const [result, setResult] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [token, setToken] = useState<string | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [selectedModel, setSelectedModel] = useState<string>("gemini-2.0-flash");

  const modelOptions = [
    { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash", provider: "google" },
    { id: "llama-3.3-70b-versatile", name: "Llama 3.3 70B", provider: "groq" },
    { id: "llama-3.1-8b-instant", name: "Llama 3.1 8B", provider: "groq" },
    { id: "openai/gpt-oss-120b", name: "GPT OSS 120B", provider: "groq" },
    { id: "qwen/qwen3-32b", name: "Qwen 3 32B", provider: "groq" },
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
      if (data.success) {
        setRepos(data.repos);
      } else {
        setError(data.error || "Failed to load repositories.");
      }
    } catch {
      setError("Failed to load repositories.");
    }
  };

  const handleRepoChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const fullRepo = e.target.value;
    setSelectedRepo(fullRepo);
    setSelectedShas([]);
    setCommits([]);

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
    const shas = commits
      .filter((c) => new Date(c.date) > yesterday)
      .map((c) => c.sha);
    setSelectedShas(shas);
  };

  const generateStandup = async () => {
    if (!selectedRepo || !token) return;
    setLoading(true);
    setError("");

    const [owner, repo] = selectedRepo.split("/");

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-github-token": token,
        },
        body: JSON.stringify({
          owner,
          repo,
          commitShas: selectedShas,
          userId,
          model: selectedModel,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setResult(data.summary);
        if (onGenerated) onGenerated();
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

  const commitCount = commits.length;
  const selectedCount = selectedShas.length;

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
          <h1 className="review-title">Today's Stand-up</h1>
          <p className="review-date">{todayLabel}</p>
        </div>
        <div className="review-stats">
          <div className="stat-chip">
            <span className="stat-number">{commitCount}</span>
            <span className="stat-label">commits</span>
          </div>
          <div className="stat-chip">
            <span className="stat-number">{selectedCount}</span>
            <span className="stat-label green">selected</span>
          </div>
          <div className="stat-chip">
            <span className="stat-number">0</span>
            <span className="stat-label red">- lines</span>
          </div>
        </div>
      </div>

      <div className="review-body">
        <section className="commits-panel">
          <div className="panel-label">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="4" />
              <line x1="1.05" y1="12" x2="7" y2="12" />
              <line x1="17.01" y1="12" x2="22.96" y2="12" />
            </svg>
            GitHub activity
          </div>

          <div className="panel-controls">
            <div className="control-row">
              <label className="control-label">AI model</label>
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="control-select"
              >
                {modelOptions.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="control-row">
              <label className="control-label">Repository</label>
              <select
                value={selectedRepo}
                onChange={handleRepoChange}
                className="control-select"
              >
                <option value="">Choose a repo...</option>
                {repos.map((r) => (
                  <option key={`${r.owner}/${r.name}`} value={`${r.owner}/${r.name}`}>
                    {r.owner}/{r.name}
                  </option>
                ))}
              </select>
            </div>

            <button onClick={selectLast24Hours} className="control-action">
              Select last 24 hours
            </button>
          </div>

          <div className="commits-list">
            {fetchingCommits ? (
              <div className="panel-subtle">Fetching commits...</div>
            ) : commits.length > 0 ? (
              commits.map((c) => (
                <div key={c.sha} className="commit-card" onClick={() => toggleSha(c.sha)}>
                  <input
                    className="commit-check"
                    type="checkbox"
                    checked={selectedShas.includes(c.sha)}
                    onChange={() => toggleSha(c.sha)}
                  />
                  <div className="commit-body">
                    <div className="commit-top">
                      <span className="commit-repo">{selectedRepo || "repo"}</span>
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
        </section>

        <section className="summary-panel">
          <div className="panel-label">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a10 10 0 1 0 10 10" />
              <path d="M22 2L11 13" />
              <path d="M15 2h7v7" />
            </svg>
            AI summary
            <span className="ai-badge">editable</span>
          </div>

          <textarea
            className="summary-textarea"
            value={result}
            onChange={(e) => setResult(e.target.value)}
            placeholder="AI summary will appear here..."
          />

          <div className="summary-actions">
            <button
              className="btn-primary"
              onClick={generateStandup}
              disabled={loading || selectedShas.length === 0}
            >
              {loading ? <span className="spinner" /> : null}
              {loading ? "Generating..." : `Generate (${selectedShas.length})`}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
