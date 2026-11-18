/**
 * Structured diff processing for the code reviewer.
 *
 * This replaces the previous approach of concatenating raw commit diffs and
 * blindly truncating them at a fixed character count (which regularly cut
 * diffs off mid-hunk and gave the model no way to cite accurate line
 * numbers). Instead, each file's patch is converted into labeled
 * `__new hunk__` / `__old hunk__` blocks with real line numbers attached to
 * every line of the new version of the file (the technique PR-Agent uses
 * for its review accuracy), and oversized diffs are trimmed by dropping
 * whole files — never by cutting a hunk in half.
 */

export interface ParsedDiffFile {
  filename: string;
  patch: string;
  isBinary: boolean;
  isDeleted: boolean;
  isNew: boolean;
}

const SKIP_PATTERNS = [
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  '.svg',
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.ico',
  '.pdf',
  '.woff',
  '.woff2',
  '.min.js',
  '.min.css',
  'node_modules',
];

const HUNK_HEADER_RE = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@ ?(.*)$/;

// Rough character budget used as a token-count proxy (~4 chars/token).
// Keeps the diff well within context limits for the models in use while
// leaving room for the system prompt and JSON response.
// Keep the prompt below the token-per-minute limits of the configured
// providers while leaving room for the review instructions and response.
const DEFAULT_MAX_DIFF_CHARS = 20000;

export function shouldSkipFile(filename: string): boolean {
  return SKIP_PATTERNS.some((pattern) => filename.includes(pattern));
}

/**
 * Splits a raw unified diff (as returned by the GitHub commit ".diff" API)
 * into one entry per file.
 */
export function parseUnifiedDiff(rawDiff: string): ParsedDiffFile[] {
  if (!rawDiff) return [];

  const lines = rawDiff.split('\n');
  const files: ParsedDiffFile[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (!line.startsWith('diff --git ')) {
      i++;
      continue;
    }

    const headerMatch = line.match(/^diff --git a\/(.+) b\/(.+)$/);
    let filename = headerMatch ? headerMatch[2] : 'unknown file';
    let isBinary = false;
    let isDeleted = false;
    let isNew = false;
    let inHunk = false;
    const patchLines: string[] = [];

    i++;
    while (i < lines.length && !lines[i].startsWith('diff --git ')) {
      const l = lines[i];

      if (l.startsWith('deleted file mode')) {
        isDeleted = true;
      } else if (l.startsWith('new file mode')) {
        isNew = true;
      } else if (l.startsWith('Binary files ')) {
        isBinary = true;
      } else if (isDeleted && l.startsWith('--- a/')) {
        filename = l.slice(6);
      }

      if (l.startsWith('@@')) {
        inHunk = true;
      }
      if (inHunk) {
        patchLines.push(l);
      }

      i++;
    }

    files.push({ filename, patch: patchLines.join('\n'), isBinary, isDeleted, isNew });
  }

  return files;
}

/**
 * Converts a single file's raw hunks into PR-Agent-style annotated hunks:
 * every line of the "new" (post-change) version of the file is prefixed
 * with its real line number, and removed lines are shown separately under
 * `__old hunk__`. This is what lets the model cite line numbers it can
 * actually be right about, instead of counting diff lines by hand.
 */
export function decoupleAndConvertToHunksWithLineNumbers(patch: string, filename: string): string {
  let out = `\n\n## File: '${filename.trim()}'\n`;

  if (!patch || !patch.trim()) {
    return out.trimEnd();
  }

  const patchLines = patch.split('\n');
  let newContentLines: string[] = [];
  let oldContentLines: string[] = [];
  let start2 = 0;
  let prevHeaderLine = '';
  let headerLine = '';
  let skipHunk = false;

  const appendFlushedHunk = (header: string, newLines: string[], oldLines: string[]) => {
    if (header) {
      out += `\n${header}\n`;
    }
    const hasPlus = newLines.some((l) => l.startsWith('+'));
    const hasMinus = oldLines.some((l) => l.startsWith('-'));
    if (hasPlus || hasMinus) {
      out = out.replace(/\s+$/, '') + '\n__new hunk__\n';
      newLines.forEach((l, idx) => {
        out += `${start2 + idx} ${l}\n`;
      });
    }
    if (hasMinus) {
      out = out.replace(/\s+$/, '') + '\n__old hunk__\n';
      oldLines.forEach((l) => {
        out += `${l}\n`;
      });
    }
  };

  for (let i = 0; i < patchLines.length; i++) {
    const line = patchLines[i];

    if (line.toLowerCase().includes('no newline at end of file')) continue;

    if (line.startsWith('@@')) {
      const match = line.match(HUNK_HEADER_RE);
      if (!match) {
        skipHunk = true;
        continue;
      }
      skipHunk = false;

      if (newContentLines.length || oldContentLines.length) {
        appendFlushedHunk(prevHeaderLine, newContentLines, oldContentLines);
        newContentLines = [];
        oldContentLines = [];
      }

      headerLine = line;
      prevHeaderLine = headerLine;
      start2 = match[3] ? parseInt(match[3], 10) : 0;
      continue;
    }

    if (skipHunk) continue;

    if (line.startsWith('+')) {
      newContentLines.push(line);
    } else if (line.startsWith('-')) {
      oldContentLines.push(line);
    } else {
      if (line === '' && i > 0) {
        const nextIsHunk = i + 1 < patchLines.length && patchLines[i + 1].startsWith('@@');
        const isLastLine = i + 1 === patchLines.length;
        if (nextIsHunk || isLastLine) continue;
      }
      newContentLines.push(line);
      oldContentLines.push(line);
    }
  }

  if (newContentLines.length || oldContentLines.length) {
    appendFlushedHunk(headerLine, newContentLines, oldContentLines);
  }

  return out.trimEnd();
}

