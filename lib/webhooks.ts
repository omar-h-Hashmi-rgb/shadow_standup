import axios from "axios";
import FormData from "form-data";
import { renderToBuffer } from "@react-pdf/renderer";
import type { CodeReviewResult } from "./code-review";
import type { StandupAnalysis } from "./prompts";
import { formatForSlack, formatForDiscord } from "./platform-adapter";
import { StandupPDFReport } from "./pdf-report";

// ===== Code Review Webhooks =====

function formatReviewForWebhook(review: CodeReviewResult, repo: string, owner: string): string {
  const riskEmoji: Record<string, string> = {
    low: "🟢",
    medium: "🟡",
    high: "🟠",
    critical: "🔴",
  };

  const lines: string[] = [
    `${riskEmoji[review.riskLevel] || "⚪"} **Code Review — ${owner}/${repo}**`,
    `Risk: **${review.riskLevel.toUpperCase()}** | Approved: **${review.approved ? "Yes" : "No"}**`,
    "",
    review.summary,
    "",
  ];

  const allFindings = [
    ...review.categories.security.findings.map((f) => ({ ...f, category: "Security" })),
    ...review.categories.codeQuality.findings.map((f) => ({ ...f, category: "Code Quality" })),
    ...review.categories.performance.findings.map((f) => ({ ...f, category: "Performance" })),
    ...review.categories.bestPractices.findings.map((f) => ({ ...f, category: "Best Practices" })),
  ];

  if (allFindings.length > 0) {
    lines.push(`**${allFindings.length} finding(s):**`);
    lines.push("");
    allFindings.forEach((f, i) => {
      lines.push(`${i + 1}. [${f.category}] **${f.title}**`);
      lines.push(`   ${f.file}:${f.line} — ${f.description}`);
      lines.push("");
    });
  }

  if (review.blockers.length > 0) {
    lines.push("**Blockers:**");
    review.blockers.forEach((b) => lines.push(`- ${b}`));
  }

  return lines.join("\n");
}

export async function sendCodeReviewToDiscord(
  webhookUrl: string,
  review: CodeReviewResult,
  repo: string,
  owner: string
): Promise<boolean> {
  try {
    const content = formatReviewForWebhook(review, repo, owner);
    await axios.post(webhookUrl, { content }, { timeout: 10000 });
    return true;
  } catch (error: any) {
    console.error("Discord webhook failed:", error.message);
    return false;
  }
}

export async function sendCodeReviewToSlack(
  webhookUrl: string,
  review: CodeReviewResult,
  repo: string,
  owner: string
): Promise<boolean> {
  try {
    await axios.post(webhookUrl, { text: formatReviewForWebhook(review, repo, owner) }, { timeout: 10000 });
    return true;
  } catch (error: any) {
    console.error("Slack webhook failed:", error.message);
    return false;
  }
}

// ===== Standup Webhooks =====

async function generateStandupPdf(analysis: StandupAnalysis): Promise<Buffer> {
  const buffer = await renderToBuffer(<StandupPDFReport analysis={analysis} />);
  return buffer;
}

export async function sendStandupToDiscord(
  webhookUrl: string,
  analysis: StandupAnalysis
): Promise<boolean> {
  try {
    const payload = formatForDiscord(analysis);
    await axios.post(webhookUrl, payload, { timeout: 15000 });

    try {
      const pdfBuffer = await generateStandupPdf(analysis);
      const filename = `standup-${analysis.repository}-${new Date().toISOString().split("T")[0]}.pdf`;
      const form = new FormData();
      form.append("file", pdfBuffer, { filename, contentType: "application/pdf" });
      form.append("payload_json", JSON.stringify({ content: `📄 PDF report for ${analysis.repository}` }));

      await axios.post(webhookUrl, form, {
        headers: form.getHeaders(),
        timeout: 30000,
      });
    } catch (pdfError: any) {
      console.error("Discord PDF upload failed (text was sent):", pdfError.message);
    }

    return true;
  } catch (error: any) {
    console.error("Discord standup webhook failed:", error.message);
    return false;
  }
}

export async function sendStandupToSlack(
  webhookUrl: string,
  analysis: StandupAnalysis
): Promise<boolean> {
  try {
    const text = formatForSlack(analysis);
    await axios.post(webhookUrl, { text }, { timeout: 15000 });

    try {
      const pdfBuffer = await generateStandupPdf(analysis);
      const filename = `standup-${analysis.repository}-${new Date().toISOString().split("T")[0]}.pdf`;
      const form = new FormData();
      form.append("file", pdfBuffer, { filename, contentType: "application/pdf" });
      form.append("initial_comment", `📄 PDF report for ${analysis.repository}`);
      form.append("channels", "standup-reports");

      await axios.post("https://slack.com/api/files.upload", form, {
        headers: {
          ...form.getHeaders(),
          Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN || ""}`,
        },
        timeout: 30000,
      });
    } catch (pdfError: any) {
      console.error("Slack PDF upload failed (text was sent):", pdfError.message);
    }

    return true;
  } catch (error: any) {
    console.error("Slack standup webhook failed:", error.message);
    return false;
  }
}
