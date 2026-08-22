import { NextResponse } from 'next/server';
import { supabase } from './supabase';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const GITHUB_TOKEN_REGEX = /^(ghp_[a-zA-Z0-9]{36}|github_pat_[a-zA-Z0-9_]{22,})$/;

function isValidGitHubToken(token: string): boolean {
  return GITHUB_TOKEN_REGEX.test(token);
}

export async function resolveGitHubToken(request: Request): Promise<{ token: string | null; error?: string }> {
  const headerToken = request.headers.get('x-github-token');

  if (headerToken) {
    if (!isValidGitHubToken(headerToken)) {
      return { token: null, error: 'Invalid GitHub token format.' };
    }
    return { token: headerToken };
  }

  if (process.env.NODE_ENV === 'development' && process.env.GITHUB_PERSONAL_ACCESS_TOKEN) {
    return { token: process.env.GITHUB_PERSONAL_ACCESS_TOKEN };
  }

  const { data: { session } } = await supabase.auth.getSession();
  if (session?.provider_token) {
    return { token: session.provider_token };
  }

  if (session?.user?.id) {
    const { data: tokenData } = await supabaseAdmin
      .from('user_tokens')
      .select('provider_token')
      .eq('user_id', session.user.id)
      .single();
    if (tokenData?.provider_token) {
      return { token: tokenData.provider_token };
    }
  }

  return { token: null, error: 'GitHub Token missing. Please sign in or add a token in Settings.' };
}
