import { isIP } from "node:net";

/**
 * Outbound URL validation (SSRF defence).
 *
 * Webhook URLs and the Jira domain can originate from user input (request
 * bodies, saved settings). Without validation the server could be made to
 * POST to internal addresses (cloud metadata endpoints, localhost, private
 * networks). Every outbound integration call is checked against a strict
 * per-provider host allow-list: https only, no credentials in the URL, no IP
 * literals, no non-default ports.
 */

export type WebhookKind = "discord" | "slack" | "teams";
export type UrlCheck = { ok: true; url: string } | { ok: false; reason: string };

interface HostRule {
  exact: string[];
  suffixes: string[];
  pathPrefix?: string;
}

const DISCORD_RULE: HostRule = {
  exact: ["discord.com", "canary.discord.com", "ptb.discord.com", "discordapp.com"],
  suffixes: [],
  pathPrefix: "/api/webhooks/",
};

const SLACK_RULE: HostRule = {
  exact: ["hooks.slack.com"],
  suffixes: [],
  pathPrefix: "/services/",
};

// Microsoft Teams "Workflows" (Power Automate) webhooks. Legacy Office 365
// connector hosts are retained for completeness although Microsoft shut them
// down in 2026. Extra hosts can be added via TEAMS_WEBHOOK_ALLOWED_HOSTS.
const TEAMS_SUFFIXES = [
  ".logic.azure.com", // https://prod-XX.<region>.logic.azure.com/workflows/...
  ".powerplatform.com", // https://default<id>.<n>.environment.api.powerplatform.com/powerautomate/...
  ".powerautomate.com",
  ".webhook.office.com",
];
const TEAMS_EXACT = ["flow.microsoft.com", "outlook.office.com", "api.powerplatform.com"];

function extraHosts(envName: string): string[] {
  return (process.env[envName] || "")
    .split(",")
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
}

function ruleFor(kind: WebhookKind): HostRule {
  if (kind === "discord") return DISCORD_RULE;
  if (kind === "slack") return SLACK_RULE;
  const extras = extraHosts("TEAMS_WEBHOOK_ALLOWED_HOSTS");
  return {
    exact: [...TEAMS_EXACT, ...extras.filter((h) => !h.startsWith("."))],
    suffixes: [...TEAMS_SUFFIXES, ...extras.filter((h) => h.startsWith("."))],
  };
}

function hostAllowed(hostname: string, rule: HostRule): boolean {
  return rule.exact.includes(hostname) || rule.suffixes.some((s) => hostname.endsWith(s));
}

function parseHttps(raw: string): { url: URL } | { reason: string } {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return { reason: "Not a valid URL." };
  }
  if (url.protocol !== "https:") return { reason: "URL must use https." };
  if (url.username || url.password) return { reason: "URL must not contain credentials." };
  if (url.port && url.port !== "443") return { reason: "Non-standard ports are not allowed." };
  if (isIP(url.hostname.replace(/^\[|\]$/g, ""))) return { reason: "IP addresses are not allowed." };
  return { url };
}

export function validateWebhookUrl(kind: WebhookKind, raw: unknown): UrlCheck {
  if (typeof raw !== "string" || !raw.trim()) return { ok: false, reason: "Webhook URL is empty." };
  if (raw.length > 2048) return { ok: false, reason: "Webhook URL is too long." };

  const parsed = parseHttps(raw);
  if ("reason" in parsed) return { ok: false, reason: parsed.reason };

  const rule = ruleFor(kind);
  const hostname = parsed.url.hostname.toLowerCase();
  if (!hostAllowed(hostname, rule)) {
    return { ok: false, reason: `Host is not an allowed ${kind} webhook host.` };
  }
  if (rule.pathPrefix && !parsed.url.pathname.startsWith(rule.pathPrefix)) {
    return { ok: false, reason: `Path is not a valid ${kind} webhook path.` };
  }
  return { ok: true, url: parsed.url.toString() };
}

/** Jira Cloud site URL (e.g. https://acme.atlassian.net). Returns the normalized origin. */
export function validateJiraDomain(raw: unknown): UrlCheck {
  if (typeof raw !== "string" || !raw.trim()) return { ok: false, reason: "Jira domain is empty." };
  const parsed = parseHttps(raw);
  if ("reason" in parsed) return { ok: false, reason: parsed.reason };

  const hostname = parsed.url.hostname.toLowerCase();
  const extras = extraHosts("JIRA_ALLOWED_HOSTS");
  const allowed =
    hostname.endsWith(".atlassian.net") ||
    hostname.endsWith(".jira.com") ||
    extras.some((h) => (h.startsWith(".") ? hostname.endsWith(h) : hostname === h));
  if (!allowed) {
    return { ok: false, reason: "Jira domain must be an *.atlassian.net site (or listed in JIRA_ALLOWED_HOSTS)." };
  }
  return { ok: true, url: parsed.url.origin };
}
