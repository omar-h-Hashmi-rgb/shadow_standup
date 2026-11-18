import { NextResponse } from "next/server";
import { getClientIp } from "./http";

/**
 * Fixed-window, in-memory rate limiter.
 *
 * LIMITATION: state lives in the memory of one server instance. On
 * serverless/multi-instance deployments the effective limit is per instance
 * (still useful against bursts and runaway clients). For a strict global
 * limit, swap `hit()` for a shared store such as Redis/Upstash.
 */

interface Entry {
  count: number;
  resetAt: number;
}

const store = new Map<string, Entry>();
const MAX_ENTRIES = 10_000;

export const RATE_LIMITS = {
  /** LLM-backed endpoints (cost + abuse): per user */
  ai: { limit: 10, windowMs: 60_000 },
  /** GitHub proxy endpoints */
  github: { limit: 60, windowMs: 60_000 },
  /** Settings / history CRUD */
  crud: { limit: 60, windowMs: 60_000 },
  /** Outbound test notifications */
  notifyTest: { limit: 3, windowMs: 60_000 },
  /** Anything unauthenticated, per IP */
  anonymous: { limit: 30, windowMs: 60_000 },
} as const;

export type RateLimitName = keyof typeof RATE_LIMITS;

function purge(now: number) {
  for (const [key, entry] of store) {
    if (entry.resetAt <= now) store.delete(key);
  }
  if (store.size > MAX_ENTRIES) store.clear(); // last-resort memory bound
}

function hit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  if (store.size > MAX_ENTRIES) purge(now);

  const existing = store.get(key);
  if (!existing || existing.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, retryAfterSec: 0 };
  }
  existing.count += 1;
  if (existing.count > limit) {
    return { ok: false, remaining: 0, retryAfterSec: Math.ceil((existing.resetAt - now) / 1000) };
  }
  return { ok: true, remaining: limit - existing.count, retryAfterSec: 0 };
}

/**
 * Returns a 429 response if the caller is over the limit, otherwise null.
 * Keyed by user id when authenticated, else by client IP.
 */
export function enforceRateLimit(
  request: Request,
  name: RateLimitName,
  userId?: string | null
): NextResponse | null {
  const { limit, windowMs } = RATE_LIMITS[name];
  const identity = userId ? `u:${userId}` : `ip:${getClientIp(request)}`;
  const result = hit(`${name}:${identity}`, limit, windowMs);
  if (result.ok) return null;

  return NextResponse.json(
    { success: false, error: "Too many requests. Please slow down and try again shortly." },
    { status: 429, headers: { "Retry-After": String(result.retryAfterSec) } }
  );
}

/** Test helper. */
export function _resetRateLimits() {
  store.clear();
}
