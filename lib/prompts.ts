// Standup analysis prompt + input builder + lenient JSON parser.
// Produces structured JSON matching the StandupAnalysis interface.

export interface StandupAnalysis {
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

/**
 * Maximum characters of diff sent to the model.
 *
 * Groq's free tier allows only 8,000 tokens/minute; a 50k-char diff is ~13k
 * tokens and returns HTTP 413 (rate_limit_exceeded), which used to take out the
 * whole fallback path. ~16k chars ≈ 4k tokens leaves room for the prompt and
 * the JSON response inside that budget.
 */
export const MAX_DIFF_CHARS = 16000;

export const ANALYSIS_PROMPT = `You are an expert engineering standup analyst. You are given git diffs, commit messages (with dates), and repository metadata. Produce ONE structured standup report.

OUTPUT FORMAT — return ONLY valid JSON. No markdown fences, no commentary, no trailing text.
{
  "developer": "author name",
  "repository": "repo name",
  "branch": "branch name",
  "summary": "2-3 sentences: what changed and why it matters",
  "yesterday_progress": ["..."],
  "today_focus": ["..."],
  "blockers_and_risks": ["..."],
  "code_review": {
    "complexity_score": 1,
    "code_health": "High | Medium | Low",
    "highlights": ["..."],
    "risks": ["..."],
    "security_or_debt_flags": ["..."]
  }
}

GROUNDING RULES (most important):
- Every bullet MUST be traceable to the supplied diff or commit list. Name the actual file path and, where visible, the function/component (e.g. "Added rate limiting to lib/rate-limit.ts", "Refactored fetchCommits() to drop stale pagination").
- NEVER invent work that is not in the diff: no "continued development", no "improved performance", no "worked on features", no "fixed bugs" without naming what.
- If a section genuinely has no evidence, return an EMPTY array []. An empty array is correct; filler is not.
- One line per bullet, no markdown, no leading bullets or dashes. 3-6 bullets per section maximum.

TEMPORAL SPLIT (yesterday vs today):
- The input lists each commit with its date. "today" = commits dated within the last ~24h; "yesterday_progress" = completed work evidenced by those commits; "today_focus" = what is visibly incomplete, in-progress, or next (unfinished refactors, TODO/FIXME comments, files added without callers, partial migrations). If nothing indicates future work, use an empty array.

CODE REVIEW:
- highlights: genuinely good patterns you can see (tests added, error handling, validation, clean separation).
- risks: concrete bugs or smells — missing null checks, swallowed errors, race conditions, unbounded queries, missing edge cases. Cite the file.
- security_or_debt_flags: injection, hardcoded secrets, missing authz, missing input validation, dead code, duplicated logic. Cite the file.
- complexity_score: 1-10 from real signal (files touched, nesting, domain difficulty). Do not simply echo any "Complexity estimate" given in the input — treat it as a rough hint only.
- code_health: High only if there are no material risks/flags; Medium if some; Low if security flags or serious risks exist.

EXAMPLE of the expected style (yours will have different content):
{"developer":"Sam Lee","repository":"api-server","branch":"main","summary":"Added rate limiting to the commits API and fixed a stale-pagination bug that dropped the newest commits.","yesterday_progress":["Added fixed-window rate limiting in lib/rate-limit.ts","Fixed fetchCommits() to stop dropping the newest page"],"today_focus":["Wire the limiter into the remaining /api routes"],"blockers_and_risks":["Rate limit state is in-memory, so it resets per instance"],"code_review":{"complexity_score":4,"code_health":"Medium","highlights":["Rate limiter caps stored keys to avoid unbounded memory"],"risks":["In-memory Map is not shared across serverless instances"],"security_or_debt_flags":["Anonymous bucket keyed only by IP could be spoofed via x-forwarded-for"]}}

Return ONLY the JSON object.`;

export function buildAnalysisInput(params: {
  author: string;
  repository: string;
  branch: string;
  commitMessages: string[];
  /** Optional ISO dates aligned index-for-index with commitMessages. */
  commitDates?: (string | null)[];
  mlMetrics: { files_changed: number; lines_added: number; lines_removed: number; complexity_estimate: number };
  gitDiff: string;
}): string {
  const dates = params.commitDates;
  const commits = params.commitMessages.map((m, i) => {
    // Commit bodies are multi-line; collapse so the numbered list stays intact.
    const message = m.replace(/\s*\n+\s*/g, " · ").trim();
    const date = dates?.[i] ? ` [${String(dates[i]).slice(0, 10)}]` : "";
    return `  ${i + 1}.${date} ${message}`;
  });

  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  return [
    `Author: ${params.author}`,
    `Repository: ${params.repository}`,
    `Branch: ${params.branch}`,
    `Today (UTC): ${now.toISOString().slice(0, 10)}`,
    `Cutoff for "today" (UTC): ${yesterday.toISOString().slice(0, 10)}`,
    ``,
    `Commits (${params.commitMessages.length}):`,
    ...commits,
    ``,
    `Metrics (rough, computed from the filtered diff — treat as hints):`,
    `  Files changed: ${params.mlMetrics.files_changed}`,
    `  Lines added: ${params.mlMetrics.lines_added}`,
    `  Lines removed: ${params.mlMetrics.lines_removed}`,
    `  Complexity estimate: ${params.mlMetrics.complexity_estimate}/10`,
    ``,
    `Git Diff:`,
    params.gitDiff.slice(0, MAX_DIFF_CHARS),
  ].join("\n");
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v): v is string => typeof v === "string")
    .map((v) => v.trim())
    .filter(Boolean);
}

