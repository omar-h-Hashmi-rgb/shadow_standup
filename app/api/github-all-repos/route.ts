import { NextResponse } from 'next/server';
import { fetchUserRepositories } from '@/lib/github';
import { supabase } from '@/lib/supabase';

export async function GET() {
  try {
    // 1. Priority: GITHUB_PERSONAL_ACCESS_TOKEN from .env.local
    let token: string | undefined = process.env.GITHUB_PERSONAL_ACCESS_TOKEN;

    // 2. Fallback: Supabase Session provider_token
    if (!token) {
      const { data: { session } } = await supabase.auth.getSession();
      token = session?.provider_token || undefined;
      
      // 3. Fallback: Persisted token in DB
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
  }
}
