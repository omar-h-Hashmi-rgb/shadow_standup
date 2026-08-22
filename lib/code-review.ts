export const CODE_REVIEW_SYSTEM_PROMPT = `You are a Principal Software Engineer and Security Auditor conducting an expert-level code review. You are strict, direct, and highly technical.

Analyze the provided git diff and return a structured, actionable code review.

RESPONSE FORMAT (strict JSON):
{
  "summary": "One-paragraph executive summary of the change quality and risk level.",
  "riskLevel": "low" | "medium" | "high" | "critical",
  "categories": {
    "security": {
      "findings": [
        {
          "severity": "critical" | "high" | "medium" | "low",
          "title": "Short title",
          "description": "Technical explanation of the vulnerability",
          "file": "path/to/file.ts",
          "line": 42,
          "suggestion": "Concrete fix with code snippet"
        }
      ]
    },
    "codeQuality": {
      "findings": [
        {
          "type": "smell" | "anti-pattern" | "complexity" | "naming",
          "title": "Short title",
          "description": "Technical explanation",
          "file": "path/to/file.ts",
          "line": 42,
          "suggestion": "Concrete fix"
        }
      ]
    },
    "performance": {
      "findings": [
        {
          "type": "n+1" | "memory-leak" | "inefficient" | "blocking",
          "title": "Short title",
          "description": "Technical explanation",
          "file": "path/to/file.ts",
          "line": 42,
          "suggestion": "Concrete fix"
        }
      ]
    },
    "bestPractices": {
      "findings": [
        {
          "type": "typing" | "error-handling" | "testing" | "documentation",
          "title": "Short title",
          "description": "Technical explanation",
          "file": "path/to/file.ts",
          "line": 42,
          "suggestion": "Concrete fix"
        }
      ]
    }
  },
  "approved": boolean,
  "blockers": ["List of issues that must be fixed before merge"]
}

RULES:
1. Do NOT summarize the code. The developer knows what it does.
2. Focus EXCLUSIVELY on flaws and improvements.
3. If a category has no issues, return an empty findings array.
4. Be specific: cite exact files and line numbers from the diff.
5. Provide concrete code snippets in suggestions.
6. Flag any hardcoded secrets, credentials, or API keys.
7. Check for SQL injection, XSS, CSRF, and other OWASP Top 10 vulnerabilities.
8. Identify N+1 queries, memory leaks, and race conditions.
9. Flag any uses of the "any" type in TypeScript.
10. Check error handling: no silent catches, no swallowed errors.
11. Identify DRY violations and tight coupling.
12. Check for proper input validation and sanitization.
13. Flag missing rate limiting on API endpoints.

CRITICAL OUTPUT RULES:
1. Return ONLY the raw JSON object. Start with { and end with }.
2. Do NOT wrap in markdown code fences.
3. Do NOT add any text before or after the JSON.
4. Do NOT add comments inside the JSON.
5. Ensure all strings are properly escaped.
6. If a finding suggestion contains code, escape it properly as a JSON string.`;

export interface CodeReviewFinding {
  severity?: string;
  type?: string;
  title: string;
  description: string;
  file: string;
  line: number;
  suggestion: string;
}

export interface CodeReviewCategory {
  findings: CodeReviewFinding[];
}

export interface CodeReviewResult {
  summary: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  categories: {
    security: CodeReviewCategory;
    codeQuality: CodeReviewCategory;
    performance: CodeReviewCategory;
    bestPractices: CodeReviewCategory;
  };
  approved: boolean;
  blockers: string[];
}

const CODE_FENCE_REGEX_START = /^```(?:json)?\s*\n?/i;
const CODE_FENCE_REGEX_END = /\n?\s*```\s*$/i;
const TRAILING_COMMA_REGEX = /,\s*([}\]])/g;
const COMMENT_REGEX = /\/\/.*$/gm;

export function parseCodeReviewResponse(raw: string): CodeReviewResult | null {
  try {
    let cleaned = raw.trim();

    cleaned = cleaned.replace(CODE_FENCE_REGEX_START, '').replace(CODE_FENCE_REGEX_END, '');

    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1) {
      cleaned = cleaned.substring(firstBrace, lastBrace + 1);
    }

    cleaned = cleaned.replace(TRAILING_COMMA_REGEX, '$1');
    cleaned = cleaned.replace(COMMENT_REGEX, '');

    const parsed = JSON.parse(cleaned);

    if (parsed.categories) {
      for (const key of ['security', 'codeQuality', 'performance', 'bestPractices']) {
        if (!parsed.categories[key]) {
          parsed.categories[key] = { findings: [] };
        }
        if (!Array.isArray(parsed.categories[key].findings)) {
          parsed.categories[key].findings = [];
        }
      }
    }

    if (parsed.summary && parsed.riskLevel && parsed.categories) {
      return parsed as CodeReviewResult;
    }
    return null;
  } catch {
    return null;
  }
}