/**
 * Parses and *normalises* the model output.
 *
 * Deliberately lenient: a single missing/misspelled field must not discard an
 * otherwise useful analysis (the previous all-or-nothing check threw away good
 * responses and fell back to canned text). Returns null only when nothing
 * usable could be extracted at all.
 */
export function parseStandupAnalysis(raw: string): StandupAnalysis | null {
  try {
    let cleaned = raw.trim();

    // Strip markdown code fences
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "");

    // Strip trailing commas before } or ]
    cleaned = cleaned.replace(/,\s*([\]}])/g, "$1");

    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start === -1 || end === -1 || end < start) return null;

    const parsed: unknown = JSON.parse(cleaned.substring(start, end + 1));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;

    const p = parsed as Record<string, unknown>;
    const cr = (p.code_review && typeof p.code_review === "object" && !Array.isArray(p.code_review)
      ? p.code_review
      : {}) as Record<string, unknown>;

    const summary = typeof p.summary === "string" ? p.summary.trim() : "";
    const yesterday_progress = asStringArray(p.yesterday_progress);
    const today_focus = asStringArray(p.today_focus);
    const blockers_and_risks = asStringArray(p.blockers_and_risks);
    const highlights = asStringArray(cr.highlights);
    const risks = asStringArray(cr.risks);
    const security_or_debt_flags = asStringArray(cr.security_or_debt_flags);

    // Nothing usable at all → let the caller fall back.
    const hasContent =
      Boolean(summary) ||
      yesterday_progress.length > 0 ||
      today_focus.length > 0 ||
      blockers_and_risks.length > 0 ||
      highlights.length > 0 ||
      risks.length > 0 ||
      security_or_debt_flags.length > 0;
    if (!hasContent) return null;

    const validHealth = ["High", "Medium", "Low"] as const;
    const code_health = validHealth.includes(cr.code_health as (typeof validHealth)[number])
      ? (cr.code_health as StandupAnalysis["code_review"]["code_health"])
      : "Medium";

    const numeric = Number(cr.complexity_score);
    const complexity_score = Number.isFinite(numeric)
      ? Math.max(1, Math.min(10, Math.round(numeric)))
      : 5;

    return {
      developer:
        typeof p.developer === "string" && p.developer.trim() ? p.developer.trim() : "Unknown",
      repository: typeof p.repository === "string" ? p.repository.trim() : "",
      branch: typeof p.branch === "string" && p.branch.trim() ? p.branch.trim() : "main",
      summary: summary || "Generated from the selected commits.",
      yesterday_progress,
      today_focus,
      blockers_and_risks,
      code_review: {
        complexity_score,
        code_health,
        highlights,
        risks,
        security_or_debt_flags,
      },
    };
  } catch {
    return null;
  }
}
