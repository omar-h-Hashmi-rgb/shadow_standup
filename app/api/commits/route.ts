import { NextResponse } from 'next/server';
import { fetchCommits } from '@/lib/github';
import { supabase } from '@/lib/supabase';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const owner = searchParams.get('owner');
    const repo = searchParams.get('repo');

    if (!owner || !repo) {
      return NextResponse.json({ success: false, error: 'Owner and repo are required', commits: [] });
    }

    // 1. Priority: .env.local
    let token: string | undefined = process.env.GITHUB_PERSONAL_ACCESS_TOKEN;

    // 2. Fallback: Session
    if (!token) {
      const { data: { session } } = await supabase.auth.getSession();
      token = session?.provider_token || undefined;

      // 3. Fallback: DB
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
  }
}
