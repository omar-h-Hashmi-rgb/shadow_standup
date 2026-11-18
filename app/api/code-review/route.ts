import { NextResponse } from 'next/server';
<<<<<<< HEAD
import { authenticate, resolveGitHubToken } from '@/lib/auth';
import { buildReviewInput, type ReviewRequestBody } from '@/lib/review-input';
import { generateReviewText } from '@/lib/review-engine';
import {
  CODE_REVIEW_SYSTEM_PROMPT,
  SOURCE_REVIEW_ADDENDUM,
  UNTRUSTED_CONTENT_NOTICE,
  PARSE_FAILURE_BLOCKER,
  REVIEW_SCOPES,
  countFindings,
  emptyReviewResult,
  parseCodeReviewResponse,
  restrictFindingsToRange,
  type CodeReviewResult,
  type ReviewScope,
} from '@/lib/code-review';
import { sendToDiscord, sendToSlack, sendToTeams } from '@/lib/webhooks';
import { isTeamsConfigured } from '@/lib/teams';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { handleRouteError, jsonError, readJsonBody, MAX_BODY_BYTES, HttpError } from '@/lib/http';
import { enforceRateLimit } from '@/lib/rate-limit';
import { resolveModel } from '@/lib/validation';

interface CodeReviewBody extends ReviewRequestBody {
  model?: unknown;
  discordWebhook?: unknown;
  slackWebhook?: unknown;
  notifyTeams?: unknown;
}

const RISK_LEVELS = new Set(['low', 'medium', 'high', 'critical']);

/**
 * One endpoint for every review scope. `scope` selects what is reviewed
 * (commits | file | selection | lines | repo); omitting it keeps the original
 * commit-diff behaviour, so existing clients are unaffected. Everything after
 * input building — prompt, model call, parsing, notifications, persistence —
 * is shared by all scopes.
 */
export async function POST(request: Request) {
  const auth = await authenticate(request);
  if ('response' in auth) return auth.response;
  const { user } = auth;

  const limited = enforceRateLimit(request, 'ai', user.id);
  if (limited) return limited;

  try {
    const body = await readJsonBody<CodeReviewBody>(request, MAX_BODY_BYTES.large);

    const scope = (body.scope === undefined ? 'commits' : body.scope) as ReviewScope;
    if (!REVIEW_SCOPES.includes(scope)) throw new HttpError('Invalid review scope.', 400);

    const selectedModel = resolveModel(body.model, 'gemini-3.8-flash');

    // A pasted snippet needs no GitHub access; every other scope does.
    const isSnippet = scope === 'selection' && typeof body.code === 'string';
    let token: string | null = null;
    if (!isSnippet) {
      const resolved = await resolveGitHubToken(request, user.id);
      if (!resolved.token) return jsonError(resolved.error || 'GitHub token missing.', 401);
      token = resolved.token;
    }

    const input = await buildReviewInput(scope, body, token);

    const systemPrompt =
      CODE_REVIEW_SYSTEM_PROMPT + (input.isSource ? SOURCE_REVIEW_ADDENDUM : '') + UNTRUSTED_CONTENT_NOTICE;

    const rawResponse = await generateReviewText({
      systemPrompt,
      userPrompt: input.userPrompt,
      model: selectedModel,
    });

    const parsed = parseCodeReviewResponse(rawResponse);
    const reviewResult: CodeReviewResult = parsed ?? emptyReviewResult(rawResponse.slice(0, 2000), PARSE_FAILURE_BLOCKER);

    // Normalise fields the UI depends on, in case the model omitted/mangled them.
    reviewResult.blockers = Array.isArray(reviewResult.blockers) ? reviewResult.blockers.map(String) : [];
    reviewResult.approved = Boolean(reviewResult.approved);
    if (!RISK_LEVELS.has(reviewResult.riskLevel)) reviewResult.riskLevel = 'medium';

    // "Review only these lines" is enforced on the output, not just requested in the prompt.
    const dropped = input.lineBounds
      ? restrictFindingsToRange(reviewResult, input.lineBounds.start, input.lineBounds.end)
      : 0;
    reviewResult.meta = { ...input.meta, droppedOutOfRange: dropped || undefined };

    const totalFindings = countFindings(reviewResult);
    const scopeLabel = input.scope === 'commits' ? undefined : input.meta.label;

    // ---- notifications: each is independent; one failing never affects another ----
    const webhookResults: { discord?: boolean; slack?: boolean; teams?: boolean } = {};
    const webhookSkipped: { teams?: 'not_configured' } = {};

    if (typeof body.discordWebhook === 'string' && body.discordWebhook) {
      webhookResults.discord = await sendToDiscord(body.discordWebhook, reviewResult, input.repo, input.owner, scopeLabel);
    }
    if (typeof body.slackWebhook === 'string' && body.slackWebhook) {
      webhookResults.slack = await sendToSlack(body.slackWebhook, reviewResult, input.repo, input.owner, scopeLabel);
    }
    if (body.notifyTeams === true) {
      if (isTeamsConfigured()) {
        webhookResults.teams = await sendToTeams(reviewResult, input.repo, input.owner, scopeLabel);
      } else {
        webhookSkipped.teams = 'not_configured';
      }
    }

    // ---- persistence (scoped to the verified user) ----
    try {
      const { error } = await getSupabaseAdmin().from('code_reviews').insert({
        user_id: user.id,
        owner: input.owner,
        repo: input.repo,
        commit_shas: input.commitShas,
        risk_level: reviewResult.riskLevel,
        approved: reviewResult.approved,
        findings_count: totalFindings,
        summary: reviewResult.summary,
        result: reviewResult,
      });
      if (error) console.error('Database insert failed:', error.message);
    } catch (dbError) {
      console.error('Database insert failed:', dbError instanceof Error ? dbError.message : dbError);
=======
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
>>>>>>> origin/main
    }

    return NextResponse.json({
      success: true,
      review: reviewResult,
      findingsCount: totalFindings,
      webhooks: webhookResults,
<<<<<<< HEAD
      webhookSkipped,
    });
  } catch (error) {
    return handleRouteError(error, 'code-review');
  }
}
=======
    });
  } catch (error: any) {
    console.error('Code review API error:', error.message);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
>>>>>>> origin/main