export interface StructuredReviewDiff {
  diffText: string;
  totalFiles: number;
  reviewedFiles: number;
  skippedFiles: string[];
}

/**
 * Builds the final diff text handed to the review model: filters out noise
 * files, annotates every remaining file's hunks with line numbers, and
 * stops adding whole files once the character budget is hit (instead of
 * cutting a file in half). Skipped files are listed explicitly so the
 * model — and the review summary — knows the review isn't exhaustive
 * rather than silently reviewing a truncated fragment.
 */
export function buildStructuredReviewDiff(
  commitDiffs: string[],
  maxDiffChars: number = DEFAULT_MAX_DIFF_CHARS
): StructuredReviewDiff {
  const allFiles: ParsedDiffFile[] = [];
  for (const raw of commitDiffs) {
    if (!raw) continue;
    allFiles.push(...parseUnifiedDiff(raw));
  }

  const sections: string[] = [];
  const skippedFiles: string[] = [];
  let budget = maxDiffChars;
  let reviewedFiles = 0;

  for (const file of allFiles) {
    if (file.isBinary) continue;
    if (shouldSkipFile(file.filename)) continue;

    if (file.isDeleted) {
      const note = `\n\n## File: '${file.filename.trim()}' was deleted`;
      if (note.length <= budget) {
        sections.push(note);
        budget -= note.length;
        reviewedFiles++;
      }
      continue;
    }

    if (!file.patch.trim()) continue;

    const section = decoupleAndConvertToHunksWithLineNumbers(file.patch, file.filename);
    if (section.length > budget) {
      skippedFiles.push(file.filename);
      continue;
    }

    sections.push(section);
    budget -= section.length;
    reviewedFiles++;
  }

  let diffText = sections.join('\n');
  if (skippedFiles.length) {
    diffText +=
      `\n\n## Additional files changed but omitted here due to size limits ` +
      `(do not comment on these — they were not reviewed):\n` +
      skippedFiles.map((f) => `- ${f}`).join('\n');
  }

  return { diffText, totalFiles: allFiles.length, reviewedFiles, skippedFiles };
}

// ---------------------------------------------------------------------------
// Source snapshots (file / selection / line range / codebase reviews)
// ---------------------------------------------------------------------------
//
// These scopes review code that is not part of a commit diff. Rather than
// introduce a second prompt format, a snapshot is rendered in exactly the same
// "## File / __new hunk__ / <line number> <+| ><code>" layout produced above
// for diffs. Lines under review are marked '+', surrounding context is marked
// with a space, so the existing prompt, line-number rules and parser all apply
// unchanged (see SOURCE_REVIEW_ADDENDUM in code-review.ts).

export interface SourceFileInput {
  path: string;
  content: string;
  /** 1-based inclusive range of lines under review. Omit to review the whole file. */
  focus?: { start: number; end: number };
  /** Line number of the first line of `content` (pasted snippets). Default 1. */
  firstLineNumber?: number;
}

export interface SourceFileCoverage {
  path: string;
  reviewedFrom: number;
  reviewedTo: number;
  totalLines: number;
  truncated: boolean;
}

export interface SourceReviewDiff extends StructuredReviewDiff {
  coverage: SourceFileCoverage[];
  truncated: boolean;
}

const CONTEXT_LINES = 25;
const MAX_LINE_CHARS = 500;
const TRUNCATION_NOTE =
  "\n[Remaining lines of this file were not included due to size limits — do not comment on them.]";

