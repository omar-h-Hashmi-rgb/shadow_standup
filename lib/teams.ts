import axios from "axios";
import { validateWebhookUrl } from "./url-safety";

/**
 * Microsoft Teams integration (optional).
 *
 * Configured exclusively through the server environment:
 *
 *     TEAMS_WEBHOOK_URL=<Workflows webhook URL>
 *
 * The URL is a secret (it embeds its own access signature). It is only ever
 * read here, on the server; it is never sent to the browser, never logged, and
 * never stored in the database.
 *
 * Teams is strictly best-effort: a missing/invalid URL or a failed delivery
 * must never affect the other integrations, so nothing here throws.
 */

export type TeamsStatus = {
  configured: boolean;
  /** Why it is not configured — never contains the URL itself. */
  reason?: "missing" | "invalid";
};

let warnedInvalid = false;

/** Returns the validated webhook URL, or null if absent/invalid. Server use only. */
function getTeamsWebhookUrl(): { url: string | null; reason?: "missing" | "invalid" } {
  const raw = process.env.TEAMS_WEBHOOK_URL?.trim();
  if (!raw) return { url: null, reason: "missing" };

  const check = validateWebhookUrl("teams", raw);
  if (!check.ok) {
    if (!warnedInvalid) {
      warnedInvalid = true;
      console.warn(`[teams] TEAMS_WEBHOOK_URL is set but rejected: ${check.reason} Teams notifications are disabled.`);
    }
    return { url: null, reason: "invalid" };
  }
  return { url: check.url };
}

export function getTeamsStatus(): TeamsStatus {
  const { url, reason } = getTeamsWebhookUrl();
  return url ? { configured: true } : { configured: false, reason };
}

export function isTeamsConfigured(): boolean {
  return getTeamsStatus().configured;
}

export interface TeamsPostResult {
  ok: boolean;
  /** True when nothing was sent because Teams is not configured. */
  skipped?: boolean;
  status?: number;
}

/**
 * POSTs a prepared Adaptive Card payload. Workflows webhooks answer 202
 * (accepted) — any 2xx counts as success. Failures inside the flow itself are
 * only visible in Power Automate's run history.
 */
export async function postToTeams(payload: object): Promise<TeamsPostResult> {
  const { url } = getTeamsWebhookUrl();
  if (!url) return { ok: false, skipped: true };

  try {
    const res = await axios.post(url, payload, {
      timeout: 15000,
      maxRedirects: 0,
      maxContentLength: 64 * 1024,
      headers: { "Content-Type": "application/json" },
    });
    return { ok: true, status: res.status };
  } catch (error) {
    // Log only the status/code: the URL and response body may contain secrets.
    const status = axios.isAxiosError(error) ? error.response?.status : undefined;
    const code = axios.isAxiosError(error) ? error.code : undefined;
    console.error("Teams webhook failed:", status || code || "unknown error");
    return { ok: false, status };
  }
}
