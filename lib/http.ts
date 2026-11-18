import { NextResponse } from "next/server";

/** An error whose message is safe to show to API clients. */
export class HttpError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "HttpError";
    this.status = status;
  }
}

export function jsonError(message: string, status: number, extra?: Record<string, unknown>) {
  return NextResponse.json({ success: false, error: message, ...extra }, { status });
}

/**
 * Converts any thrown value into a response. Only HttpError messages are
 * exposed; everything else is logged server-side and replaced with a generic
 * message so internals (SQL errors, upstream payloads) never leak to clients.
 */
export function handleRouteError(error: unknown, label: string, extra?: Record<string, unknown>) {
  if (error instanceof HttpError) {
    return jsonError(error.message, error.status, extra);
  }
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[${label}]`, message);
  return jsonError("Internal Server Error", 500, extra);
}

export const MAX_BODY_BYTES = {
  small: 16 * 1024, // settings, deletes, simple forms
  medium: 128 * 1024, // standup / review requests
  large: 256 * 1024, // pasted code snippets
};

/** Reads and parses a JSON body, enforcing a byte limit. Throws HttpError. */
export async function readJsonBody<T = Record<string, unknown>>(
  request: Request,
  maxBytes: number = MAX_BODY_BYTES.medium
): Promise<T> {
  const declared = Number(request.headers.get("content-length") || 0);
  if (declared > maxBytes) throw new HttpError("Request body too large.", 413);

  const text = await request.text();
  if (Buffer.byteLength(text, "utf8") > maxBytes) {
    throw new HttpError("Request body too large.", 413);
  }

  let parsed: unknown;
  try {
    parsed = text ? JSON.parse(text) : {};
  } catch {
    throw new HttpError("Request body must be valid JSON.", 400);
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new HttpError("Request body must be a JSON object.", 400);
  }
  return parsed as T;
}

export function getClientIp(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return request.headers.get("x-real-ip") || "unknown";
}
