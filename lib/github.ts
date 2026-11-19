import axios from 'axios';
import { HttpError } from './http';

/**
 * Every GitHub request must be bounded. axios defaults to `timeout: 0`, which
 * means NO timeout is ever created — a single stalled socket then leaves the
 * awaiting promise pending forever (the "Generating…" spinner that never ends).
 */
const GITHUB_TIMEOUT_MS = 20000;

/**
 * Maps an upstream GitHub failure to a client-safe HttpError so callers surface
 * an actionable message instead of a bare "Internal Server Error".
 * (handleRouteError only exposes HttpError messages; raw axios errors are masked.)
 */
function githubHttpError(error: any): Error {
  const status: number | undefined = error?.response?.status;
  const upstream = typeof error?.response?.data?.message === 'string'
    ? error.response.data.message
    : '';

  if (status === 401) {
    return new HttpError(
      'Your GitHub token is invalid or expired. Add a new Personal Access Token in Settings.',
      401
    );
  }
  if (status === 403) {
    return new HttpError(
      /rate limit/i.test(upstream)
        ? 'GitHub rate limit reached. Wait a minute and try again.'
        : 'GitHub denied access for this token. Check that it has access to the repositories you selected.',
      403
    );
  }
  if (status === 404) {
    return new HttpError('Repository not found, or your token cannot access it.', 404);
  }
  return error instanceof Error ? error : new Error(String(error));
}

/** Builds `/repos/<owner>/<repo>` with each segment URL-encoded (defence against path injection). */
function repoApiPath(owner: string, repo: string): string {
  return `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
}

/**
 * Strips out unnecessary files and truncates large diffs to save LLM tokens.
 */
const SKIP_BASENAMES = new Set([
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'bun.lockb',
  'cargo.lock',
  'poetry.lock',
  'composer.lock',
]);

// Matched against the FILE NAME only, so `.svg` no longer swallows
// `logo.svg.ts` / `Icon.svg.tsx` / `*.svg.test.ts`, and `.min.js` no longer
// swallows `.min.json`.
const SKIP_EXTENSIONS = [
  '.svg', '.svgz', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.avif',
  '.pdf', '.woff', '.woff2', '.ttf', '.otf', '.eot',
  '.mp4', '.webm', '.mov', '.mp3', '.wav',
  '.min.js', '.min.css', '.min.json', '.map',
  '.snap', '.lock',
];

/** True when the file named in a `diff --git a/x b/y` header should be dropped. */
function shouldSkipDiffFile(headerLine: string): boolean {
  // Prefer the "b/" (new) path; fall back to the whole line.
  const idx = headerLine.indexOf(' b/');
  const path = (idx >= 0 ? headerLine.slice(idx + 3) : headerLine).replace(/^"|"$/g, '');
  const lower = path.toLowerCase();
  const base = lower.split('/').pop() ?? lower;

  // Directory exclusion must match a full path segment, not any substring.
  if (/(^|\/)node_modules(\/|$)/.test(lower)) return true;
  if (SKIP_BASENAMES.has(base)) return true;
  return SKIP_EXTENSIONS.some((ext) => base.endsWith(ext));
}

export function cleanDiff(rawDiff: string): string {
  const lines = rawDiff.split('\n');
  const filteredLines: string[] = [];
  let isSkipping = false;

  for (const line of lines) {
    if (line.startsWith('diff --git')) {
      isSkipping = shouldSkipDiffFile(line);
    }

    if (!isSkipping) {
      filteredLines.push(line);
    }
  }

  const cleanedDiff = filteredLines.join('\n');
  
  // Truncate if exceeds 50,000 characters
  if (cleanedDiff.length > 50000) {
    return cleanedDiff.substring(0, 50000) + '\n\n... [Diff Truncated for token optimization]';
  }

  return cleanedDiff;
}

/**
 * Fetches diffs for all commits in the last 24 hours.
 */
export async function fetchRecentDiffs(owner: string, repo: string, token: string) {
  const githubApi = axios.create({
    baseURL: 'https://api.github.com',
    timeout: GITHUB_TIMEOUT_MS,
    headers: {
      Authorization: `token ${token}`,
      Accept: 'application/vnd.github.v3+json',
    },
  });

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  try {
    // 1. Get recent commits
    const { data: commits } = await githubApi.get(`${repoApiPath(owner, repo)}/commits`, {
      params: { since },
    });

    if (!commits || commits.length === 0) {
      return '';
    }

    // 2. Fetch diff for each commit
    const diffPromises = commits.map(async (commit: any) => {
      const { data: diff } = await githubApi.get(`${repoApiPath(owner, repo)}/commits/${encodeURIComponent(commit.sha)}`, {
        headers: {
          Accept: 'application/vnd.github.v3.diff',
        },
        responseType: 'text',
      });
      return diff;
    });

    const diffs = await Promise.all(diffPromises);
    const combinedDiff = diffs.join('\n\n---\n\n');

    return cleanDiff(combinedDiff);
  } catch (error: any) {
    console.error('Error fetching GitHub diffs:', error.response?.data || error.message);
    throw githubHttpError(error);
  }
}

/**
 * Fetches a list of commits for a given repository.
 */
export async function fetchCommits(owner: string, repo: string, token: string) {
  try {
    const response = await axios.get(
      `https://api.github.com${repoApiPath(owner, repo)}/commits?per_page=30`,
      {
        timeout: GITHUB_TIMEOUT_MS,
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github.v3+json',
        },
      }
    );

    return response.data.map((c: any) => ({
      sha: c.sha,
      message: c.commit.message,
      date: c.commit.author.date,
      author: c.commit.author.name,
    }));
  } catch (error: any) {
    console.error('Fetch Commits Error:', error.message);
    throw githubHttpError(error);
  }
}

