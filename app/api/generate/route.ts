import { NextResponse } from 'next/server';
import { fetchRecentDiffs } from '@/lib/github';
import { supabase } from '@/lib/supabase';
import { model as geminiModel } from '@/lib/gemini';
import { groq } from '@/lib/groq';
import { createClient } from '@supabase/supabase-js';

// Initialize admin client for server-side persistence
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Aggressively cleans the report text to remove emojis and special characters.
 */
const SECTION_TITLES = [
  "Accomplishments",
  "Challenges and Blockers",
  "Technical Debt and Cleanups",
];

function cleanReportText(text: string): string {
  if (!text) return "";

  let cleaned = text;
  cleaned = cleaned.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1F1E0}-\u{1F1FF}]/gu, "");
  cleaned = cleaned.replace(/[🟢🟡🔵✅🚀🛠️📊📈📉📁📎📌📍⚠️🛑🔥💡✨⭐🌟]/g, "");

  cleaned = cleaned.replace(/\r/g, "");
  cleaned = cleaned.replace(/\*\*|__|`/g, "");
  cleaned = cleaned.replace(/^#+\s*/gm, "");
  cleaned = cleaned.replace(/^[-*•]\s+/gm, "- ");
  cleaned = cleaned.replace(/[\\|<>]/g, "");

  // Remove any remaining non-text symbols while preserving punctuation, hyphens, and newlines
  cleaned = cleaned.replace(/[^a-zA-Z0-9\s.,:;'()\-\n]/g, "");
  cleaned = cleaned.replace(/\s{2,}/g, " ");
  cleaned = cleaned.replace(/\n{3,}/g, "\n\n");

  return cleaned.trim();
}

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function formatStandupText(text: string): string {
  const cleaned = cleanReportText(text);

  const normalized = cleaned.replace(
    /(Accomplishments|Challenges and Blockers|Technical Debt and Cleanups)/gi,
    "\n$1\n"
  );

  const lines = normalized.split("\n").map((l) => l.trim());
  const sections: Record<string, string[]> = {
    "Accomplishments": [],
    "Challenges and Blockers": [],
    "Technical Debt and Cleanups": [],
  };

  let current: string = "Accomplishments";
  for (const line of lines) {
    if (!line) continue;
    const match = SECTION_TITLES.find((title) => title.toLowerCase() === line.toLowerCase());
    if (match) {
      current = match;
      continue;
    }
    sections[current].push(line.replace(/^[-\s]+/, "").trim());
  }

  const formatted = SECTION_TITLES.map((title) => {
    const rawItems = sections[title].length
      ? sections[title]
      : [];

    const items = rawItems.length
      ? rawItems.flatMap((item) => item.includes(".") ? splitSentences(item) : [item])
      : ["No updates reported."];

    return [title, ...items.map((item) => `- ${item}`)].join("\n");
  }).join("\n\n");

  return formatted.trim();
}

export async function POST(request: Request) {
  try {
    const { owner, repo, commitShas, userId, model } = await request.json();
    const selectedModel = model || 'gemini-2.0-flash';

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
      const { fetchCommitDiff, cleanDiff } = require('@/lib/github');
      const diffPromises = commitShas.map((sha: string) => fetchCommitDiff(owner, repo, sha, githubToken));
      const diffs = await Promise.all(diffPromises);
      cleanedDiffs = cleanDiff(diffs.join('\n\n---\n\n'));
      commitsUsed = commitShas.length;
    } else {
      cleanedDiffs = await fetchRecentDiffs(owner, repo, githubToken);
      commitsUsed = cleanedDiffs ? 1 : 0; 
    }

    let summaryText = 'No recent activity found.';

    if (cleanedDiffs) {
      const prompt = `
        You are an Expert Technical Lead. Read the following code diffs and generate a professional, concise daily stand-up report.
        
        STRICT RULES:
        1. Use EXACTLY these three sections as Bold Headers (e.g. ### Accomplishments):
           ### Accomplishments
           ### Challenges and Blockers
           ### Technical Debt and Cleanups
        2. Do NOT use ANY emojis, symbols, or special characters.
        3. Add EXACTLY two blank lines between each section for clear spacing.
        4. Use ONLY bold headings and bullet points.
        5. Do NOT include any introductory or concluding remarks. Just the formatted sections.
        6. Use professional, clear English.

        CODE DIFF DATA:
        ${cleanedDiffs}
      `;

      try {
        if (selectedModel.startsWith('gemini')) {
          console.log(`Using Gemini model: ${selectedModel}`);
          const result = await geminiModel.generateContent(prompt);
          summaryText = result.response.text();
        } else {
          console.log(`Using Groq model: ${selectedModel}`);
          const chatCompletion = await groq.chat.completions.create({
            messages: [{ role: 'user', content: prompt }],
            model: selectedModel,
          });
          summaryText = chatCompletion.choices[0]?.message?.content || 'Failed to generate with Groq.';
        }
      } catch (aiError: any) {
        console.error('AI Model Failed, trying fallback...', aiError.message);
        // Fallback to a lightweight Groq model if the selected one fails
        try {
          const fallbackCompletion = await groq.chat.completions.create({
            messages: [{ role: 'user', content: prompt }],
            model: 'llama-3.1-8b-instant',
          });
          summaryText = fallbackCompletion.choices[0]?.message?.content || 'Fallback failed.';
        } catch (fallbackError: any) {
          throw new Error('All AI models failed to respond.');
        }
      }

      // Normalize and clean the final text
      summaryText = formatStandupText(summaryText);
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
