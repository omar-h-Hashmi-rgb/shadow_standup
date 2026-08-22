"use client";

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

interface CodeReviewFinding {
  severity?: string;
  type?: string;
  title: string;
  description: string;
  file: string;
  line: number;
  suggestion: string;
}

interface CodeReviewResult {
  summary: string;
  riskLevel: "low" | "medium" | "high" | "critical";
  categories: {
    security: { findings: CodeReviewFinding[] };
    codeQuality: { findings: CodeReviewFinding[] };
    performance: { findings: CodeReviewFinding[] };
    bestPractices: { findings: CodeReviewFinding[] };
  };
  approved: boolean;
  blockers: string[];
}

const RISK_STYLES: Record<string, { bg: string; color: string; border: string; icon: string }> = {
  low: { bg: "var(--green-dim)", color: "var(--green)", border: "rgba(52,211,153,0.25)", icon: "LOW" },
  medium: { bg: "var(--amber-dim)", color: "var(--amber)", border: "rgba(251,191,36,0.25)", icon: "MED" },
  high: { bg: "rgba(249,115,22,0.12)", color: "#f97316", border: "rgba(249,115,22,0.25)", icon: "HIGH" },
  critical: { bg: "var(--red-dim)", color: "var(--red)", border: "rgba(248,113,113,0.25)", icon: "CRIT" },
};

const SEVERITY_STYLES: Record<string, { bg: string; color: string; border: string }> = {
  critical: { bg: "var(--red-dim)", color: "var(--red)", border: "rgba(248,113,113,0.2)" },
  high: { bg: "rgba(249,115,22,0.12)", color: "#f97316", border: "rgba(249,115,22,0.2)" },
  medium: { bg: "var(--amber-dim)", color: "var(--amber)", border: "rgba(251,191,36,0.2)" },
  low: { bg: "var(--green-dim)", color: "var(--green)", border: "rgba(52,211,153,0.2)" },
};

const CATEGORY_META: Record<string, { label: string; icon: JSX.Element }> = {
  security: {
    label: "Security",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
  },
  codeQuality: {
    label: "Code Quality",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" />
      </svg>
    ),
  },
  performance: {
    label: "Performance",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
      </svg>
    ),
  },
  bestPractices: {
    label: "Best Practices",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
      </svg>
    ),
  },
};

