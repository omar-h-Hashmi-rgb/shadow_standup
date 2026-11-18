import { supabase } from "./supabase";

/**
 * fetch() wrapper for the app's own /api routes. Attaches the signed-in user's
 * Supabase access token as a Bearer token, which the server verifies on every
 * request (see lib/auth.ts). Sending it in a header rather than a cookie also
 * means these endpoints are not exposed to cross-site request forgery.
 */
export async function apiFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const headers = new Headers(init.headers);
  if (session?.access_token) headers.set("Authorization", `Bearer ${session.access_token}`);

  return fetch(input, { ...init, headers });
}
