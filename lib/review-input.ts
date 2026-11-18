import {
  buildSourceReviewDiff,
  buildStructuredReviewDiff,
  shouldSkipFile,
  splitSourceLines,
  type SourceFileInput,
} from "./diff-processing";
import { fetchCommitDiff, fetchFileContent, fetchRepoTree, UnreviewableFileError, type RepoTreeFile } from "./github";
import { HttpError } from "./http";
import type { ReviewMeta, ReviewScope } from "./code-review";
import {
  assertLineRange,
  assertOwnerRepo,
  assertRef,
  assertRepoPath,
  assertShas,
  clampString,
  LIMITS,
} from "./validation";

/**
 * Turns a validated review request into model input. One builder per scope;
 * all of them produce the same shape, so the route, prompt, parser,
 * notifications and persistence are shared by every scope.
 */

export interface ReviewRequestBody {
  scope?: unknown;
  owner?: unknown;
  repo?: unknown;
  ref?: unknown;
  commitShas?: unknown;
  path?: unknown;
  pathPrefix?: unknown;
  lineStart?: unknown;
  lineEnd?: unknown;
  code?: unknown;
  filename?: unknown;
  startLine?: unknown;
}

export interface BuiltReviewInput {
  scope: ReviewScope;
  owner: string;
  repo: string;
  userPrompt: string;
  meta: ReviewMeta;
  /** Commit SHAs to persist (empty for non-commit scopes). */
  commitShas: string[];
  /** When set, findings outside this range are discarded after the model responds. */
  lineBounds?: { start: number; end: number };
  /** True if source (not diff) input — selects the source-snapshot prompt addendum. */
  isSource: boolean;
}

// ---- codebase scope tuning ---------------------------------------------------

const MAX_REPO_FILES = 40;
const MAX_REPO_FILE_BYTES = 200 * 1024;
const FETCH_CONCURRENCY = 6;
const REVIEW_CHAR_BUDGET = 60_000;

const SOURCE_EXTENSIONS = new Set([
  "ts", "tsx", "js", "jsx", "mjs", "cjs", "py", "go", "rs", "java", "kt", "kts", "rb", "php", "cs",
  "c", "h", "cpp", "hpp", "cc", "swift", "scala", "sql", "sh", "bash", "vue", "svelte", "dart", "lua",
  "ex", "exs", "yml", "yaml", "tf", "dockerfile",
]);
const EXCLUDED_DIRS = ["node_modules/", "vendor/", "dist/", "build/", ".next/", "out/", "coverage/", "__pycache__/", ".git/", "third_party/"];
const PRIORITY_DIRS = ["src/", "app/", "lib/", "server/", "api/", "components/", "pkg/", "cmd/", "internal/"];

function extensionOf(path: string): string {
  const name = path.split("/").pop() || "";
  if (name.toLowerCase() === "dockerfile") return "dockerfile";
  const i = name.lastIndexOf(".");
  return i === -1 ? "" : name.slice(i + 1).toLowerCase();
}

export function selectRepoFiles(tree: RepoTreeFile[], pathPrefix: string): { candidates: RepoTreeFile[]; chosen: RepoTreeFile[] } {
  const candidates = tree.filter((f) => {
    if (pathPrefix && !f.path.startsWith(pathPrefix)) return false;
    if (shouldSkipFile(f.path)) return false;
    if (EXCLUDED_DIRS.some((d) => f.path.startsWith(d) || f.path.includes(`/${d}`))) return false;
    if (!SOURCE_EXTENSIONS.has(extensionOf(f.path))) return false;
    return f.size > 0 && f.size <= MAX_REPO_FILE_BYTES;
  });

  const priority = (p: string) => (PRIORITY_DIRS.some((d) => p.startsWith(d)) ? 0 : 1);
  const ordered = [...candidates].sort(
    (a, b) => priority(a.path) - priority(b.path) || a.size - b.size || a.path.localeCompare(b.path)
  );

  // Only fetch what could plausibly fit, to avoid wasting GitHub calls.
  const chosen: RepoTreeFile[] = [];
  let bytes = 0;
  for (const f of ordered) {
    if (chosen.length >= MAX_REPO_FILES) break;
    if (bytes > REVIEW_CHAR_BUDGET * 1.5) break;
    chosen.push(f);
    bytes += f.size;
  }
  return { candidates: ordered, chosen };
}

