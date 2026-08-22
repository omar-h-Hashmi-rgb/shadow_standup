import axios from 'axios';
import type { CodeReviewResult } from './code-review';

function formatReviewForWebhook(review: CodeReviewResult, repo: string, owner: string): string {
  const riskEmoji: Record<string, string> = {
    low: '🟢',
    medium: '🟡',
    high: '🟠',
    critical: '🔴',
  };

  const lines: string[] = [
    `${riskEmoji[review.riskLevel] || '⚪'} **Code Review — ${owner}/${repo}**`,
    `Risk: **${review.riskLevel.toUpperCase()}** | Approved: **${review.approved ? 'Yes' : 'No'}**`,
    '',
    review.summary,
    '',
  ];

  const allFindings = [
    ...review.categories.security.findings.map(f => ({ ...f, category: 'Security', badge: f.severity })),
    ...review.categories.codeQuality.findings.map(f => ({ ...f, category: 'Code Quality', badge: f.type })),
    ...review.categories.performance.findings.map(f => ({ ...f, category: 'Performance', badge: f.type })),
    ...review.categories.bestPractices.findings.map(f => ({ ...f, category: 'Best Practices', badge: f.type })),
  ];

  if (allFindings.length > 0) {
    lines.push(`**${allFindings.length} finding(s):**`);
    lines.push('');
    allFindings.forEach((f, i) => {
      lines.push(`${i + 1}. [${f.category}] **${f.title}**`);
      lines.push(`   ${f.file}:${f.line} — ${f.description}`);
      lines.push('');
    });
  }

  if (review.blockers.length > 0) {
    lines.push('**Blockers:**');
    review.blockers.forEach(b => lines.push(`- ${b}`));
  }

  return lines.join('\n');
}

function formatReviewForSlack(review: CodeReviewResult, repo: string, owner: string): object {
  const riskColor: Record<string, string> = {
    low: '#34d399',
    medium: '#fbbf24',
    high: '#f97316',
    critical: '#ef4444',
  };

  const allFindings = [
    ...review.categories.security.findings,
    ...review.categories.codeQuality.findings,
    ...review.categories.performance.findings,
    ...review.categories.bestPractices.findings,
  ];

  const blocks: object[] = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: `Code Review: ${owner}/${repo}`,
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Risk Level:* ${review.riskLevel.toUpperCase()} | *Approved:* ${review.approved ? 'Yes :white_check_mark:' : 'No :x:'}`,
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: review.summary,
      },
    },
    { type: 'divider' },
  ];

  if (allFindings.length > 0) {
    const findingText = allFindings
      .map((f, i) => `${i + 1}. *${f.title}* — \`${f.file}:${f.line}\`\n    ${f.description}`)
      .join('\n\n');

    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*${allFindings.length} finding(s):*\n${findingText}`,
      },
    });
  }

  if (review.blockers.length > 0) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Blockers:*\n${review.blockers.map(b => `• ${b}`).join('\n')}`,
      },
    });
  }

  return {
    attachments: [
      {
        color: riskColor[review.riskLevel] || '#6b7280',
        blocks,
      },
    ],
  };
}

export async function sendToDiscord(webhookUrl: string, review: CodeReviewResult, repo: string, owner: string): Promise<boolean> {
  try {
    const content = formatReviewForWebhook(review, repo, owner);
    await axios.post(webhookUrl, { content }, { timeout: 10000 });
    return true;
  } catch (error: any) {
    console.error('Discord webhook failed:', error.message);
    return false;
  }
}

export async function sendToSlack(webhookUrl: string, review: CodeReviewResult, repo: string, owner: string): Promise<boolean> {
  try {
    const payload = formatReviewForSlack(review, repo, owner);
    await axios.post(webhookUrl, payload, { timeout: 10000 });
    return true;
  } catch (error: any) {
    console.error('Slack webhook failed:', error.message);
    return false;
  }
}
