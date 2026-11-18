import { NextResponse } from 'next/server';
import { fetchUserRepositories } from '@/lib/github';
import { authenticate, resolveGitHubToken } from '@/lib/auth';
import { handleRouteError, jsonError } from '@/lib/http';
import { enforceRateLimit } from '@/lib/rate-limit';

export async function GET(request: Request) {
  const auth = await authenticate(request);
  if ('response' in auth) return auth.response;
  const limited = enforceRateLimit(request, 'github', auth.user.id);
  if (limited) return limited;

  try {
    const { token, error: tokenError } = await resolveGitHubToken(request, auth.user.id);
    if (!token) return jsonError(tokenError || 'GitHub Token missing.', 401, { repos: [] });

    const repos = await fetchUserRepositories(token);
    return NextResponse.json({ success: true, repos: repos || [] });
  } catch (error) {
    return handleRouteError(error, 'github-all-repos', { repos: [] });
  }
}