export function splitSourceLines(content: string): string[] {
  const lines = content.replace(/\r\n?/g, "\n").split("\n");
  if (lines.length > 1 && lines[lines.length - 1] === "") lines.pop();
  return lines;
}

function numberedRow(lineNo: number, underReview: boolean, text: string): string {
  const t = text.length > MAX_LINE_CHARS ? `${text.slice(0, MAX_LINE_CHARS)} …[line truncated]` : text;
  return `${lineNo} ${underReview ? "+" : " "}${t}`;
}

interface RenderedSource {
  text: string;
  coverage: SourceFileCoverage;
}

/** Renders one file, or null if not even a minimal slice fits in `budget`. */
function renderSourceFile(file: SourceFileInput, budget: number, allowTruncation: boolean): RenderedSource | null {
  const lines = splitSourceLines(file.content);
  const total = lines.length;
  const first = file.firstLineNumber ?? 1;
  const lastLineNo = first + total - 1;

  const focusStart = Math.max(first, file.focus?.start ?? first);
  const focusEnd = Math.min(lastLineNo, file.focus?.end ?? lastLineNo);
  if (total === 0 || focusStart > focusEnd) return null;

  const head = `\n\n## File: '${file.path.trim()}'\n`;
  const rows = (from: number, to: number) => {
    const out: string[] = [];
    for (let n = from; n <= to; n++) out.push(numberedRow(n, n >= focusStart && n <= focusEnd, lines[n - first]));
    return out;
  };
  const assemble = (from: number, to: number, noteTruncated: boolean) =>
    `${head}\n@@ lines ${from}-${to} @@\n__new hunk__\n${rows(from, to).join("\n")}${noteTruncated ? TRUNCATION_NOTE : ""}`;

  // Try with context first, then without, so the focus is always preserved if possible.
  const contexts = file.focus ? [CONTEXT_LINES, 0] : [0];
  for (const ctx of contexts) {
    const from = Math.max(first, focusStart - ctx);
    const to = Math.min(lastLineNo, focusEnd + ctx);
    const text = assemble(from, to, false);
    if (text.length <= budget) {
      return { text, coverage: { path: file.path, reviewedFrom: focusStart, reviewedTo: focusEnd, totalLines: total, truncated: false } };
    }
  }
  if (!allowTruncation) return null;

  // Even the bare focus is too big: keep as many leading lines as fit, never half a line.
  let used = head.length + TRUNCATION_NOTE.length + 64;
  let to = focusStart - 1;
  for (let n = focusStart; n <= focusEnd; n++) {
    const rowLen = numberedRow(n, true, lines[n - first]).length + 1;
    if (used + rowLen > budget) break;
    used += rowLen;
    to = n;
  }
  if (to < focusStart) return null;
  return {
    text: assemble(focusStart, to, true),
    coverage: { path: file.path, reviewedFrom: focusStart, reviewedTo: to, totalLines: total, truncated: true },
  };
}

/**
 * Builds the model input for source snapshots. Mirrors buildStructuredReviewDiff:
 * whole files are added until the character budget is exhausted and anything
 * left out is listed explicitly. With `allowTruncation` (single-file scopes) an
 * oversized file is cut at a line boundary instead of being dropped, and the
 * cut is reported in `coverage`.
 */
export function buildSourceReviewDiff(
  files: SourceFileInput[],
  options: { maxChars?: number; allowTruncation?: boolean } = {}
): SourceReviewDiff {
  const maxChars = options.maxChars ?? DEFAULT_MAX_DIFF_CHARS;
  const allowTruncation = options.allowTruncation ?? false;

  const sections: string[] = [];
  const coverage: SourceFileCoverage[] = [];
  const skippedFiles: string[] = [];
  let budget = maxChars;

  for (const file of files) {
    const rendered = renderSourceFile(file, budget, allowTruncation);
    if (!rendered) {
      skippedFiles.push(file.path);
      continue;
    }
    sections.push(rendered.text);
    coverage.push(rendered.coverage);
    budget -= rendered.text.length;
  }

  let diffText = sections.join("\n");
  if (skippedFiles.length) {
    diffText +=
      `\n\n## Additional files omitted here due to size limits ` +
      `(do not comment on these — they were not reviewed):\n` +
      skippedFiles.map((f) => `- ${f}`).join("\n");
  }

  return {
    diffText,
    totalFiles: files.length,
    reviewedFiles: coverage.length,
    skippedFiles,
    coverage,
    truncated: coverage.some((c) => c.truncated) || skippedFiles.length > 0,
  };
}
