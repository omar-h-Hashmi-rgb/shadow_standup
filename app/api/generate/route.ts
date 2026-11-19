import { NextResponse } from 'next/server';

// Fetches GitHub diffs then runs an LLM call — bound it explicitly so a
// stalled upstream cannot run past the platform's function limit.
export const maxDuration = 300;
import { fetchRecentDiffs, fetchCommitDiff, cleanDiff } from '@/lib/github';
import { groq } from '@/lib/groq';
import { authenticate, resolveGitHubToken } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { HttpError, handleRouteError, jsonError, readJsonBody, MAX_BODY_BYTES } from '@/lib/http';
import { enforceRateLimit } from '@/lib/rate-limit';
import { assertOwnerRepo, assertShas, resolveModel } from '@/lib/validation';

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
  const auth = await authenticate(request);
  if ('response' in auth) return auth.response;
  const { user } = auth;

  const limited = enforceRateLimit(request, 'ai', user.id);
  if (limited) return limited;

  try {
    const body = await readJsonBody<{ owner?: unknown; repo?: unknown; commitShas?: unknown; model?: unknown }>(
      request,
      MAX_BODY_BYTES.medium
    );
    const { owner, repo } = assertOwnerRepo(body.owner, body.repo);
    const commitShas = assertShas(body.commitShas);
    const selectedModel = resolveModel(body.model, 'gemini-3.8-flash');

    const { token, error: tokenError } = await resolveGitHubToken(request, user.id);
    if (!token) return jsonError(tokenError || 'GitHub token missing.', 401);

    let cleanedDiffs = '';
    let commitsUsed = 0;

    if (commitShas.length > 0) {
      const diffs = await Promise.all(commitShas.map((sha: string) => fetchCommitDiff(owner, repo, sha, token)));
      cleanedDiffs = cleanDiff(diffs.join('\n\n---\n\n'));
      commitsUsed = commitShas.length;
    } else {
      cleanedDiffs = await fetchRecentDiffs(owner, repo, token);
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
          const { model: geminiModel } = await import('@/lib/gemini');
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
            model: 'openai/gpt-oss-120b',
          });
          summaryText = fallbackCompletion.choices[0]?.message?.content || 'Fallback failed.';
        } catch (fallbackError: any) {
          throw new HttpError('All AI models failed to respond.', 502);
        }
      }

      // Normalize and clean the final text
      summaryText = formatStandupText(summaryText);
    }

    // Save to Supabase (scoped to the verified user)
    try {
      const { data, error } = await getSupabaseAdmin()
        .from('history')
        .insert([{ user_id: user.id, owner, repo, content: summaryText, commits_count: commitsUsed }])
        .select()
        .single();

      if (error) console.error('Database Sync Error:', error.message);

      return NextResponse.json({ success: true, summary: summaryText, data });
    } catch (dbError: any) {
      console.error('Database Insertion Failed:', dbError.message);
      return NextResponse.json({
        success: true,
        summary: summaryText,
        warning: 'Failed to sync with database history.'
      });
    }

  } catch (error) {
    return handleRouteError(error, 'generate');
  }
}
