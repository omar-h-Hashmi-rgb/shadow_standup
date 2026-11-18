import { NextResponse } from "next/server";
<<<<<<< HEAD
import { authenticate, resolveGitHubToken } from "@/lib/auth";
import { fetchRecentDiffs, fetchCommits, cleanDiff } from "@/lib/github";
import { groq } from "@/lib/groq";
import { ANALYSIS_PROMPT, buildAnalysisInput, parseStandupAnalysis, type StandupAnalysis } from "@/lib/prompts";
import { sendStandupToDiscord, sendStandupToSlack, sendStandupToTeams } from "@/lib/webhooks";
import { isTeamsConfigured } from "@/lib/teams";
import { createTrelloCard } from "@/lib/trello";
import { createJiraIssue } from "@/lib/jira";
import { loadUserSettingsDecrypted } from "@/lib/user-settings";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { HttpError, handleRouteError, jsonError, readJsonBody, MAX_BODY_BYTES } from "@/lib/http";
import { enforceRateLimit } from "@/lib/rate-limit";
import { assertOwnerRepo, assertShas, clampString, resolveModel } from "@/lib/validation";

const PLATFORMS = ["discord", "slack", "trello", "jira", "teams"] as const;
type Platform = (typeof PLATFORMS)[number];
=======
import { resolveGitHubToken } from "@/lib/auth";
import { fetchRecentDiffs, fetchCommits, cleanDiff } from "@/lib/github";
import { generateWithFallback } from "@/lib/gemini";
import { groq } from "@/lib/groq";
import { ANALYSIS_PROMPT, buildAnalysisInput, parseStandupAnalysis, type StandupAnalysis } from "@/lib/prompts";
import { sendStandupToDiscord, sendStandupToSlack } from "@/lib/webhooks";
import { createTrelloCard } from "@/lib/trello";
import { createJiraIssue } from "@/lib/jira";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
>>>>>>> origin/main

function buildFallbackAnalysis(params: {
  author: string;
  repo: string;
  branch: string;
  commitMessages: string[];
  rawResponse: string;
  mlMetrics: { files_changed: number; lines_added: number; lines_removed: number; complexity_estimate: number };
}): StandupAnalysis {
  return {
    developer: params.author,
    repository: params.repo,
    branch: params.branch,
    summary: params.rawResponse.slice(0, 500) || `Standup for ${params.repo} — ${params.commitMessages.length} commits analyzed.`,
    yesterday_progress: params.commitMessages.slice(0, 10),
    today_focus: ["Continue development based on review findings"],
    blockers_and_risks: [],
    code_review: {
      complexity_score: params.mlMetrics.complexity_estimate,
      code_health: params.mlMetrics.complexity_estimate <= 3 ? "High" : params.mlMetrics.complexity_estimate <= 6 ? "Medium" : "Low",
      highlights: [`${params.mlMetrics.files_changed} files changed`, `+${params.mlMetrics.lines_added} / -${params.mlMetrics.lines_removed} lines`],
      risks: [],
      security_or_debt_flags: [],
    },
  };
}

