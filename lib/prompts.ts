// Standup analysis system prompt — used as Prompt 1 in the two-prompt pipeline.
// The model must return structured JSON matching the StandupAnalysis interface.

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

export const ANALYSIS_PROMPT = `You are an expert engineering standup analyst. Given git diffs, commit messages, and metadata, produce a structured standup report as JSON.

OUTPUT FORMAT — return ONLY valid JSON, no markdown fences, no commentary:
{
  "developer": "string — author name",
  "repository": "string — repo name",
  "branch": "string — branch name",
  "summary": "string — 2-3 sentence executive summary of what was done",
  "yesterday_progress": ["string — completed item 1", "..."],
  "today_focus": ["string — planned item 1", "..."],
  "blockers_and_risks": ["string — blocker/risk 1", "..."],
  "code_review": {
    "complexity_score": "number 1-10, 10 being most complex",
    "code_health": "High | Medium | Low",
    "highlights": ["string — notable positive pattern 1", "..."],
    "risks": ["string — code-level risk 1", "..."],
    "security_or_debt_flags": ["string — security or tech debt concern 1", "..."]
  }
}

RULES:
- yesterday_progress: extract from commit messages and actual code changes what was completed
- today_focus: infer planned work from incomplete changes, TODOs, or commit trajectory
- blockers_and_risks: identify any blockers, dependencies, or risks from the diff
- code_review.highlights: positive patterns (clean code, good tests, proper error handling)
- code_review.risks: code smells, potential bugs, missing edge cases
- code_review.security_or_debt_flags: SQL injection, hardcoded secrets, missing auth, unused imports, etc.
- complexity_score: weigh file count, lines changed, nesting depth, and domain complexity
- Return ONLY the JSON object, nothing else.`;

export function buildAnalysisInput(params: {
  author: string;
  repository: string;
  branch: string;
  commitMessages: string[];
  mlMetrics: { files_changed: number; lines_added: number; lines_removed: number; complexity_estimate: number };
  gitDiff: string;
}): string {
  return [
    `Author: ${params.author}`,
    `Repository: ${params.repository}`,
    `Branch: ${params.branch}`,
    `Commits (${params.commitMessages.length}):`,
    ...params.commitMessages.map((m, i) => `  ${i + 1}. ${m}`),
    ``,
    `Metrics:`,
    `  Files changed: ${params.mlMetrics.files_changed}`,
    `  Lines added: ${params.mlMetrics.lines_added}`,
    `  Lines removed: ${params.mlMetrics.lines_removed}`,
    `  Complexity estimate: ${params.mlMetrics.complexity_estimate}/10`,
    ``,
    `Git Diff (truncated):`,
    params.gitDiff.slice(0, 50000),
  ].join("\n");
}

export function parseStandupAnalysis(raw: string): StandupAnalysis | null {
  try {
    let cleaned = raw.trim();

    // Strip markdown code fences
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "");

    // Strip trailing commas before } or ]
    cleaned = cleaned.replace(/,\s*([\]}])/g, "$1");

    // Try to extract the JSON object
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start === -1 || end === -1) return null;

    cleaned = cleaned.substring(start, end + 1);

    const parsed = JSON.parse(cleaned) as StandupAnalysis;

    // Validate required fields
    if (!parsed.developer || !parsed.repository || !parsed.summary) return null;
    if (!Array.isArray(parsed.yesterday_progress)) return null;
    if (!Array.isArray(parsed.today_focus)) return null;
    if (!Array.isArray(parsed.blockers_and_risks)) return null;
    if (!parsed.code_review) return null;

    // Normalize code_health
    const validHealth = ["High", "Medium", "Low"];
    if (!validHealth.includes(parsed.code_review.code_health)) {
      parsed.code_review.code_health = "Medium";
    }

    // Clamp complexity_score
    parsed.code_review.complexity_score = Math.max(1, Math.min(10, parsed.code_review.complexity_score || 5));

    return parsed;
  } catch {
    return null;
  }
}