function renderSuggestionCode(text: string): React.ReactNode {
  const parts = text.split(/(`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={i} className="finding-inline-code">{part.slice(1, -1)}</code>;
    }
    return <span key={i}>{part}</span>;
  });
}

export default function CodeReviewer({ userId }: { userId?: string }) {
  const [repos, setRepos] = useState<any[]>([]);
  const [selectedRepo, setSelectedRepo] = useState("");
  const [commits, setCommits] = useState<any[]>([]);
  const [selectedShas, setSelectedShas] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchingCommits, setFetchingCommits] = useState(false);
  const [result, setResult] = useState<CodeReviewResult | null>(null);
  const [rawResponse, setRawResponse] = useState<string>("");
  const [parseFailed, setParseFailed] = useState(false);
  const [error, setError] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [selectedModel, setSelectedModel] = useState("gemini-2.0-flash");
  const [discordWebhook, setDiscordWebhook] = useState("");
  const [slackWebhook, setSlackWebhook] = useState("");
  const [expandedFinding, setExpandedFinding] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>("all");

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
    setResult(null);
    setParseFailed(false);
    setRawResponse("");

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

  const selectAllCommits = () => {
    setSelectedShas(commits.map((c) => c.sha));
  };

  const generateReview = async () => {
    if (!selectedRepo || !token || selectedShas.length === 0) return;
    setLoading(true);
    setError("");
    setResult(null);
    setParseFailed(false);
    setRawResponse("");

    const [owner, repo] = selectedRepo.split("/");

    try {
      const res = await fetch("/api/code-review", {
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
          discordWebhook: discordWebhook || undefined,
          slackWebhook: slackWebhook || undefined,
        }),
      });

      const data = await res.json();
      if (data.success && data.review) {
        setResult(data.review);
        setParseFailed(data.review.blockers?.includes("AI response could not be parsed as structured JSON."));
        if (data.webhooks?.discord || data.webhooks?.slack) {
          toast.success(`Review sent to ${data.webhooks.discord ? "Discord" : ""}${data.webhooks.discord && data.webhooks.slack ? " & " : ""}${data.webhooks.slack ? "Slack" : ""}`);
        }
        toast.success(`Review complete: ${data.findingsCount} finding(s)`);
      } else if (data.success && data.rawResponse) {
        setRawResponse(data.rawResponse);
        setParseFailed(true);
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

  const allFindings = useMemo(() => {
    if (!result) return [];
    const cats = [
      { key: "security", findings: result.categories.security.findings },
      { key: "codeQuality", findings: result.categories.codeQuality.findings },
      { key: "performance", findings: result.categories.performance.findings },
      { key: "bestPractices", findings: result.categories.bestPractices.findings },
    ];
    if (activeCategory === "all") {
      return cats.flatMap((c) => c.findings.map((f) => ({ ...f, _cat: c.key, _id: `${c.key}-${f.title}` })));
    }
    const cat = cats.find((c) => c.key === activeCategory);
    return cat ? cat.findings.map((f) => ({ ...f, _cat: cat.key, _id: `${cat.key}-${f.title}` })) : [];
  }, [result, activeCategory]);

  const categoryCounts = useMemo(() => {
    if (!result) return { security: 0, codeQuality: 0, performance: 0, bestPractices: 0 };
    return {
      security: result.categories.security.findings.length,
      codeQuality: result.categories.codeQuality.findings.length,
      performance: result.categories.performance.findings.length,
      bestPractices: result.categories.bestPractices.findings.length,
    };
  }, [result]);

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
          <h1 className="review-title">Code Review</h1>
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
          {result && (
            <>
              <div className="stat-chip" style={{ borderColor: RISK_STYLES[result.riskLevel]?.border }}>
                <span className="stat-number" style={{ color: RISK_STYLES[result.riskLevel]?.color }}>
                  {result.riskLevel.toUpperCase()}
                </span>
                <span className="stat-label">risk</span>
              </div>
              <div className="stat-chip">
                <span className="stat-number">{allFindings.length}</span>
                <span className="stat-label red">findings</span>
              </div>
            </>
          )}
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
                  <input
                    className="commit-check"
                    type="checkbox"
                    checked={selectedShas.includes(c.sha)}
                    onChange={() => toggleSha(c.sha)}
                    onClick={(e) => e.stopPropagation()}
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

          <div className="panel-controls" style={{ marginTop: "1rem", borderTop: "1px solid var(--border)", paddingTop: "1rem" }}>
            <div className="control-row">
              <label className="control-label">Discord Webhook (optional)</label>
              <input
                type="text"
                value={discordWebhook}
                onChange={(e) => setDiscordWebhook(e.target.value)}
                placeholder="https://discord.com/api/webhooks/..."
                className="control-select"
              />
            </div>
            <div className="control-row">
              <label className="control-label">Slack Webhook (optional)</label>
              <input
                type="text"
                value={slackWebhook}
                onChange={(e) => setSlackWebhook(e.target.value)}
                placeholder="https://hooks.slack.com/services/..."
                className="control-select"
              />
            </div>
          </div>

          <div className="summary-actions" style={{ marginTop: "0.75rem" }}>
            <button
              className="btn-primary"
              onClick={generateReview}
              disabled={loading || selectedShas.length === 0}
            >
              {loading ? <span className="spinner" /> : null}
              {loading ? "Reviewing..." : `Review (${selectedShas.length})`}
            </button>
          </div>
        </section>

        <section className="summary-panel">
          <div className="panel-label">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            AI code review
            <span className="ai-badge">structured</span>
          </div>

          {!result && !loading && !parseFailed && (
            <div className="review-empty-state">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.2 }}>
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              <p>Select commits and generate a review</p>
              <span>AI will analyze your code diff for security, quality, performance, and best practices</span>
            </div>
          )}

          {loading && (
            <div className="review-loading-state">
              <div className="review-loading-pulse" />
              <span className="spinner" />
              <p>Analyzing code diff...</p>
            </div>
          )}

          {parseFailed && !result && (
            <div className="review-parse-error">
              <div className="review-parse-error-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              </div>
              <p>AI response could not be parsed as structured JSON.</p>
              <span>Try a different model or fewer commits.</span>
            </div>
          )}

          {result && (
            <div className="review-result">
              {/* Risk + Approval Header */}
              <div className="review-result-header">
                <div className="review-result-badges">
                  <div
                    className="review-risk-badge"
                    style={{
                      background: RISK_STYLES[result.riskLevel]?.bg,
                      color: RISK_STYLES[result.riskLevel]?.color,
                      borderColor: RISK_STYLES[result.riskLevel]?.border,
                    }}
                  >
                    {RISK_STYLES[result.riskLevel]?.icon} RISK
                  </div>
                  <div className={`review-approved-badge ${result.approved ? "approved" : "rejected"}`}>
                    {result.approved ? (
                      <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg> APPROVED</>
                    ) : (
                      <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg> CHANGES REQUESTED</>
                    )}
                  </div>
                </div>
                <div className="review-result-counts">
                  <span className="review-count-item" style={{ color: "var(--red)" }}>{categoryCounts.security} security</span>
                  <span className="review-count-sep">/</span>
                  <span className="review-count-item" style={{ color: "var(--amber)" }}>{categoryCounts.codeQuality} quality</span>
                  <span className="review-count-sep">/</span>
                  <span className="review-count-item" style={{ color: "#f97316" }}>{categoryCounts.performance} perf</span>
                  <span className="review-count-sep">/</span>
                  <span className="review-count-item" style={{ color: "var(--green)" }}>{categoryCounts.bestPractices} practices</span>
                </div>
              </div>

              {/* Summary */}
              <div className="review-summary-card">
                <div className="review-summary-card-label">Summary</div>
                <p className="review-summary-text">{result.summary}</p>
              </div>

              {/* Blockers */}
              {result.blockers.length > 0 && !result.blockers[0].includes("could not be parsed") && (
                <div className="review-blockers-card">
                  <div className="review-blockers-header">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                      <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                    </svg>
                    Blockers
                  </div>
                  {result.blockers.map((b, i) => (
                    <div key={i} className="review-blocker-item">{b}</div>
                  ))}
                </div>
              )}

              {/* Category Tabs */}
              <div className="review-category-tabs">
                {[
                  { key: "all", label: "All", count: allFindings.length, color: "var(--text-secondary)" },
                  { key: "security", label: "Security", count: categoryCounts.security, color: "var(--red)" },
                  { key: "codeQuality", label: "Quality", count: categoryCounts.codeQuality, color: "var(--amber)" },
                  { key: "performance", label: "Perf", count: categoryCounts.performance, color: "#f97316" },
                  { key: "bestPractices", label: "Practices", count: categoryCounts.bestPractices, color: "var(--green)" },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    className={`review-tab ${activeCategory === tab.key ? "active" : ""}`}
                    onClick={() => setActiveCategory(tab.key)}
                    style={activeCategory === tab.key ? { borderColor: tab.color, color: tab.color } : undefined}
                  >
                    {tab.label}
                    <span
                      className="review-tab-count"
                      style={activeCategory === tab.key ? { background: tab.color, color: "#fff" } : undefined}
                    >
                      {tab.count}
                    </span>
                  </button>
                ))}
              </div>

              {/* Findings List */}
              <div className="review-findings">
                {allFindings.length === 0 ? (
                  <div className="review-no-findings">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ opacity: 0.3 }}>
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
                    </svg>
                    <p>No findings in this category.</p>
                  </div>
                ) : (
                  allFindings.map((finding, i) => {
                    const isExpanded = expandedFinding === finding._id;
                    const sevKey = finding.severity || finding.type || "medium";
                    const sevStyle = SEVERITY_STYLES[sevKey] || SEVERITY_STYLES.medium;
                    const catMeta = CATEGORY_META[finding._cat];

                    return (
                      <div
                        key={finding._id}
                        className={`review-finding ${isExpanded ? "expanded" : ""}`}
                      >
                        {/* Collapsed Header */}
                        <button
                          className="finding-header"
                          onClick={() => setExpandedFinding(isExpanded ? null : finding._id)}
                        >
                          <div className="finding-left">
                            <span
                              className="finding-severity"
                              style={{ background: sevStyle.bg, color: sevStyle.color, borderColor: sevStyle.border }}
                            >
                              {sevKey.toUpperCase()}
                            </span>
                            <div className="finding-title-col">
                              <span className="finding-title">{finding.title}</span>
                              <span className="finding-file-path">{finding.file}:{finding.line}</span>
                            </div>
                          </div>
                          <div className="finding-right">
                            <span className="finding-category-tag" style={{ color: catMeta?.label === "Security" ? "var(--red)" : undefined }}>
                              {catMeta?.icon} {catMeta?.label}
                            </span>
                            <svg
                              className={`finding-chevron ${isExpanded ? "rotated" : ""}`}
                              width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                            >
                              <polyline points="6 9 12 15 18 9" />
                            </svg>
                          </div>
                        </button>

                        {/* Expanded Detail */}
                        {isExpanded && (
                          <div className="finding-detail">
                            <div className="finding-detail-section">
                              <div className="finding-detail-label">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>
                                Description
                              </div>
                              <p className="finding-detail-text">{finding.description}</p>
                            </div>
                            <div className="finding-detail-section">
                              <div className="finding-detail-label">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" /></svg>
                                Suggestion
                              </div>
                              <div className="finding-suggestion-card">
                                <pre className="finding-suggestion-code">{finding.suggestion}</pre>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
