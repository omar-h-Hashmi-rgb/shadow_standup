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
