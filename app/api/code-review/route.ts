import { NextResponse } from 'next/server';
import { resolveGitHubToken } from '@/lib/auth';
import { fetchCommitDiff } from '@/lib/github';
import { buildStructuredReviewDiff } from '@/lib/diff-processing';
import { model as geminiModel } from '@/lib/gemini';
import { groq } from '@/lib/groq';
import { CODE_REVIEW_SYSTEM_PROMPT, parseCodeReviewResponse, type CodeReviewResult } from '@/lib/code-review';
import { sendToDiscord, sendToSlack } from '@/lib/webhooks';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    const { owner, repo, commitShas, userId, model, discordWebhook, slackWebhook } = await request.json();
    const selectedModel = model || 'gemini-2.0-flash';

    if (!owner || !repo || !commitShas?.length) {
      return NextResponse.json(
        { success: false, error: 'Owner, repo, and at least one commit SHA are required.' },
        { status: 400 }
      );
    }

    const { token, error: tokenError } = await resolveGitHubToken(request);
    if (!token) {
      return NextResponse.json({ success: false, error: tokenError }, { status: 401 });
    }

    const diffPromises = commitShas.map((sha: string) => fetchCommitDiff(owner, repo, sha, token));
    const diffs = await Promise.all(diffPromises);
    const { diffText, skippedFiles, reviewedFiles } = buildStructuredReviewDiff(diffs);

    if (!diffText) {
      return NextResponse.json({ success: false, error: 'No diff data found for the selected commits.' }, { status: 400 });
    }

    const userPrompt = `Review this code diff from ${owner}/${repo}. ${reviewedFiles} file(s) are included below${skippedFiles.length ? `, ${skippedFiles.length} file(s) were omitted for size and are listed at the end` : ''}.\n\nDIFF:\n${diffText}`;

    let rawResponse = '';

    try {
      if (selectedModel.startsWith('gemini')) {
        const result = await geminiModel.generateContent({
          contents: [{ role: 'user', parts: [{ text: CODE_REVIEW_SYSTEM_PROMPT + '\n\n' + userPrompt }] }],
        });
        rawResponse = result.response.text();
      } else {
        const chatCompletion = await groq.chat.completions.create({
          messages: [
            { role: 'system', content: CODE_REVIEW_SYSTEM_PROMPT },
            { role: 'user', content: userPrompt },
          ],
          model: selectedModel,
          temperature: 0.3,
        });
        rawResponse = chatCompletion.choices[0]?.message?.content || '';
      }
    } catch (aiError: any) {
      console.error('AI Model Failed, trying fallback...', aiError.message);
      try {
        const fallbackCompletion = await groq.chat.completions.create({
          messages: [
            { role: 'system', content: CODE_REVIEW_SYSTEM_PROMPT },
            { role: 'user', content: userPrompt },
          ],
          model: 'llama-3.1-8b-instant',
          temperature: 0.3,
        });
        rawResponse = fallbackCompletion.choices[0]?.message?.content || '';
      } catch {
        throw new Error('All AI models failed to respond.');
      }
    }

    const parsed = parseCodeReviewResponse(rawResponse);

    let reviewResult: CodeReviewResult;
    if (parsed) {
      reviewResult = parsed;
    } else {
      reviewResult = {
        summary: rawResponse.slice(0, 2000),
        riskLevel: 'medium',
        categories: {
          security: { findings: [] },
          codeQuality: { findings: [] },
          performance: { findings: [] },
          bestPractices: { findings: [] },
        },
        approved: false,
        blockers: ['AI response could not be parsed as structured JSON.'],
      };
    }

    const totalFindings =
      reviewResult.categories.security.findings.length +
      reviewResult.categories.codeQuality.findings.length +
      reviewResult.categories.performance.findings.length +
      reviewResult.categories.bestPractices.findings.length;

    const webhookResults: { discord?: boolean; slack?: boolean } = {};

    if (discordWebhook) {
      webhookResults.discord = await sendToDiscord(discordWebhook, reviewResult, repo, owner);
    }
    if (slackWebhook) {
      webhookResults.slack = await sendToSlack(slackWebhook, reviewResult, repo, owner);
    }

    try {
      if (userId) {
        await supabaseAdmin.from('code_reviews').insert({
          user_id: userId,
          owner,
          repo,
          commit_shas: commitShas,
          risk_level: reviewResult.riskLevel,
          approved: reviewResult.approved,
          findings_count: totalFindings,
          summary: reviewResult.summary,
          result: reviewResult,
        });
      }
    } catch (dbError: any) {
      console.error('Database insert failed:', dbError.message);
    }

    return NextResponse.json({
      success: true,
      review: reviewResult,
      findingsCount: totalFindings,
      webhooks: webhookResults,
    });
  } catch (error: any) {
    console.error('Code review API error:', error.message);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}