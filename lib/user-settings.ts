import { getSupabaseAdmin } from "./supabase-admin";
import { decryptSecret } from "./crypto";

/** Secrets are encrypted at rest and never returned to the browser in clear text. */
export const SECRET_FIELDS = [
  "discord_webhook_url",
  "slack_webhook_url",
  "jira_api_token",
  "trello_api_key",
  "trello_token",
] as const;

export const PLAIN_FIELDS = ["jira_domain", "jira_email", "jira_project_key", "trello_list_id"] as const;

export type SecretField = (typeof SECRET_FIELDS)[number];
export type PlainField = (typeof PLAIN_FIELDS)[number];
export type UserSettingsRow = Record<SecretField | PlainField, string>;

/** Placeholder shown in the UI for a stored secret. Sending it back means "unchanged". */
export const SECRET_MASK = "••••••••";

export function emptySettings(): UserSettingsRow {
  const out = {} as UserSettingsRow;
  for (const f of [...SECRET_FIELDS, ...PLAIN_FIELDS]) out[f] = "";
  return out;
}

/** Loads a user's integration settings with secrets decrypted — server use only. */
export async function loadUserSettingsDecrypted(userId: string): Promise<UserSettingsRow> {
  const settings = emptySettings();
  try {
    const { data } = await getSupabaseAdmin()
      .from("user_settings")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    if (!data) return settings;
    for (const f of PLAIN_FIELDS) settings[f] = data[f] || "";
    for (const f of SECRET_FIELDS) settings[f] = decryptSecret(data[f]);
  } catch {
    console.log("[settings] No user settings found, using env defaults");
  }
  return settings;
}
