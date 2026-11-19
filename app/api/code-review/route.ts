import { NextResponse } from 'next/server';

// Fetches GitHub content then runs an LLM call — bound it explicitly so a
// stalled upstream cannot run past the platform's function limit.
export const maxDuration = 300;
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
    }

    return NextResponse.json({
      success: true,
      review: reviewResult,
      findingsCount: totalFindings,
      webhooks: webhookResults,
      webhookSkipped,
    });
  } catch (error) {
    return handleRouteError(error, 'code-review');
  }
}
