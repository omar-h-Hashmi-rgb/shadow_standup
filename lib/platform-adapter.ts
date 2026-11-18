import type { StandupAnalysis } from "./prompts";

const HEALTH_EMOJI: Record<string, string> = {
  High: "🟢",
  Medium: "🟡",
  Low: "🔴",
};

export function formatForSlack(analysis: StandupAnalysis): string {
  const lines: string[] = [
    `*Standup Report — ${analysis.developer}*`,
    `_${analysis.repository} · ${analysis.branch}_`,
    "",
    `*Summary:* ${analysis.summary}`,
    "",
  ];

  if (analysis.yesterday_progress.length > 0) {
    lines.push("*Yesterday's Progress:*");
    analysis.yesterday_progress.forEach((item) => {
      lines.push(`  ✓ ${item}`);
    });
    lines.push("");
  }

  if (analysis.today_focus.length > 0) {
    lines.push("*Today's Focus:*");
    analysis.today_focus.forEach((item) => {
      lines.push(`  → ${item}`);
    });
    lines.push("");
  }

  if (analysis.blockers_and_risks.length > 0) {
    lines.push("*Blockers & Risks:*");
    analysis.blockers_and_risks.forEach((item) => {
      lines.push(`  ⚠ ${item}`);
    });
    lines.push("");
  }

  const cr = analysis.code_review;
  lines.push(
    `*Code Health:* ${HEALTH_EMOJI[cr.code_health] || "⚪"} ${cr.code_health} | *Complexity:* ${cr.complexity_score}/10`
  );

  return lines.join("\n");
}

export function formatForDiscord(analysis: StandupAnalysis): object {
  const healthColor: Record<string, number> = {
    High: 0x34d399,
    Medium: 0xfbbf24,
    Low: 0xf87171,
  };

  const fields: object[] = [];

  if (analysis.yesterday_progress.length > 0) {
    fields.push({
      name: "Yesterday's Progress",
      value: analysis.yesterday_progress.map((i) => `\`${i}\``).join("\n"),
      inline: false,
    });
  }

  if (analysis.today_focus.length > 0) {
    fields.push({
      name: "Today's Focus",
      value: analysis.today_focus.map((i) => `\`${i}\``).join("\n"),
      inline: false,
    });
  }

  if (analysis.blockers_and_risks.length > 0) {
    fields.push({
      name: "Blockers & Risks",
      value: analysis.blockers_and_risks.map((i) => `\`${i}\``).join("\n"),
      inline: false,
    });
  }

  return {
    embeds: [
      {
        title: `Standup Report — ${analysis.developer}`,
        description: analysis.summary,
        color: healthColor[analysis.code_review.code_health] || 0x6b7280,
        fields,
        footer: {
          text: `${analysis.repository} · ${analysis.branch} · Health: ${analysis.code_review.code_health} · Complexity: ${analysis.code_review.complexity_score}/10`,
        },
        timestamp: new Date().toISOString(),
      },
    ],
  };
}

export function formatForTrello(analysis: StandupAnalysis): { name: string; desc: string } {
  const sections: string[] = [`* Summary *\n${analysis.summary}`];

  if (analysis.yesterday_progress.length > 0) {
    sections.push(`* Yesterday's Progress *\n${analysis.yesterday_progress.join("\n")}`);
  }
  if (analysis.today_focus.length > 0) {
    sections.push(`* Today's Focus *\n${analysis.today_focus.join("\n")}`);
  }
  if (analysis.blockers_and_risks.length > 0) {
    sections.push(`* Blockers & Risks *\n${analysis.blockers_and_risks.join("\n")}`);
  }

  const cr = analysis.code_review;
  sections.push(`* Code Review *\nHealth: ${cr.code_health} | Complexity: ${cr.complexity_score}/10`);

  return {
    name: `Standup: ${analysis.developer} — ${analysis.repository}`,
    desc: sections.join("\n\n"),
  };
}

export function formatForJira(analysis: StandupAnalysis): string {
  const lines: string[] = [analysis.summary, ""];

  if (analysis.yesterday_progress.length > 0) {
    lines.push("Yesterday's Progress:");
    analysis.yesterday_progress.forEach((i) => lines.push(`- ${i}`));
    lines.push("");
  }
  if (analysis.today_focus.length > 0) {
    lines.push("Today's Focus:");
    analysis.today_focus.forEach((i) => lines.push(`- ${i}`));
    lines.push("");
  }
  if (analysis.blockers_and_risks.length > 0) {
    lines.push("Blockers & Risks:");
    analysis.blockers_and_risks.forEach((i) => lines.push(`- ${i}`));
  }

  return lines.join("\n");
}

// ===== Microsoft Teams (Workflows webhook → Adaptive Card) =====
//
// Teams "Workflows" webhooks expect a `message` envelope containing an
// Adaptive Card attachment. Version 1.4 is used because it is supported by all
// current Teams clients. Teams webhook payloads are capped at roughly 28 KB,
// so cards are built with item caps and shrunk until they fit.

const TEAMS_MAX_BYTES = 24_000;

