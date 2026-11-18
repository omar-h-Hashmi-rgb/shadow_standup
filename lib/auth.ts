<<<<<<< HEAD
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "./supabase-admin";
import { decryptSecret } from "./crypto";
import { jsonError } from "./http";
import { enforceRateLimit } from "./rate-limit";

/**
 * Server-side authentication.
 *
 * The browser keeps the Supabase session in localStorage, so the server never
 * receives a session cookie. Clients therefore send their Supabase access
 * token as `Authorization: Bearer <jwt>` (see lib/api-client.ts) and the
 * server verifies it with Supabase Auth on every request. The verified user id
 * — never a client-supplied `userId` — scopes all database access.
 */

export interface AuthedUser {
  id: string;
  email?: string | null;
}

export type AuthResult = { user: AuthedUser } | { response: NextResponse };

const BEARER_RE = /^Bearer\s+([A-Za-z0-9._~+/-]+=*)$/;

export async function authenticate(request: Request): Promise<AuthResult> {
  const header = request.headers.get("authorization") || "";
  const match = header.length < 4096 ? BEARER_RE.exec(header) : null;
  if (!match) {
    // Unauthenticated callers are throttled per IP (also slows token guessing).
    const limited = enforceRateLimit(request, "anonymous");
    return { response: limited ?? jsonError("Authentication required. Please sign in.", 401) };
  }

  try {
    const { data, error } = await getSupabaseAdmin().auth.getUser(match[1]);
    if (error || !data?.user) {
      const limited = enforceRateLimit(request, "anonymous");
      return { response: limited ?? jsonError("Your session is invalid or has expired. Please sign in again.", 401) };
    }
    return { user: { id: data.user.id, email: data.user.email } };
  } catch (e) {
    console.error("[auth] verification failed:", e instanceof Error ? e.message : e);
    return { response: jsonError("Authentication service unavailable.", 503) };
  }
}

// ---- GitHub token resolution ------------------------------------------------

const GITHUB_TOKEN_REGEX = /^(gh[pousr]_[A-Za-z0-9]{36,255}|github_pat_[A-Za-z0-9_]{22,255})$/;

export function isValidGitHubToken(token: string): boolean {
  return GITHUB_TOKEN_REGEX.test(token);
}

/**
 * Resolution order:
 *  1. `x-github-token` header (user's personal access token, format-checked)
 *  2. development only: GITHUB_PERSONAL_ACCESS_TOKEN from the server env
 *  3. the token persisted (encrypted) for the authenticated user
 */
export async function resolveGitHubToken(
  request: Request,
  userId?: string
): Promise<{ token: string | null; error?: string }> {
  const headerToken = request.headers.get("x-github-token");

  if (headerToken) {
    if (!isValidGitHubToken(headerToken)) {
      return { token: null, error: "Invalid GitHub token format." };
=======
import { NextResponse } from 'next/server';
import { supabase } from './supabase';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const GITHUB_TOKEN_REGEX = /^(ghp_[a-zA-Z0-9]{36}|github_pat_[a-zA-Z0-9_]{22,})$/;

function isValidGitHubToken(token: string): boolean {
  return GITHUB_TOKEN_REGEX.test(token);
}

export async function resolveGitHubToken(request: Request): Promise<{ token: string | null; error?: string }> {
  const headerToken = request.headers.get('x-github-token');

  if (headerToken) {
    if (!isValidGitHubToken(headerToken)) {
      return { token: null, error: 'Invalid GitHub token format.' };
>>>>>>> origin/main
    }
    return { token: headerToken };
  }

<<<<<<< HEAD
  if (process.env.NODE_ENV === "development" && process.env.GITHUB_PERSONAL_ACCESS_TOKEN) {
    return { token: process.env.GITHUB_PERSONAL_ACCESS_TOKEN };
  }

  if (userId) {
    try {
      const { data } = await getSupabaseAdmin()
        .from("user_tokens")
        .select("provider_token")
        .eq("user_id", userId)
        .maybeSingle();
      const stored = decryptSecret(data?.provider_token);
      if (stored && isValidGitHubToken(stored)) return { token: stored };
    } catch (e) {
      console.error("[auth] token lookup failed:", e instanceof Error ? e.message : e);
    }
  }

  return { token: null, error: "GitHub token missing. Add a Personal Access Token in Settings." };
=======
  if (process.env.NODE_ENV === 'development' && process.env.GITHUB_PERSONAL_ACCESS_TOKEN) {
    return { token: process.env.GITHUB_PERSONAL_ACCESS_TOKEN };
  }

  const { data: { session } } = await supabase.auth.getSession();
  if (session?.provider_token) {
    return { token: session.provider_token };
  }

  if (session?.user?.id) {
    const { data: tokenData } = await supabaseAdmin
      .from('user_tokens')
      .select('provider_token')
      .eq('user_id', session.user.id)
      .single();
    if (tokenData?.provider_token) {
      return { token: tokenData.provider_token };
    }
  }

  return { token: null, error: 'GitHub Token missing. Please sign in or add a token in Settings.' };
>>>>>>> origin/main
}