/**
 * Fetches the diff for a specific commit.
 */
export async function fetchCommitDiff(owner: string, repo: string, sha: string, token: string) {
  try {
    const response = await axios.get(
      `https://api.github.com${repoApiPath(owner, repo)}/commits/${encodeURIComponent(sha)}`,
      {
        timeout: GITHUB_TIMEOUT_MS,
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github.v3.diff',
        },
      }
    );
    return response.data;
  } catch (error: any) {
    console.error(`Fetch Diff Error (${sha}):`, error.message);
    return '';
  }
}

/**
 * Fetches the authenticated user's repositories.
 */
export async function fetchUserRepositories(token: string) {
  const githubApi = axios.create({
    baseURL: 'https://api.github.com',
    timeout: GITHUB_TIMEOUT_MS,
    headers: {
      Authorization: `token ${token}`,
      Accept: 'application/vnd.github.v3+json',
    },
  });

  try {
    const { data: repos } = await githubApi.get('/user/repos', {
      params: { 
        sort: 'updated',
        per_page: 20,
        type: 'owner' // Only repositories owned by the user
      },
    });

    return repos.map((repo: any) => ({
      name: repo.name,
      full_name: repo.full_name,
      owner: repo.owner.login,
    }));
  } catch (error: any) {
    console.error('Error fetching user repositories:', error.response?.data || error.message);
    throw githubHttpError(error);
  }
}

// ---------------------------------------------------------------------------
// Source browsing (used by the Code Reviewer's file / selection / line /
// codebase scopes). Same auth + axios conventions as the helpers above.
// ---------------------------------------------------------------------------

export interface RepoTreeFile {
  path: string;
  size: number;
}

export interface RepoTree {
  ref: string;
  files: RepoTreeFile[];
  truncated: boolean;
}

function githubClient(token: string) {
  return axios.create({
    baseURL: 'https://api.github.com',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
    },
    timeout: 20000,
    maxRedirects: 0,
  });
}

/**
 * Lists every file (blob) in the repository at `ref` (default: HEAD, i.e. the
 * default branch). GitHub truncates very large trees; `truncated` reports it.
 */
export async function fetchRepoTree(
  owner: string,
  repo: string,
  token: string,
  ref: string = 'HEAD'
): Promise<RepoTree> {
  try {
    const { data } = await githubClient(token).get(
      `${repoApiPath(owner, repo)}/git/trees/${encodeURIComponent(ref)}`,
      { params: { recursive: 1 }, maxContentLength: 12 * 1024 * 1024 }
    );
    const files: RepoTreeFile[] = (data.tree || [])
      .filter((n: any) => n.type === 'blob' && typeof n.path === 'string')
      .map((n: any) => ({ path: n.path as string, size: Number(n.size) || 0 }));
    return { ref, files, truncated: Boolean(data.truncated) };
  } catch (error: any) {
    console.error('Fetch Tree Error:', error.response?.status || error.message);
    throw githubHttpError(error);
  }
}

export interface RepoFile {
  path: string;
  content: string;
  size: number;
}

/** Thrown for files that cannot be shown/reviewed as text. */
export class UnreviewableFileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnreviewableFileError';
  }
}

export const MAX_FILE_BYTES = 400 * 1024;

/**
 * Fetches a file's raw text. Rejects binary and oversized files with
 * UnreviewableFileError so callers can show a clear message.
 */
export async function fetchFileContent(
  owner: string,
  repo: string,
  path: string,
  token: string,
  ref?: string
): Promise<RepoFile> {
  const encodedPath = path.split('/').map(encodeURIComponent).join('/');
  try {
    const { data } = await githubClient(token).get(
      `${repoApiPath(owner, repo)}/contents/${encodedPath}`,
      {
        params: ref ? { ref } : undefined,
        headers: { Accept: 'application/vnd.github.raw+json' },
        responseType: 'text',
        transformResponse: [(d: unknown) => d],
        maxContentLength: MAX_FILE_BYTES,
      }
    );
    const content = typeof data === 'string' ? data : '';
    if (content.includes('\u0000')) {
      throw new UnreviewableFileError('Binary files cannot be reviewed.');
    }
    return { path, content, size: Buffer.byteLength(content, 'utf8') };
  } catch (error: any) {
    if (error instanceof UnreviewableFileError) throw error;
    if (error.code === 'ERR_BAD_RESPONSE' || /maxContentLength/i.test(error.message || '')) {
      throw new UnreviewableFileError(
        `File is larger than ${Math.round(MAX_FILE_BYTES / 1024)} KB. Review a line range or selection instead.`
      );
    }
    if (error.response?.status === 404) {
      throw new UnreviewableFileError('File not found at that path/ref (or the token cannot access it).');
    }
    if (error.response?.status === 403 && /too large/i.test(JSON.stringify(error.response?.data || ''))) {
      throw new UnreviewableFileError('File is too large to fetch. Review a line range or selection instead.');
    }
    console.error('Fetch File Error:', error.response?.status || error.message);
    throw error;
  }
}
