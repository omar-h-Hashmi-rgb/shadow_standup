import { NextResponse } from 'next/server';
import { fetchRecentDiffs } from '@/lib/github';
import { supabase } from '@/lib/supabase';
import { model } from '@/lib/gemini';
import { createClient } from '@supabase/supabase-js';

// Initialize admin client for server-side persistence
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    const { owner, repo, commitShas, userId } = await request.json();

    if (!owner || !repo) {
      return NextResponse.json(
        { success: false, error: 'Owner and repo are required fields.' },
        { status: 400 }
      );
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
      const { data: { session: authSession } } = await supabase.auth.getSession();
      token = authSession?.provider_token || undefined;

      // 4. Fallback: DB
      if (!token && authSession?.user?.id) {
        const { data: tokenData } = await supabaseAdmin
          .from('user_tokens')
          .select('provider_token')
          .eq('user_id', authSession.user.id)
          .single();
        token = tokenData?.provider_token || undefined;
      }
    }

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'GitHub Token missing. Please check .env.local or sign in again.' },
        { status: 401 }
      );
    }

    let cleanedDiffs = '';
    let commitsUsed = 0;
    const githubToken = token;

    if (commitShas && commitShas.length > 0) {
      console.log(`Generating diffs for ${commitShas.length} specific commits...`);
      const { fetchCommitDiff, cleanDiff } = require('@/lib/github');
      const diffPromises = commitShas.map((sha: string) => fetchCommitDiff(owner, repo, sha, githubToken));
      const diffs = await Promise.all(diffPromises);
      cleanedDiffs = cleanDiff(diffs.join('\n\n---\n\n'));
      commitsUsed = commitShas.length;
    } else {
      console.log(`Sniffing recent diffs (last 24h) for ${owner}/${repo}...`);
      cleanedDiffs = await fetchRecentDiffs(owner, repo, githubToken);
      commitsUsed = cleanedDiffs ? 1 : 0; 
    }

    let summaryText = 'No recent activity found.';

    if (cleanedDiffs) {
      const prompt = `
        You are an Expert Technical Lead. Read the following code diffs from a daily coding session and generate a professional, concise daily stand-up report.
        
        Format the output in clear Markdown with exactly these three sections:
        Accomplishments (Focus on high-level business value and key technical changes)
        Challenges/Blockers (Identify potential risks or difficult logic encountered)
        Technical Debt/Cleanups (Note any areas requiring refactoring or documentation)

        Rules:
        - Do NOT use emojis or special icons like circles or symbols.
        - Use plain headings for each section.
        - Use bullet points for items.

        CODE DIFF DATA:
        ${cleanedDiffs}
      `;

      console.log(`Generating AI summary with gemini-2.5-flash...`);
      const result = await model.generateContent(prompt);
      summaryText = result.response.text();
    }

    // Save to Supabase
    try {
      const currentUserId = userId;

      if (currentUserId) {
        const { data, error } = await supabaseAdmin
          .from('history')
          .insert([
            { 
              user_id: currentUserId,
              owner, 
              repo, 
              content: summaryText,
              commits_count: commitsUsed
            }
          ])
          .select()
          .single();
        
        if (error) console.error('Database Sync Error:', error.message);

        return NextResponse.json({
          success: true,
          summary: summaryText,
          data,
        });
      }

      return NextResponse.json({
        success: true,
        summary: summaryText,
        warning: 'Summary generated but not saved (no user session).'
      });

    } catch (dbError: any) {
      console.error('Database Insertion Failed:', dbError.message);
      return NextResponse.json({
        success: true,
        summary: summaryText,
        warning: 'Failed to sync with database history.'
      });
    }

  } catch (error: any) {
    console.error('API Error:', error.message);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
