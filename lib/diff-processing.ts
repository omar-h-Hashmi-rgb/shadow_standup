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
const DEFAULT_MAX_DIFF_CHARS = 60000;

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
