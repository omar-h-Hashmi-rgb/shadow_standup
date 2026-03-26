import axios from 'axios';

/**
 * Strips out unnecessary files and truncates large diffs to save LLM tokens.
 */
export function cleanDiff(rawDiff: string): string {
  const lines = rawDiff.split('\n');
  const filteredLines: string[] = [];
  let isSkipping = false;

  const skipPatterns = [
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

  for (const line of lines) {
    if (line.startsWith('diff --git')) {
      // Check if this file should be skipped
      isSkipping = skipPatterns.some(pattern => line.includes(pattern));
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
    headers: {
      Authorization: `token ${token}`,
      Accept: 'application/vnd.github.v3+json',
    },
  });

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  try {
    // 1. Get recent commits
    const { data: commits } = await githubApi.get(`/repos/${owner}/${repo}/commits`, {
      params: { since },
    });

    if (!commits || commits.length === 0) {
      return '';
    }

    // 2. Fetch diff for each commit
    const diffPromises = commits.map(async (commit: any) => {
      const { data: diff } = await githubApi.get(`/repos/${owner}/${repo}/commits/${commit.sha}`, {
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
    throw error;
  }
}

/**
 * Fetches a list of commits for a given repository.
 */
export async function fetchCommits(owner: string, repo: string, token: string) {
  try {
    const response = await axios.get(
      `https://api.github.com/repos/${owner}/${repo}/commits?per_page=30`,
      {
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
    throw error;
  }
}

/**
 * Fetches the diff for a specific commit.
 */
export async function fetchCommitDiff(owner: string, repo: string, sha: string, token: string) {
  try {
    const response = await axios.get(
      `https://api.github.com/repos/${owner}/${repo}/commits/${sha}`,
      {
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
    throw error;
  }
}
