import { HttpError } from "./http";

// ---- GitHub identifiers -----------------------------------------------------
// These values are interpolated into GitHub API URLs, so they are validated
// strictly (and additionally encodeURIComponent'd where used).

const OWNER_RE = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;
const REPO_RE = /^[A-Za-z0-9._-]{1,100}$/;
const SHA_RE = /^[a-fA-F0-9]{7,40}$/;
const REF_RE = /^[A-Za-z0-9._\-/]{1,200}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const LIMITS = {
  maxCommits: 50,
  maxPathLength: 500,
  maxSnippetChars: 60_000,
  maxRangeLines: 3_000,
  maxModelNameLength: 80,
};

export function assertOwnerRepo(owner: unknown, repo: unknown): { owner: string; repo: string } {
  if (typeof owner !== "string" || !OWNER_RE.test(owner)) {
    throw new HttpError("Invalid repository owner.", 400);
  }
  if (typeof repo !== "string" || !REPO_RE.test(repo) || repo === "." || repo === "..") {
    throw new HttpError("Invalid repository name.", 400);
  }
  return { owner, repo };
}

export function assertShas(value: unknown, { required = false } = {}): string[] {
  if (value === undefined || value === null) {
    if (required) throw new HttpError("At least one commit SHA is required.", 400);
    return [];
  }
  if (!Array.isArray(value)) throw new HttpError("commitShas must be an array.", 400);
  if (required && value.length === 0) throw new HttpError("At least one commit SHA is required.", 400);
  if (value.length > LIMITS.maxCommits) {
    throw new HttpError(`Select at most ${LIMITS.maxCommits} commits.`, 400);
  }
  for (const sha of value) {
    if (typeof sha !== "string" || !SHA_RE.test(sha)) throw new HttpError("Invalid commit SHA.", 400);
  }
  return value as string[];
}

export function assertRef(ref: unknown): string | undefined {
  if (ref === undefined || ref === null || ref === "") return undefined;
  if (typeof ref !== "string" || !REF_RE.test(ref) || ref.includes("..")) {
    throw new HttpError("Invalid git ref.", 400);
  }
  return ref;
}

/** Repo-relative file path: no traversal, no absolute paths, no control chars. */
export function assertRepoPath(
  path: unknown,
  { allowEmpty = false, allowTrailingSlash = false } = {}
): string {
  if (path === undefined || path === null || path === "") {
    if (allowEmpty) return "";
    throw new HttpError("A file path is required.", 400);
  }
  if (typeof path !== "string" || path.length > LIMITS.maxPathLength) {
    throw new HttpError("Invalid file path.", 400);
  }
  if (/[\u0000-\u001f\u007f\\]/.test(path) || path.startsWith("/")) {
    throw new HttpError("Invalid file path.", 400);
  }
  const normalized = allowTrailingSlash && path.endsWith("/") ? path.slice(0, -1) : path;
  const segments = normalized.split("/");
  if (segments.some((s) => s === "" || s === "." || s === "..")) {
    throw new HttpError("Invalid file path.", 400);
  }
  return path;
}

export function assertLineRange(start: unknown, end: unknown): { start: number; end: number } {
  const s = Number(start);
  const e = Number(end);
  if (!Number.isInteger(s) || !Number.isInteger(e) || s < 1 || e < 1) {
    throw new HttpError("Line numbers must be positive whole numbers.", 400);
  }
  if (e < s) throw new HttpError("The end line must be greater than or equal to the start line.", 400);
  if (e - s + 1 > LIMITS.maxRangeLines) {
    throw new HttpError(`Select at most ${LIMITS.maxRangeLines} lines at a time.`, 400);
  }
  return { start: s, end: e };
}

export function assertUuid(value: unknown, label = "id"): string {
  if (typeof value !== "string" || !UUID_RE.test(value)) {
    throw new HttpError(`Invalid ${label}.`, 400);
  }
  return value;
}

// ---- Model allow-list -------------------------------------------------------
// Prevents callers from pointing the server's API keys at arbitrary models.

export const ALLOWED_MODELS = new Set([
  "gemini-3.8-flash",
  "openai/gpt-oss-120b",
  "qwen/qwen3.8-27b",
]);

export function resolveModel(requested: unknown, fallback: string): string {
  if (typeof requested === "string" && ALLOWED_MODELS.has(requested)) return requested;
  return fallback;
}

// ---- Misc -------------------------------------------------------------------

export function clampString(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value.length > max ? value.slice(0, max) : value;
}