/** Neutralise Adaptive Card markdown so AI/user-derived text cannot inject links or formatting. */
function tm(text: unknown, max = 400): string {
  const s = String(text ?? "")
      .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .replace(/\r/g, "")
    .trim();
  const clipped = s.length > max ? `${s.slice(0, max - 1)}…` : s;
  return clipped.replace(/([\\`*_~\[\]<>])/g, "\\$1");
}

type CardElement = Record<string, unknown>;

function cardEnvelope(body: CardElement[]): object {
  return {
    type: "message",
    attachments: [
      {
        contentType: "application/vnd.microsoft.card.adaptive",
        contentUrl: null,
        content: {
          $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
          type: "AdaptiveCard",
          version: "1.4",
          msteams: { width: "Full" },
          body,
        },
      },
    ],
  };
}

const heading = (text: string): CardElement => ({
  type: "TextBlock",
  text: tm(text, 120),
  weight: "Bolder",
  size: "Medium",
  wrap: true,
});

const subtle = (text: string): CardElement => ({
  type: "TextBlock",
  text: tm(text, 200),
  isSubtle: true,
  spacing: "None",
  wrap: true,
});

const section = (title: string, items: string[], maxItems: number, itemMax: number): CardElement[] => {
  if (items.length === 0 || maxItems <= 0) return [];
  const shown = items.slice(0, maxItems);
  const out: CardElement[] = [
    { type: "TextBlock", text: tm(title, 80), weight: "Bolder", separator: true, spacing: "Medium", wrap: true },
    ...shown.map((i) => ({ type: "TextBlock", text: `• ${tm(i, itemMax)}`, wrap: true, spacing: "Small" })),
  ];
  if (items.length > shown.length) {
    out.push({ type: "TextBlock", text: `+${items.length - shown.length} more`, isSubtle: true, spacing: "Small" });
  }
  return out;
};

function fitToSize(build: (maxItems: number, itemMax: number) => object): object {
  for (const [maxItems, itemMax] of [[10, 300], [6, 200], [3, 140], [1, 100], [0, 80]] as const) {
    const payload = build(maxItems, itemMax);
    if (Buffer.byteLength(JSON.stringify(payload), "utf8") <= TEAMS_MAX_BYTES) return payload;
  }
  return build(0, 60);
}

export function formatForTeams(analysis: StandupAnalysis): object {
  const cr = analysis.code_review;
  return fitToSize((maxItems, itemMax) =>
    cardEnvelope([
      heading(`Standup Report — ${analysis.developer}`),
      subtle(`${analysis.repository} · ${analysis.branch}`),
      { type: "TextBlock", text: tm(analysis.summary, 600), wrap: true, spacing: "Medium" },
      ...section("Yesterday's Progress", analysis.yesterday_progress, maxItems, itemMax),
      ...section("Today's Focus", analysis.today_focus, maxItems, itemMax),
      ...section("Blockers & Risks", analysis.blockers_and_risks, maxItems, itemMax),
      {
        type: "FactSet",
        separator: true,
        spacing: "Medium",
        facts: [
          { title: "Code health", value: tm(cr.code_health, 20) },
          { title: "Complexity", value: `${Number(cr.complexity_score) || 0}/10` },
        ],
      },
    ])
  );
}

interface ReviewLike {
  summary: string;
  riskLevel: string;
  approved: boolean;
  blockers: string[];
  categories: Record<string, { findings: { title: string; description: string; file: string; line: number; severity?: string }[] }>;
}

export function formatReviewForTeams(review: ReviewLike, repo: string, owner: string, scopeLabel?: string): object {
  const labels: Record<string, string> = {
    security: "Security",
    codeQuality: "Code Quality",
    performance: "Performance",
    bestPractices: "Best Practices",
  };
  const findings = Object.entries(review.categories).flatMap(([key, c]) =>
    (c?.findings || []).map((f) => ({ ...f, category: labels[key] || key }))
  );

  return fitToSize((maxItems, itemMax) =>
    cardEnvelope([
      heading(`Code Review — ${owner}/${repo}`),
      ...(scopeLabel ? [subtle(scopeLabel)] : []),
      {
        type: "FactSet",
        spacing: "Medium",
        facts: [
          { title: "Risk", value: tm(String(review.riskLevel).toUpperCase(), 20) },
          { title: "Approved", value: review.approved ? "Yes" : "No" },
          { title: "Findings", value: String(findings.length) },
        ],
      },
      { type: "TextBlock", text: tm(review.summary, 600), wrap: true, spacing: "Medium" },
      ...section(
        "Findings",
        findings.map((f) => `[${f.category}] ${f.title} (${f.file}:${f.line}) — ${f.description}`),
        maxItems,
        itemMax
      ),
      ...section("Blockers", review.blockers || [], maxItems, itemMax),
    ])
  );
}

export function formatTeamsTestMessage(): object {
  return cardEnvelope([
    heading("Shadow Standup — test message"),
    {
      type: "TextBlock",
      text: "If you can read this, your Microsoft Teams webhook is configured correctly.",
      wrap: true,
    },
  ]);
}
