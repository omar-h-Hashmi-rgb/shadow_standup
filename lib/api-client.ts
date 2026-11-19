import { supabase } from "./supabase";

/**
 * fetch() wrapper for the app's own /api routes. Attaches the signed-in user's
 * Supabase access token as a Bearer token, which the server verifies on every
 * request (see lib/auth.ts). Sending it in a header rather than a cookie also
 * means these endpoints are not exposed to cross-site request forgery.
 */

/** Safety net: a request may never outlive this, so UI loading states always clear. */
const DEFAULT_TIMEOUT_MS = 240_000;

export async function apiFetch(
  input: string,
  init: RequestInit = {},
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<Response> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const headers = new Headers(init.headers);
  if (session?.access_token) headers.set("Authorization", `Bearer ${session.access_token}`);

  // Always bound the request. Without this, one stalled upstream call leaves
  // the promise pending forever and "Generating…"/"Delivering…" never clears.
  const signal =
    init.signal ??
    (typeof AbortSignal !== "undefined" && "timeout" in AbortSignal
      ? AbortSignal.timeout(timeoutMs)
      : undefined);

  return fetch(input, { ...init, headers, signal });
}