/** Files offered in the Code Reviewer's file picker (text-like, not vendored, within the viewer size limit). */
export function listBrowsableFiles(tree: RepoTreeFile[], limit = 5000): RepoTreeFile[] {
  return tree
    .filter(
      (f) =>
        !shouldSkipFile(f.path) &&
        !EXCLUDED_DIRS.some((d) => f.path.startsWith(d) || f.path.includes(`/${d}`)) &&
        f.size > 0 &&
        f.size <= 400 * 1024
    )
    .sort((a, b) => a.path.localeCompare(b.path))
    .slice(0, limit);
}

async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return results;
}

// ---- helpers ------------------------------------------------------------------

function sanitizeFilename(value: unknown): string {
  const cleaned = clampString(value, 200).replace(/[\u0000-\u001f\u007f'`]/g, "").trim();
  return cleaned || "snippet";
}

const rangeLabel = (s: number, e: number) => (s === e ? `line ${s}` : `lines ${s}–${e}`);

function requireText(content: string, path: string) {
  if (!content.trim()) throw new HttpError(`'${path}' is empty — there is nothing to review.`, 400);
}

async function loadFile(owner: string, repo: string, path: string, token: string, ref?: string) {
  try {
    return await fetchFileContent(owner, repo, path, token, ref);
  } catch (e) {
    if (e instanceof UnreviewableFileError) throw new HttpError(e.message, 422);
    throw e;
  }
}

// ---- main entry ----------------------------------------------------------------

export async function buildReviewInput(
  scope: ReviewScope,
  body: ReviewRequestBody,
  token: string | null
): Promise<BuiltReviewInput> {
  const needToken = () => {
    if (!token) throw new HttpError("GitHub token missing. Add a Personal Access Token in Settings.", 401);
    return token;
  };

  // --- pasted snippet (selection without a repo) ---
  if (scope === "selection" && typeof body.code === "string") {
    const code = body.code;
    if (!code.trim()) throw new HttpError("Paste some code to review.", 400);
    if (code.length > LIMITS.maxSnippetChars) {
      throw new HttpError(`Snippet is too long (max ${LIMITS.maxSnippetChars.toLocaleString()} characters).`, 413);
    }
    const filename = sanitizeFilename(body.filename);
    const startLine = body.startLine === undefined || body.startLine === "" ? 1 : Number(body.startLine);
    if (!Number.isInteger(startLine) || startLine < 1 || startLine > 1_000_000) {
      throw new HttpError("Starting line number must be a positive whole number.", 400);
    }
    const total = splitSourceLines(code).length;
    const built = buildSourceReviewDiff([{ path: filename, content: code, firstLineNumber: startLine }], { allowTruncation: true });
    const end = startLine + total - 1;
    return {
      scope,
      owner: "local",
      repo: "pasted-snippet",
      isSource: true,
      commitShas: [],
      userPrompt:
        `Review ONLY the pasted code snippet below (file label: ${filename}; line numbers start at ${startLine}). ` +
        `Every line shown with a '+' is in scope.\n\nCODE:\n${built.diffText}`,
      meta: {
        scope,
        path: filename,
        lineStart: startLine,
        lineEnd: end,
        label: `Pasted snippet · ${filename} · ${rangeLabel(startLine, end)}`,
        filesReviewed: built.reviewedFiles,
        truncated: built.truncated,
      },
    };
  }

  const { owner, repo } = assertOwnerRepo(body.owner, body.repo);

  // --- commits (original behaviour) ---
  if (scope === "commits") {
    const shas = assertShas(body.commitShas, { required: true });
    const t = needToken();
    const diffs = await Promise.all(shas.map((sha) => fetchCommitDiff(owner, repo, sha, t)));
    const { diffText, skippedFiles, reviewedFiles } = buildStructuredReviewDiff(diffs);
    if (!diffText) throw new HttpError("No diff data found for the selected commits.", 400);

    return {
      scope,
      owner,
      repo,
      isSource: false,
      commitShas: shas,
      userPrompt: `Review this code diff from ${owner}/${repo}. ${reviewedFiles} file(s) are included below${
        skippedFiles.length ? `, ${skippedFiles.length} file(s) were omitted for size and are listed at the end` : ""
      }.\n\nDIFF:\n${diffText}`,
      meta: {
        scope,
        label: `${shas.length} commit${shas.length === 1 ? "" : "s"}`,
        filesReviewed: reviewedFiles,
        skippedFiles,
        truncated: skippedFiles.length > 0,
      },
    };
  }

  const ref = assertRef(body.ref);
  const t = needToken();

  // --- entire codebase ---
  if (scope === "repo") {
    const pathPrefix = assertRepoPath(body.pathPrefix, { allowEmpty: true, allowTrailingSlash: true });
    const tree = await fetchRepoTree(owner, repo, t, ref);
    const { candidates, chosen } = selectRepoFiles(tree.files, pathPrefix);
    if (candidates.length === 0) {
      throw new HttpError(
        pathPrefix ? `No reviewable source files found under '${pathPrefix}'.` : "No reviewable source files found in this repository.",
        422
      );
    }

    const loaded = await mapWithConcurrency(chosen, FETCH_CONCURRENCY, async (f) => {
      try {
        return await fetchFileContent(owner, repo, f.path, t, ref);
      } catch {
        return null; // binary / too large / unreadable: counted as skipped below
      }
    });
    const files: SourceFileInput[] = loaded
      .filter((f): f is NonNullable<typeof f> => !!f && f.content.trim().length > 0)
      .map((f) => ({ path: f.path, content: f.content }));
    if (files.length === 0) throw new HttpError("None of the source files could be read.", 422);

    const built = buildSourceReviewDiff(files, { allowTruncation: false });
    const notIncluded = candidates.length - built.reviewedFiles;
    const skipped = [...built.skippedFiles, ...candidates.filter((c) => !chosen.includes(c)).map((c) => c.path)];

    const notes: string[] = [];
    if (notIncluded > 0) notes.push(`${built.reviewedFiles} of ${candidates.length} source files were reviewed; ${notIncluded} were not (size limits). Use a path filter to target a directory.`);
    if (tree.truncated) notes.push("GitHub truncated the file list for this very large repository.");

    return {
      scope,
      owner,
      repo,
      isSource: true,
      commitShas: [],
      userPrompt:
        `Review these ${built.reviewedFiles} source file(s) from ${owner}/${repo}${pathPrefix ? ` (under '${pathPrefix}')` : ""}` +
        `${ref ? ` at ref ${ref}` : ""}. Every line shown with a '+' is in scope.\n\nCODE:\n${built.diffText}`,
      meta: {
        scope,
        ref,
        path: pathPrefix || undefined,
        label: `Codebase${pathPrefix ? ` · ${pathPrefix}` : ""} · ${built.reviewedFiles}/${candidates.length} files`,
        filesReviewed: built.reviewedFiles,
        skippedFiles: skipped.slice(0, 50),
        truncated: notIncluded > 0 || tree.truncated,
        notes,
      },
    };
  }

  // --- single file: file / lines / selection ---
  const path = assertRepoPath(body.path);
  const file = await loadFile(owner, repo, path, t, ref);
  requireText(file.content, path);
  const totalLines = splitSourceLines(file.content).length;

  let focus: { start: number; end: number } | undefined;
  if (scope === "lines" || scope === "selection") {
    const range = assertLineRange(body.lineStart, body.lineEnd);
    if (range.start > totalLines) {
      throw new HttpError(`'${path}' only has ${totalLines} line${totalLines === 1 ? "" : "s"} (requested ${range.start}).`, 400);
    }
    focus = { start: range.start, end: Math.min(range.end, totalLines) };
  }

  const built = buildSourceReviewDiff([{ path, content: file.content, focus }], { allowTruncation: true });
  const cov = built.coverage[0];
  if (!cov) throw new HttpError("The requested code is too large to review. Select a smaller range.", 413);

  const start = focus?.start ?? 1;
  const end = focus?.end ?? totalLines;
  const reviewedTo = cov.reviewedTo;
  const notes: string[] = [];
  if (cov.truncated) {
    notes.push(`Only lines ${cov.reviewedFrom}–${cov.reviewedTo} of the requested ${start}–${end} fit within size limits. Review the rest as a separate range.`);
  }

  const where = `${owner}/${repo}${ref ? ` @ ${ref}` : ""}`;
  const scopeText =
    scope === "file"
      ? `the entire file '${path}' from ${where}. All ${totalLines} line(s) are in scope`
      : `ONLY ${rangeLabel(start, end)} of '${path}' from ${where}. Only lines shown with a '+' are in scope; all other lines are context`;

  return {
    scope,
    owner,
    repo,
    isSource: true,
    commitShas: [],
    lineBounds: scope === "file" ? undefined : { start, end: reviewedTo },
    userPrompt: `Review ${scopeText}.\n\nCODE:\n${built.diffText}`,
    meta: {
      scope,
      path,
      ref,
      lineStart: start,
      lineEnd: reviewedTo,
      label: scope === "file" ? path : `${path} · ${rangeLabel(start, reviewedTo)}`,
      filesReviewed: 1,
      truncated: cov.truncated,
      notes,
    },
  };
}
