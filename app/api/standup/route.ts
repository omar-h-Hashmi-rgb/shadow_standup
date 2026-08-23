import { NextResponse } from "next/server";
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
      ? commits.filter((c: any) => commitShas.includes(c.sha))
      : commits.slice(0, 10);

    const commitMessages = recentCommits.map((c: any) => c.message);
    const author = recentCommits[0]?.author || "Unknown";

    let gitDiff = "";
    if (commitShas?.length) {
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
      branch: branch || "main",
      commitMessages,
      mlMetrics,
      gitDiff: gitDiff.slice(0, 50000),
    });

    const fullPrompt = `${ANALYSIS_PROMPT}\n\n---\n\nINPUT DATA:\n${promptInput}`;

    let rawResponse = "";
    const selectedModel = model || "gemini";

    try {
      if (selectedModel === "gemini" || selectedModel.startsWith("gemini")) {
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
          model: "llama-3.1-8b-instant",
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
      analysis = buildFallbackAnalysis({ author, repo, branch: branch || "main", commitMessages, rawResponse, mlMetrics });
    }

    const webhookResults: Record<string, boolean> = {};
    const activePlatforms: string[] = platforms || [];

    console.log("[standup] Delivering to:", activePlatforms);

    if (activePlatforms.includes("discord") || discordWebhook) {
      const url = discordWebhook || process.env.DISCORD_WEBHOOK_URL;
      if (url) {
        webhookResults.discord = await sendStandupToDiscord(url, analysis);
        console.log("[standup] Discord result:", webhookResults.discord);
      }
    }

    if (activePlatforms.includes("slack") || slackWebhook) {
      const url = slackWebhook || process.env.SLACK_WEBHOOK_URL;
      if (url) {
        webhookResults.slack = await sendStandupToSlack(url, analysis);
        console.log("[standup] Slack result:", webhookResults.slack);
      }
    }

    if (activePlatforms.includes("trello")) {
      const card = await createTrelloCard({
        name: `Standup: ${analysis.developer} — ${analysis.repository}`,
        desc: `Summary: ${analysis.summary}\n\nYesterday:\n${analysis.yesterday_progress.join("\n")}\n\nToday:\n${analysis.today_focus.join("\n")}`,
      });
      webhookResults.trello = card.success;
      console.log("[standup] Trello result:", card.success, card.url || card.error);
    }

    if (activePlatforms.includes("jira")) {
      const issue = await createJiraIssue({
        title: `Standup: ${analysis.developer} — ${analysis.repository}`,
        description: `Summary: ${analysis.summary}\n\nYesterday:\n${analysis.yesterday_progress.map((i) => "- " + i).join("\n")}\n\nToday:\n${analysis.today_focus.map((i) => "- " + i).join("\n")}`,
      });
      webhookResults.jira = issue.success;
      console.log("[standup] Jira result:", issue.success, issue.url || issue.error);
    }

    try {
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
    } catch (dbError: any) {
      console.error("[standup] Database insert failed:", dbError.message);
    }

    return NextResponse.json({
      success: true,
      analysis,
      webhooks: webhookResults,
    });
  } catch (error: any) {
    console.error("[standup] API error:", error.message);
    return NextResponse.json(
      { success: false, error: error.message || "Internal Server Error" },
      { status: 500 }
    );
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
