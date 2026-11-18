import { NextResponse } from 'next/server';
import { fetchCommits } from '@/lib/github';
import { authenticate, resolveGitHubToken } from '@/lib/auth';
import { handleRouteError, jsonError } from '@/lib/http';
import { enforceRateLimit } from '@/lib/rate-limit';
import { assertOwnerRepo } from '@/lib/validation';

export async function GET(request: Request) {
  const auth = await authenticate(request);
  if ('response' in auth) return auth.response;
  const limited = enforceRateLimit(request, 'github', auth.user.id);
  if (limited) return limited;

  try {
    const { searchParams } = new URL(request.url);
    const { owner, repo } = assertOwnerRepo(searchParams.get('owner'), searchParams.get('repo'));

    const { token, error: tokenError } = await resolveGitHubToken(request, auth.user.id);
    if (!token) return jsonError(tokenError || 'GitHub Token missing', 401, { commits: [] });

    const commits = await fetchCommits(owner, repo, token);
    return NextResponse.json({ success: true, commits: commits || [] });
  } catch (error) {
    return handleRouteError(error, 'commits', { commits: [] });
  }
}
