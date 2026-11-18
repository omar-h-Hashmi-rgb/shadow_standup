import { NextResponse } from 'next/server';
import { fetchCommits } from '@/lib/github';
<<<<<<< HEAD
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
=======
import { supabase } from '@/lib/supabase';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const owner = searchParams.get('owner');
    const repo = searchParams.get('repo');

    if (!owner || !repo) {
      return NextResponse.json({ success: false, error: 'Owner and repo are required', commits: [] });
    }

    // 1. Priority: x-github-token header (User-provided)
    const headerToken = request.headers.get('x-github-token');
    let token: string | undefined = headerToken || undefined;

    // 2. Fallback: .env.local (ONLY in Dev)
    if (!token && process.env.NODE_ENV === 'development') {
      token = process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
    }

    // 3. Fallback: Session
    if (!token) {
      const { data: { session } } = await supabase.auth.getSession();
      token = session?.provider_token || undefined;

      // 4. Fallback: DB
      if (!token && session?.user?.id) {
        const { data: tokenData } = await supabase
          .from('user_tokens')
          .select('provider_token')
          .eq('user_id', session.user.id)
          .single();
        token = tokenData?.provider_token || undefined;
      }
    }

    if (!token) {
      return NextResponse.json({ success: false, error: 'GitHub Token missing', commits: [] });
    }

    const commits = await fetchCommits(owner, repo, token);
    return NextResponse.json({ success: true, commits: commits || [] });
  } catch (error: any) {
    console.error('Commits API Error:', error.message);
    return NextResponse.json({ success: false, error: error.message, commits: [] });
>>>>>>> origin/main
  }
}
