import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * CORS / cross-origin policy for the API.
 *
 * Default: same-origin only. A request carrying an `Origin` header is allowed
 * if it matches this app's own host or one of the origins listed in
 * ALLOWED_ORIGINS (comma-separated, e.g. https://app.example.com). Anything
 * else gets 403, and preflights are answered only for allowed origins.
 *
 * Requests without an Origin header (same-origin GETs, curl, server-to-server)
 * pass through; they are still subject to per-route authentication.
 */

function allowedOrigins(): string[] {
  return (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((o) => o.trim().replace(/\/$/, ""))
    .filter(Boolean);
}

export function proxy(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin) return NextResponse.next();

  const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
  let sameOrigin = false;
  try {
    sameOrigin = new URL(origin).host === host;
  } catch {
    /* malformed Origin → rejected below */
  }
  const crossOriginAllowed = !sameOrigin && allowedOrigins().includes(origin);

  if (!sameOrigin && !crossOriginAllowed) {
    return NextResponse.json({ success: false, error: "Origin not allowed." }, { status: 403 });
  }

  const cors: Record<string, string> = crossOriginAllowed
    ? {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Authorization, Content-Type, x-github-token",
        "Access-Control-Max-Age": "600",
        Vary: "Origin",
      }
    : {};

  if (request.method === "OPTIONS") {
    return new NextResponse(null, { status: 204, headers: cors });
  }

  const response = NextResponse.next();
  for (const [k, v] of Object.entries(cors)) response.headers.set(k, v);
  return response;
}

export const config = {
  matcher: "/api/:path*",
};
