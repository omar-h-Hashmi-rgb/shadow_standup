export const ANALYSIS_PROMPT = `You are the core analysis engine for "Shadow Standup", an automated event-driven version control system. Your job is to analyze raw Git commit logs, code diffs, and machine learning complexity metrics, then output a structured engineering summary and automated code review.

### INPUT DATA DEFINITIONS
You will be provided with:
- AUTHOR: The developer who committed the code.
- REPOSITORY: The repository name.
- BRANCH: The active branch name.
- COMMIT_MESSAGES: List of commit messages in this push/PR.
- ML_COMPLEXITY_METRICS: Pre-computed model scores (e.g., complexity score, files changed, churn).
- GIT_DIFF: The filtered Git diff showing changed code lines.

### ANALYSIS RULES & INSTRUCTIONS
1. NOISE REDUCTION: Ignore auto-generated code, build artifacts, lockfiles (e.g., package-lock.json, yarn.lock), whitespace adjustments, and minor formatting changes.
2. TECHNICAL FOCUS: Group changes by logical feature, refactor, or bug fix rather than listing individual file paths. Focus on WHY the change was made and its architectural impact.
3. CODE REVIEW & AUDIT:
   - Identify potential edge-case bugs, missing error handling, unhandled promises, or performance bottlenecks.
   - Flag security concerns (e.g., hardcoded credentials, unsafe queries, missing auth checks) or technical debt introduced.
   - Highlight key architectural or high-impact additions (e.g., database schema changes, new API endpoints, middleware updates).
4. STANDUP NARRATIVE:
   - "yesterday_progress": Actionable, high-impact bullet points written in past-tense engineering voice (e.g., "Implemented Supabase connection pooling").
   - "today_focus": Inferred logical next steps or immediate follow-ups based on active branch work and unfinished PR items.
   - "blockers_and_risks": Active risks, open dependencies, flagged code health issues, or high-complexity items that need review.

### OUTPUT FORMAT REQUIREMENTS
You MUST respond with a single, raw JSON object. Do NOT wrap the response in markdown backticks or include introductory/concluding plain text.

Strictly adhere to this JSON schema:

{
  "developer": "string",
  "repository": "string",
  "branch": "string",
  "summary": "1-2 sentence high-level executive summary of the changes.",
  "yesterday_progress": ["string"],
  "today_focus": ["string"],
  "blockers_and_risks": ["string"],
  "code_review": {
    "complexity_score": number,
    "code_health": "High" | "Medium" | "Low",
    "highlights": ["string"],
    "risks": ["string"],
    "security_or_debt_flags": ["string"]
  }
}

CRITICAL OUTPUT RULES:
1. Return ONLY the raw JSON object. Start with { and end with }.
2. Do NOT wrap in markdown code fences.
3. Do NOT add any text before or after the JSON.
4. Ensure all strings are properly escaped.`;

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

export function buildAnalysisInput(params: {
  author: string;
  repository: string;
  branch: string;
  commitMessages: string[];
  mlMetrics: Record<string, any>;
  gitDiff: string;
}): string {
  return `AUTHOR: ${params.author}
REPOSITORY: ${params.repository}
BRANCH: ${params.branch}
COMMIT_MESSAGES:
${params.commitMessages.map((m, i) => `${i + 1}. ${m}`).join('\n')}

ML_COMPLEXITY_METRICS:
${JSON.stringify(params.mlMetrics, null, 2)}

GIT_DIFF:
${params.gitDiff}`;
}

export function parseStandupAnalysis(raw: string): StandupAnalysis | null {
  try {
    let cleaned = raw.trim();

    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1) {
      cleaned = cleaned.substring(firstBrace, lastBrace + 1);
    }

    cleaned = cleaned.replace(/,\s*([}\]])/g, '$1');

    const parsed = JSON.parse(cleaned);

    if (parsed.developer && parsed.summary && parsed.code_review) {
      return parsed as StandupAnalysis;
    }
    return null;
  } catch {
    return null;
  }
}