export async function POST(request: Request) {
<<<<<<< HEAD
  const auth = await authenticate(request);
  if ("response" in auth) return auth.response;
  const { user } = auth;

  const limited = enforceRateLimit(request, "ai", user.id);
  if (limited) return limited;

  try {
    const body = await readJsonBody<{
      owner?: unknown;
      repo?: unknown;
      branch?: unknown;
      model?: unknown;
      commitShas?: unknown;
      platforms?: unknown;
      discordWebhook?: unknown;
      slackWebhook?: unknown;
    }>(request, MAX_BODY_BYTES.medium);

    const { owner, repo } = assertOwnerRepo(body.owner, body.repo);
    const commitShas = assertShas(body.commitShas);
    const branch = clampString(body.branch, 100).trim() || "main";
    const selectedModel = resolveModel(body.model, "gemini");

    if (body.platforms !== undefined && !Array.isArray(body.platforms)) {
      throw new HttpError("platforms must be an array.", 400);
    }
    const activePlatforms: Platform[] = ((body.platforms as unknown[]) || []).filter(
      (p): p is Platform => typeof p === "string" && (PLATFORMS as readonly string[]).includes(p)
    );
    const discordWebhook = typeof body.discordWebhook === "string" ? body.discordWebhook : "";
    const slackWebhook = typeof body.slackWebhook === "string" ? body.slackWebhook : "";

    console.log("[standup] Received:", { owner, repo, platforms: activePlatforms, commitShas: commitShas.length });

    const { token, error: tokenError } = await resolveGitHubToken(request, user.id);
    if (!token) return jsonError(tokenError || "GitHub token missing.", 401);

    const commits = await fetchCommits(owner, repo, token);
    const recentCommits = commitShas.length
=======
  try {
    const {
      owner,
      repo,
      branch,
      userId,
      model,
      commitShas,
      platforms,
      discordWebhook,
      slackWebhook,
    } = await request.json();

    console.log("[standup] Received:", { owner, repo, platforms, commitShas: commitShas?.length });

    if (!owner || !repo) {
      return NextResponse.json(
        { success: false, error: "Owner and repo are required." },
        { status: 400 }
      );
    }

    const { token, error: tokenError } = await resolveGitHubToken(request);
    if (!token) {
      return NextResponse.json({ success: false, error: tokenError }, { status: 401 });
    }

    const commits = await fetchCommits(owner, repo, token);
    const recentCommits = commitShas?.length
>>>>>>> origin/main
      ? commits.filter((c: any) => commitShas.includes(c.sha))
      : commits.slice(0, 10);

    const commitMessages = recentCommits.map((c: any) => c.message);
    const author = recentCommits[0]?.author || "Unknown";

    let gitDiff = "";
<<<<<<< HEAD
    if (commitShas.length) {
=======
    if (commitShas?.length) {
>>>>>>> origin/main
      const diffs = await Promise.all(
        commitShas.map((sha: string) => fetchCommitDiffSafe(owner, repo, sha, token))
      );
      gitDiff = cleanDiff(diffs.join("\n\n---\n\n"));
    } else {
      gitDiff = await fetchRecentDiffs(owner, repo, token);
    }

    const mlMetrics = {
      files_changed: countFilesChanged(gitDiff),
      lines_added: countLinesAdded(gitDiff),
      lines_removed: countLinesRemoved(gitDiff),
      complexity_estimate: estimateComplexity(gitDiff),
    };

    const promptInput = buildAnalysisInput({
      author,
      repository: repo,
<<<<<<< HEAD
      branch,
=======
      branch: branch || "main",
>>>>>>> origin/main
      commitMessages,
      mlMetrics,
      gitDiff: gitDiff.slice(0, 50000),
    });

    const fullPrompt = `${ANALYSIS_PROMPT}\n\n---\n\nINPUT DATA:\n${promptInput}`;

    let rawResponse = "";
<<<<<<< HEAD

    try {
      if (selectedModel === "gemini" || selectedModel.startsWith("gemini")) {
        // Lazy import: a missing Gemini key only affects Gemini requests (which fall back to Groq below).
        const { generateWithFallback } = await import("@/lib/gemini");
=======
    const selectedModel = model || "gemini";

    try {
      if (selectedModel === "gemini" || selectedModel.startsWith("gemini")) {
>>>>>>> origin/main
        rawResponse = await generateWithFallback(fullPrompt, {
          temperature: 0.1,
          responseMimeType: "application/json",
        });
      } else {
        const chatCompletion = await groq.chat.completions.create({
          messages: [
            { role: "system", content: ANALYSIS_PROMPT },
            { role: "user", content: promptInput },
          ],
          model: selectedModel,
          temperature: 0.1,
        });
        rawResponse = chatCompletion.choices[0]?.message?.content || "";
      }
      console.log("[standup] AI response length:", rawResponse.length);
    } catch (aiError: any) {
      console.error("[standup] AI failed, trying Groq fallback...", aiError.message);
      try {
        const fallback = await groq.chat.completions.create({
          messages: [
            { role: "system", content: ANALYSIS_PROMPT },
            { role: "user", content: promptInput },
          ],
<<<<<<< HEAD
          model: "openai/gpt-oss-120b",
=======
          model: "llama-3.1-8b-instant",
>>>>>>> origin/main
          temperature: 0.1,
        });
        rawResponse = fallback.choices[0]?.message?.content || "";
      } catch (groqError: any) {
        console.error("[standup] Groq also failed:", groqError.message);
      }
    }

    let analysis = parseStandupAnalysis(rawResponse);

    if (!analysis) {
      console.log("[standup] Parse failed, using fallback analysis");
<<<<<<< HEAD
      analysis = buildFallbackAnalysis({ author, repo, branch, commitMessages, rawResponse, mlMetrics });
    }

    // Stored credentials (decrypted server-side only). Falls back to env defaults below.
    const userSettings = await loadUserSettingsDecrypted(user.id);

    // Each delivery is independent: a failure (or missing config) in one never affects the others.
    const webhookResults: Record<string, boolean> = {};
    const webhookSkipped: Record<string, string> = {};
=======
      analysis = buildFallbackAnalysis({ author, repo, branch: branch || "main", commitMessages, rawResponse, mlMetrics });
    }

    let userSettings: Record<string, string> = {};
    if (userId) {
      try {
        const { data: settingsData } = await supabaseAdmin
          .from("user_settings")
          .select("*")
          .eq("user_id", userId)
          .single();
        if (settingsData) userSettings = settingsData;
      } catch (e) {
        console.log("[standup] No user settings found, using env defaults");
      }
    }

    const webhookResults: Record<string, boolean> = {};
    const activePlatforms: string[] = platforms || [];
>>>>>>> origin/main

    console.log("[standup] Delivering to:", activePlatforms);

    if (activePlatforms.includes("discord") || discordWebhook) {
      const url = discordWebhook || userSettings.discord_webhook_url || process.env.DISCORD_WEBHOOK_URL;
      if (url) {
        webhookResults.discord = await sendStandupToDiscord(url, analysis);
        console.log("[standup] Discord result:", webhookResults.discord);
      }
    }

    if (activePlatforms.includes("slack") || slackWebhook) {
      const url = slackWebhook || userSettings.slack_webhook_url || process.env.SLACK_WEBHOOK_URL;
      if (url) {
        webhookResults.slack = await sendStandupToSlack(url, analysis);
        console.log("[standup] Slack result:", webhookResults.slack);
      }
    }

<<<<<<< HEAD
    if (activePlatforms.includes("teams")) {
      if (isTeamsConfigured()) {
        webhookResults.teams = await sendStandupToTeams(analysis);
        console.log("[standup] Teams result:", webhookResults.teams);
      } else {
        webhookSkipped.teams = "not_configured";
      }
    }

=======
>>>>>>> origin/main
    if (activePlatforms.includes("trello")) {
      const card = await createTrelloCard({
        name: `Standup: ${analysis.developer} — ${analysis.repository}`,
        desc: `Summary: ${analysis.summary}\n\nYesterday:\n${analysis.yesterday_progress.join("\n")}\n\nToday:\n${analysis.today_focus.join("\n")}`,
        credentials: {
          apiKey: userSettings.trello_api_key,
          token: userSettings.trello_token,
          listId: userSettings.trello_list_id,
        },
      });
      webhookResults.trello = card.success;
      console.log("[standup] Trello result:", card.success, card.url || card.error);
    }

    if (activePlatforms.includes("jira")) {
      const issue = await createJiraIssue({
        title: `Standup: ${analysis.developer} — ${analysis.repository}`,
        description: `Summary: ${analysis.summary}\n\nYesterday:\n${analysis.yesterday_progress.map((i) => "- " + i).join("\n")}\n\nToday:\n${analysis.today_focus.map((i) => "- " + i).join("\n")}`,
        credentials: {
          domain: userSettings.jira_domain,
          email: userSettings.jira_email,
          token: userSettings.jira_api_token,
          projectKey: userSettings.jira_project_key,
        },
      });
      webhookResults.jira = issue.success;
      console.log("[standup] Jira result:", issue.success, issue.url || issue.error);
    }

    try {
<<<<<<< HEAD
      const { error } = await getSupabaseAdmin().from("standups").insert({
        user_id: user.id,
        owner,
        repo,
        branch: analysis.branch,
        author: analysis.developer,
        summary: analysis.summary,
        complexity_score: analysis.code_review.complexity_score,
        code_health: analysis.code_review.code_health,
        yesterday_progress: analysis.yesterday_progress,
        today_focus: analysis.today_focus,
        blockers_and_risks: analysis.blockers_and_risks,
        code_review: analysis.code_review,
        platforms_delivered: Object.keys(webhookResults).filter((k) => webhookResults[k]),
      });
      if (error) console.error("[standup] Database insert failed:", error.message);
=======
      if (userId) {
        await supabaseAdmin.from("standups").insert({
          user_id: userId,
          owner,
          repo,
          branch: analysis.branch,
          author: analysis.developer,
          summary: analysis.summary,
          complexity_score: analysis.code_review.complexity_score,
          code_health: analysis.code_review.code_health,
          yesterday_progress: analysis.yesterday_progress,
          today_focus: analysis.today_focus,
          blockers_and_risks: analysis.blockers_and_risks,
          code_review: analysis.code_review,
          platforms_delivered: Object.keys(webhookResults).filter((k) => webhookResults[k]),
        });
      }
>>>>>>> origin/main
    } catch (dbError: any) {
      console.error("[standup] Database insert failed:", dbError.message);
    }

    return NextResponse.json({
      success: true,
      analysis,
      webhooks: webhookResults,
<<<<<<< HEAD
      webhookSkipped,
    });
  } catch (error) {
    return handleRouteError(error, "standup");
=======
    });
  } catch (error: any) {
    console.error("[standup] API error:", error.message);
    return NextResponse.json(
      { success: false, error: error.message || "Internal Server Error" },
      { status: 500 }
    );
>>>>>>> origin/main
  }
}

async function fetchCommitDiffSafe(owner: string, repo: string, sha: string, token: string): Promise<string> {
  try {
    const { fetchCommitDiff } = await import("@/lib/github");
    return await fetchCommitDiff(owner, repo, sha, token);
  } catch {
    return "";
  }
}

function countFilesChanged(diff: string): number {
  return (diff.match(/^diff --git/gm) || []).length;
}

function countLinesAdded(diff: string): number {
  return (diff.match(/^\+[^+]/gm) || []).length;
}

function countLinesRemoved(diff: string): number {
  return (diff.match(/^-[^-]/gm) || []).length;
}

function estimateComplexity(diff: string): number {
  const files = countFilesChanged(diff);
  const added = countLinesAdded(diff);
  const removed = countLinesRemoved(diff);
  const total = added + removed;
  if (total < 50 && files < 3) return 2;
  if (total < 200 && files < 8) return 4;
  if (total < 500 && files < 15) return 6;
  if (total < 1000 && files < 25) return 8;
  return 10;
}
