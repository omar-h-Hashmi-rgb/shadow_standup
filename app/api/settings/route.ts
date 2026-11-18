import { NextResponse } from "next/server";
import { authenticate } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { encryptSecret } from "@/lib/crypto";
import { HttpError, handleRouteError, readJsonBody, MAX_BODY_BYTES } from "@/lib/http";
import { enforceRateLimit } from "@/lib/rate-limit";
import { validateJiraDomain, validateWebhookUrl } from "@/lib/url-safety";
import {
  PLAIN_FIELDS,
  SECRET_FIELDS,
  SECRET_MASK,
  emptySettings,
  type PlainField,
  type SecretField,
} from "@/lib/user-settings";

/**
 * Per-user integration settings.
 *
 * - Scoped to the authenticated user (the id is never read from the request).
 * - Secrets (webhook URLs, API tokens) are encrypted at rest and are NEVER
 *   returned to the browser: GET sends a mask for stored secrets, and POST
 *   treats the mask as "unchanged".
 * - Webhook URLs and the Jira domain are validated against provider allow-lists.
 */

const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,255}$/;
const JIRA_KEY_RE = /^[A-Za-z][A-Za-z0-9_]{1,19}$/;
const TRELLO_ID_RE = /^[a-fA-F0-9]{24}$/;
const TOKEN_RE = /^\S{1,512}$/;

export async function GET(request: Request) {
  const auth = await authenticate(request);
  if ("response" in auth) return auth.response;
  const limited = enforceRateLimit(request, "crud", auth.user.id);
  if (limited) return limited;

  try {
    const { data, error } = await getSupabaseAdmin()
      .from("user_settings")
      .select("*")
      .eq("user_id", auth.user.id)
      .maybeSingle();
    if (error) throw error;

    const settings = emptySettings();
    for (const f of PLAIN_FIELDS) settings[f] = data?.[f] || "";
    for (const f of SECRET_FIELDS) settings[f] = data?.[f] ? SECRET_MASK : "";

    return NextResponse.json({ success: true, settings });
  } catch (error) {
    return handleRouteError(error, "settings:get");
  }
}

function validateSecret(field: SecretField, value: string): string {
  if (field === "discord_webhook_url" || field === "slack_webhook_url") {
    const kind = field === "discord_webhook_url" ? "discord" : "slack";
    const check = validateWebhookUrl(kind, value);
    if (!check.ok) throw new HttpError(`Invalid ${kind} webhook URL: ${check.reason}`, 400);
    return check.url;
  }
  if (!TOKEN_RE.test(value)) throw new HttpError("Tokens must be 1–512 characters with no spaces.", 400);
  return value;
}

function validatePlain(field: PlainField, value: string): string {
  switch (field) {
    case "jira_domain": {
      const check = validateJiraDomain(value);
      if (!check.ok) throw new HttpError(`Invalid Jira domain: ${check.reason}`, 400);
      return check.url;
    }
    case "jira_email":
      if (!EMAIL_RE.test(value)) throw new HttpError("Invalid Jira account email.", 400);
      return value;
    case "jira_project_key":
      if (!JIRA_KEY_RE.test(value)) throw new HttpError("Invalid Jira project key (e.g. KAN).", 400);
      return value.toUpperCase();
    case "trello_list_id":
      if (!TRELLO_ID_RE.test(value)) throw new HttpError("Invalid Trello list id (24 hex characters).", 400);
      return value;
  }
}

export async function POST(request: Request) {
  const auth = await authenticate(request);
  if ("response" in auth) return auth.response;
  const limited = enforceRateLimit(request, "crud", auth.user.id);
  if (limited) return limited;

  try {
    const body = await readJsonBody<{ settings?: Record<string, unknown> }>(request, MAX_BODY_BYTES.small);
    const incoming = body.settings;
    if (!incoming || typeof incoming !== "object" || Array.isArray(incoming)) {
      throw new HttpError("settings object required.", 400);
    }

    // Only fields that were actually provided are written; the rest are left untouched.
    const update: Record<string, string> = {};

    for (const field of SECRET_FIELDS) {
      const raw = incoming[field];
      if (raw === undefined || raw === SECRET_MASK) continue; // unchanged
      if (typeof raw !== "string") throw new HttpError(`Invalid value for ${field}.`, 400);
      const value = raw.trim();
      update[field] = value === "" ? "" : encryptSecret(validateSecret(field, value));
    }

    for (const field of PLAIN_FIELDS) {
      const raw = incoming[field];
      if (raw === undefined) continue;
      if (typeof raw !== "string") throw new HttpError(`Invalid value for ${field}.`, 400);
      const value = raw.trim();
      update[field] = value === "" ? "" : validatePlain(field, value);
    }

    const { error } = await getSupabaseAdmin()
      .from("user_settings")
      .upsert(
        { user_id: auth.user.id, ...update, updated_at: new Date().toISOString() },
        { onConflict: "user_id" }
      );
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleRouteError(error, "settings:save");
  }
}
