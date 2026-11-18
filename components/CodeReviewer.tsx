"use client";

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-client";
import CodeViewer, { type LineRange } from "@/components/CodeViewer";

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
  meta?: {
    scope: ReviewScope;
    label: string;
    truncated?: boolean;
    droppedOutOfRange?: number;
    notes?: string[];
    filesReviewed?: number;
  };
}

type ReviewScope = "commits" | "repo" | "file" | "selection" | "lines";

const SCOPES: { id: ReviewScope; label: string; hint: string; needsGithub: boolean }[] = [
  { id: "commits", label: "Commits", hint: "Review the diff of selected commits", needsGithub: true },
  { id: "file", label: "File", hint: "Review an entire file", needsGithub: true },
  { id: "selection", label: "Selection", hint: "Review code you highlight or paste", needsGithub: false },
  { id: "lines", label: "Lines", hint: "Review a specific line or range", needsGithub: true },
  { id: "repo", label: "Codebase", hint: "Review the repository's source files", needsGithub: true },
];

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

const CATEGORY_META: Record<string, { label: string; icon: React.ReactElement }> = {
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

export default function CodeReviewer({ userId: _userId }: { userId?: string }) {
  const [repos, setRepos] = useState<any[]>([]);
  const [selectedRepo, setSelectedRepo] = useState("");
  const [commits, setCommits] = useState<any[]>([]);
  const [selectedShas, setSelectedShas] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchingCommits, setFetchingCommits] = useState(false);
  const [result, setResult] = useState<CodeReviewResult | null>(null);
  const [parseFailed, setParseFailed] = useState(false);
  const [error, setError] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [selectedModel, setSelectedModel] = useState("gemini-3.8-flash");
  const [discordWebhook, setDiscordWebhook] = useState("");
  const [slackWebhook, setSlackWebhook] = useState("");
  const [notifyTeams, setNotifyTeams] = useState(false);
  const [teamsConfigured, setTeamsConfigured] = useState<boolean | null>(null);
  const [expandedFinding, setExpandedFinding] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>("all");

  // Scope + source state
  const [scope, setScope] = useState<ReviewScope>("commits");
  const [files, setFiles] = useState<{ path: string; size: number }[]>([]);
  const [treeTruncated, setTreeTruncated] = useState(false);
  const [loadingTree, setLoadingTree] = useState(false);
  const [fileQuery, setFileQuery] = useState("");
  const [selectedPath, setSelectedPath] = useState("");
  const [fileLines, setFileLines] = useState<string[]>([]);
  const [loadingFile, setLoadingFile] = useState(false);
  const [range, setRange] = useState<LineRange>(null);
  const [pasteMode, setPasteMode] = useState(false);
  const [snippet, setSnippet] = useState("");
  const [snippetName, setSnippetName] = useState("");
  const [snippetStart, setSnippetStart] = useState("1");
  const [pathPrefix, setPathPrefix] = useState("");

  const modelOptions = [
    { id: "gemini-3.8-flash", name: "Gemini 3.8 Flash", provider: "google" },
    { id: "openai/gpt-oss-120b", name: "GPT OSS 120B", provider: "groq" },
    { id: "qwen/qwen3.8-27b", name: "Qwen 3.8 27B", provider: "groq" },
  ];

  useEffect(() => {
    const savedToken = localStorage.getItem("github_token");
    if (savedToken) {
      setToken(savedToken);
      fetchRepos(savedToken);
    } else {
      // No GitHub token: pasted snippets still work.
      setScope("selection");
      setPasteMode(true);
    }
    setCheckingAuth(false);

    apiFetch("/api/integrations/status")
      .then((r) => r.json())
      .then((d) => setTeamsConfigured(d.success ? !!d.teams?.configured : false))
      .catch(() => setTeamsConfigured(false));
  }, []);

  const [owner, repoName] = selectedRepo.split("/");

  const fetchRepos = async (authToken: string) => {
    try {
      const res = await apiFetch("/api/github-all-repos", {
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

  const resetSource = () => {
    setFiles([]);
    setSelectedPath("");
    setFileLines([]);
    setRange(null);
    setFileQuery("");
    setTreeTruncated(false);
  };

  const handleRepoChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const fullRepo = e.target.value;
    setSelectedRepo(fullRepo);
    setSelectedShas([]);
    setCommits([]);
    setResult(null);
    setParseFailed(false);
    resetSource();

    if (fullRepo && token) {
      const [o, r] = fullRepo.split("/");
      setFetchingCommits(true);
      try {
        const res = await apiFetch(`/api/commits?owner=${encodeURIComponent(o)}&repo=${encodeURIComponent(r)}`, {
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

  // Load the repo's file list the first time a file-based scope needs it.
  const needsFiles = scope === "file" || scope === "lines" || (scope === "selection" && !pasteMode);
  useEffect(() => {
    if (!needsFiles || !selectedRepo || !token || files.length > 0) return;
    let cancelled = false;
    const [o, r] = selectedRepo.split("/");
    setLoadingTree(true);
    apiFetch(`/api/github-tree?owner=${encodeURIComponent(o)}&repo=${encodeURIComponent(r)}`, {
      headers: { "x-github-token": token },
    })
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (data.success) {
          setFiles(data.files);
          setTreeTruncated(!!data.truncated);
        } else {
          setError(data.error || "Failed to load files.");
        }
      })
      .catch(() => !cancelled && setError("Failed to load files."))
      .finally(() => !cancelled && setLoadingTree(false));
    return () => {
      cancelled = true;
    };
  }, [needsFiles, selectedRepo, token, files.length]);

  const selectFile = async (path: string) => {
    if (!token || !selectedRepo) return;
    setSelectedPath(path);
    setRange(null);
    setFileLines([]);
    setError("");
    setLoadingFile(true);
    try {
      const res = await apiFetch(
        `/api/github-file?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repoName)}&path=${encodeURIComponent(path)}`,
        { headers: { "x-github-token": token } }
      );
      const data = await res.json();
      if (data.success) {
        setFileLines(String(data.content).replace(/\r\n?/g, "\n").replace(/\n$/, "").split("\n"));
      } else {
        setSelectedPath("");
        setError(data.error || "Could not load that file.");
      }
    } catch {
      setSelectedPath("");
      setError("Could not load that file.");
    } finally {
      setLoadingFile(false);
    }
  };

  const changeScope = (next: ReviewScope) => {
    setScope(next);
    setError("");
    if (next === "selection" && !token) setPasteMode(true);
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

  const setRangeField = (field: "start" | "end", raw: string) => {
    const n = parseInt(raw, 10);
    if (Number.isNaN(n)) return setRange(null);
    const clamped = Math.max(1, Math.min(fileLines.length || n, n));
    setRange((prev) => {
      const cur = prev ?? { start: clamped, end: clamped };
      return field === "start"
        ? { start: clamped, end: Math.max(cur.end, clamped) }
        : { start: Math.min(cur.start, clamped), end: clamped };
    });
  };

  const snippetLineCount = snippet ? snippet.split("\n").length : 0;

  // Whether the current scope has everything it needs, and why not.
  const readiness = ((): { ready: boolean; label: string } => {
    switch (scope) {
      case "commits":
        return { ready: selectedShas.length > 0, label: `Review (${selectedShas.length})` };
      case "repo":
        return { ready: !!selectedRepo, label: "Review codebase" };
      case "file":
        return { ready: !!selectedRepo && !!selectedPath, label: "Review file" };
      case "lines":
        return { ready: !!selectedPath && !!range, label: range ? `Review ${range.start === range.end ? `line ${range.start}` : `lines ${range.start}–${range.end}`}` : "Review lines" };
      case "selection":
        if (pasteMode) return { ready: snippet.trim().length > 0, label: "Review snippet" };
        return { ready: !!selectedPath && !!range, label: range ? `Review selection (${range.end - range.start + 1} line${range.end === range.start ? "" : "s"})` : "Review selection" };
    }
  })();

  const generateReview = async () => {
    if (!readiness.ready) return;
    setLoading(true);
    setError("");
    setResult(null);
    setParseFailed(false);

    const body: Record<string, unknown> = {
      scope,
      model: selectedModel,
      discordWebhook: discordWebhook || undefined,
      slackWebhook: slackWebhook || undefined,
      notifyTeams: notifyTeams && teamsConfigured ? true : undefined,
    };
    const useSnippet = scope === "selection" && pasteMode;
    if (!useSnippet) {
      body.owner = owner;
      body.repo = repoName;
    }
    if (scope === "commits") body.commitShas = selectedShas;
    if (scope === "repo") body.pathPrefix = pathPrefix.trim() || undefined;
    if (scope === "file" || scope === "lines" || (scope === "selection" && !pasteMode)) body.path = selectedPath;
    if ((scope === "lines" || (scope === "selection" && !pasteMode)) && range) {
      body.lineStart = range.start;
      body.lineEnd = range.end;
    }
    if (useSnippet) {
      body.code = snippet;
      body.filename = snippetName.trim() || undefined;
      body.startLine = parseInt(snippetStart, 10) || 1;
    }

    try {
      const res = await apiFetch("/api/code-review", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { "x-github-token": token } : {}),
        },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (data.success && data.review) {
        setResult(data.review);
        setParseFailed(data.review.blockers?.includes("AI response could not be parsed as structured JSON."));
        const sent = [
          data.webhooks?.discord && "Discord",
          data.webhooks?.slack && "Slack",
          data.webhooks?.teams && "Microsoft Teams",
        ].filter(Boolean);
        if (sent.length) toast.success(`Review sent to ${sent.join(" & ")}`);
        const failed = Object.entries(data.webhooks || {}).filter(([, ok]) => !ok).map(([k]) => k);
        if (failed.length) toast.error(`Could not notify: ${failed.join(", ")}`);
        toast.success(`Review complete: ${data.findingsCount} finding(s)`);
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

  return (
    <div className="review-page">
      <div className="review-header">
        <div>
          <h1 className="review-title">Code Review</h1>
          <p className="review-date">{todayLabel}</p>
        </div>
        <div className="review-stats">
          {scope === "commits" && (
            <>
              <div className="stat-chip">
                <span className="stat-number">{commits.length}</span>
                <span className="stat-label">commits</span>
              </div>
              <div className="stat-chip">
                <span className="stat-number">{selectedShas.length}</span>
                <span className="stat-label green">selected</span>
              </div>
            </>
          )}
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
          <div className="panel-label">Review scope</div>

          <div className="segmented" role="tablist" aria-label="Review scope">
            {SCOPES.map((sc) => {
              const disabled = sc.needsGithub && !token;
              return (
                <button
                  key={sc.id}
                  type="button"
                  role="tab"
                  aria-selected={scope === sc.id}
                  className={`segment${scope === sc.id ? " active" : ""}`}
                  onClick={() => changeScope(sc.id)}
                  disabled={disabled}
                  title={disabled ? "Add a GitHub token in Settings to use this scope" : sc.hint}
                >
                  {sc.label}
                </button>
              );
            })}
          </div>
          <p className="scope-hint">{SCOPES.find((x) => x.id === scope)?.hint}</p>
          {!token && (
            <div className="inline-notice">
              Repository scopes need a GitHub token. <a href="/settings#github">Add one in Settings</a>. Pasted snippets work without it.
            </div>
          )}

          <div className="panel-controls">
            <div className="control-row">
              <label className="control-label" htmlFor="cr-model">AI model</label>
              <select id="cr-model" value={selectedModel} onChange={(e) => setSelectedModel(e.target.value)} className="control-select">
                {modelOptions.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>

            {!(scope === "selection" && pasteMode) && (
              <div className="control-row">
                <label className="control-label" htmlFor="cr-repo">Repository</label>
                <select id="cr-repo" value={selectedRepo} onChange={handleRepoChange} className="control-select" disabled={!token}>
                  <option value="">Choose a repo...</option>
                  {repos.map((r) => (
                    <option key={`${r.owner}/${r.name}`} value={`${r.owner}/${r.name}`}>
                      {r.owner}/{r.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {scope === "commits" && (
              <div className="control-actions">
                <button onClick={selectLast24Hours} className="control-action" disabled={!commits.length}>
                  Past 24 hours
                </button>
                <button onClick={selectAllCommits} className="control-action" disabled={!commits.length}>
                  All commits
                </button>
              </div>
            )}
          </div>

          {/* ---- Commits ---- */}
          {scope === "commits" && (
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
          )}

          {/* ---- Codebase ---- */}
          {scope === "repo" && (
            <div className="panel-controls">
              <div className="control-row">
                <label className="control-label" htmlFor="cr-prefix">Limit to folder (optional)</label>
                <input
                  id="cr-prefix"
                  type="text"
                  value={pathPrefix}
                  onChange={(e) => setPathPrefix(e.target.value)}
                  placeholder="e.g. src/api/"
                  className="control-select"
                  spellCheck={false}
                />
              </div>
              <p className="scope-hint">
                Reviews up to 40 source files per run (about 60k characters). Files that do not fit are listed as not reviewed —
                use a folder to target a specific area.
              </p>
            </div>
          )}

          {/* ---- File / Lines / Selection (from repo) ---- */}
          {scope === "selection" && (
            <div className="segmented small" role="tablist" aria-label="Selection source">
              <button type="button" role="tab" aria-selected={!pasteMode} className={`segment${!pasteMode ? " active" : ""}`} onClick={() => setPasteMode(false)} disabled={!token}>
                From a file
              </button>
              <button type="button" role="tab" aria-selected={pasteMode} className={`segment${pasteMode ? " active" : ""}`} onClick={() => setPasteMode(true)}>
                Paste code
              </button>
            </div>
          )}

          {needsFiles && selectedRepo && (
            <div className="file-picker">
              <input
                type="search"
                value={fileQuery}
                onChange={(e) => setFileQuery(e.target.value)}
                placeholder={loadingTree ? "Loading files..." : `Filter ${files.length} files...`}
                className="control-select"
                aria-label="Filter files"
                spellCheck={false}
              />
              <div className="file-list" role="listbox" aria-label="Files">
                {files
                  .filter((f) => f.path.toLowerCase().includes(fileQuery.toLowerCase()))
                  .slice(0, 200)
                  .map((f) => (
                    <button
                      key={f.path}
                      type="button"
                      role="option"
                      aria-selected={selectedPath === f.path}
                      className={`file-item${selectedPath === f.path ? " active" : ""}`}
                      onClick={() => selectFile(f.path)}
                      title={f.path}
                    >
                      {f.path}
                    </button>
                  ))}
                {!loadingTree && files.length === 0 && <div className="panel-subtle">No files found.</div>}
              </div>
              {treeTruncated && <p className="scope-hint">GitHub truncated this repository's file list.</p>}
            </div>
          )}
          {needsFiles && !selectedRepo && <div className="panel-subtle" style={{ marginTop: 8 }}>Choose a repository to browse files.</div>}

          {needsFiles && selectedPath && (
            <div className="viewer-block">
              <div className="viewer-head">
                <span className="viewer-path" title={selectedPath}>{selectedPath}</span>
                <span className="panel-subtle">{fileLines.length} lines</span>
              </div>

              {(scope === "lines" || scope === "selection") && (
                <div className="range-row">
                  {scope === "lines" ? (
                    <>
                      <label className="control-label" htmlFor="cr-from">From</label>
                      <input id="cr-from" type="number" min={1} max={fileLines.length || undefined} value={range?.start ?? ""} onChange={(e) => setRangeField("start", e.target.value)} className="control-select range-input" />
                      <label className="control-label" htmlFor="cr-to">To</label>
                      <input id="cr-to" type="number" min={1} max={fileLines.length || undefined} value={range?.end ?? ""} onChange={(e) => setRangeField("end", e.target.value)} className="control-select range-input" />
                    </>
                  ) : null}
                  <span className="range-summary">
                    {range
                      ? `Selected: ${range.start === range.end ? `line ${range.start}` : `lines ${range.start}–${range.end}`}`
                      : scope === "selection"
                        ? "Highlight code below to select it"
                        : "Enter a range or click line numbers"}
                  </span>
                  {range && (
                    <button type="button" className="control-action" onClick={() => setRange(null)}>Clear</button>
                  )}
                </div>
              )}

              {loadingFile ? (
                <div className="panel-subtle" style={{ padding: 12 }}>Loading file...</div>
              ) : (
                <CodeViewer
                  lines={fileLines}
                  mode={scope === "selection" ? "select" : scope === "lines" ? "range" : "view"}
                  range={scope === "file" ? null : range}
                  onRangeChange={setRange}
                />
              )}
              {scope === "selection" && <p className="scope-hint">Highlight any code; the selection snaps to whole lines. Click or shift-click line numbers to adjust.</p>}
              {scope === "lines" && <p className="scope-hint">Click a line number, then shift-click another to select a range.</p>}
            </div>
          )}

          {/* ---- Paste snippet ---- */}
          {scope === "selection" && pasteMode && (
            <div className="panel-controls">
              <div className="control-row">
                <label className="control-label" htmlFor="cr-snippet">Code to review</label>
                <textarea
                  id="cr-snippet"
                  value={snippet}
                  onChange={(e) => setSnippet(e.target.value)}
                  placeholder="Paste the code you want reviewed..."
                  className="control-select snippet-input"
                  spellCheck={false}
                  rows={10}
                />
                <span className="panel-subtle">{snippetLineCount} lines · {snippet.length.toLocaleString()} / 60,000 chars</span>
              </div>
              <div className="range-row">
                <label className="control-label" htmlFor="cr-sname">File name</label>
                <input id="cr-sname" type="text" value={snippetName} onChange={(e) => setSnippetName(e.target.value)} placeholder="optional, e.g. utils.ts" className="control-select" maxLength={200} />
                <label className="control-label" htmlFor="cr-sstart">First line #</label>
                <input id="cr-sstart" type="number" min={1} value={snippetStart} onChange={(e) => setSnippetStart(e.target.value)} className="control-select range-input" />
              </div>
            </div>
          )}

          {error && <div className="alert-banner" role="alert">{error}</div>}

          <div className="panel-controls" style={{ marginTop: "1rem", borderTop: "1px solid var(--border)", paddingTop: "1rem" }}>
            <label className="check-row">
              <input
                type="checkbox"
                checked={notifyTeams && teamsConfigured === true}
                onChange={(e) => setNotifyTeams(e.target.checked)}
                disabled={teamsConfigured !== true}
              />
              <span>Also post to Microsoft Teams</span>
              <span className={`status-badge ${teamsConfigured ? "ok" : "warn"}`}>
                {teamsConfigured === null ? "…" : teamsConfigured ? "Configured" : "Not configured"}
              </span>
            </label>
            <div className="control-row">
              <label className="control-label" htmlFor="cr-discord">Discord Webhook (optional)</label>
              <input
                id="cr-discord"
                type="password"
                autoComplete="off"
                value={discordWebhook}
                onChange={(e) => setDiscordWebhook(e.target.value)}
                placeholder="https://discord.com/api/webhooks/..."
                className="control-select"
              />
            </div>
            <div className="control-row">
              <label className="control-label" htmlFor="cr-slack">Slack Webhook (optional)</label>
              <input
                id="cr-slack"
                type="password"
                autoComplete="off"
                value={slackWebhook}
                onChange={(e) => setSlackWebhook(e.target.value)}
                placeholder="https://hooks.slack.com/services/..."
                className="control-select"
              />
            </div>
          </div>

          <div className="summary-actions" style={{ marginTop: "0.75rem" }}>
            <button className="btn-primary" onClick={generateReview} disabled={loading || !readiness.ready}>
              {loading ? <span className="spinner" /> : null}
              {loading ? "Reviewing..." : readiness.label}
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
              <p>Choose what to review</p>
              <span>Commits, a file, a selection, specific lines, or a whole codebase — analysed for security, quality, performance, and best practices</span>
            </div>
          )}

          {loading && (
            <div className="review-loading-state">
              <div className="review-loading-pulse" />
              <span className="spinner" />
              <p>Analyzing code...</p>
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
              <span>Try a different model or a smaller scope.</span>
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

              {result.meta && (
                <div className="review-scope-note">
                  <span className="scope-pill">{SCOPES.find((x) => x.id === result.meta!.scope)?.label}</span>
                  <span className="scope-label">{result.meta.label}</span>
                  {(result.meta.notes || []).map((n, i) => (
                    <div key={i} className="inline-notice">{n}</div>
                  ))}
                  {result.meta.droppedOutOfRange ? (
                    <div className="inline-notice">
                      {result.meta.droppedOutOfRange} finding(s) outside the selected lines were discarded.
                    </div>
                  ) : null}
                </div>
              )}

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
