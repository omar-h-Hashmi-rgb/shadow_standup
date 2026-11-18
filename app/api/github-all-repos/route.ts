import { NextResponse } from 'next/server';
import { fetchUserRepositories } from '@/lib/github';
<<<<<<< HEAD
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
=======
import { supabase } from '@/lib/supabase';

export async function GET(request: Request) {
  try {
    // 1. Priority: x-github-token header (User-provided)
    const headerToken = request.headers.get('x-github-token');
    let token: string | undefined = headerToken || undefined;

    // 2. Fallback: GITHUB_PERSONAL_ACCESS_TOKEN from .env.local (ONLY in Dev)
    if (!token && process.env.NODE_ENV === 'development') {
      token = process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
    }

    // 3. Fallback: Supabase Session provider_token
    if (!token) {
      const { data: { session } } = await supabase.auth.getSession();
      token = session?.provider_token || undefined;
      
      // 4. Fallback: Persisted token in DB
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
      return NextResponse.json({ 
        success: false, 
        error: 'GitHub Token missing.',
        repos: [] 
      });
    }

    const repos = await fetchUserRepositories(token);

    return NextResponse.json({
      success: true,
      repos: repos || [],
    });
  } catch (error: any) {
    console.error('Repos API Error:', error.message);
    return NextResponse.json({ 
      success: false, 
      error: error.message,
      repos: [] 
    });
>>>>>>> origin/main
  }
}
