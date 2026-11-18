import type { NextConfig } from "next";

<<<<<<< HEAD
const isDev = process.env.NODE_ENV !== "production";

function supabaseOrigins(): string[] {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!raw) return [];
  try {
    const u = new URL(raw);
    return [u.origin, `${u.protocol === "https:" ? "wss" : "ws"}://${u.host}`];
  } catch {
    return [];
  }
}

/**
 * Content-Security-Policy.
 * Next.js emits inline bootstrap scripts, so without a per-request nonce
 * (which would force fully dynamic rendering) 'unsafe-inline' is required for
 * scripts. The remaining directives still block framing, plugins, base-tag
 * hijacking and every non-allow-listed network destination.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://avatars.githubusercontent.com",
  "font-src 'self' data:",
  `connect-src 'self' ${supabaseOrigins().join(" ")}${isDev ? " ws: http://localhost:*" : ""}`.trim(),
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  ...(isDev ? [] : [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }]),
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // API responses can contain user data: never cache them.
      { source: "/api/:path*", headers: [{ key: "Cache-Control", value: "no-store" }] },
    ];
  },
=======
const nextConfig: NextConfig = {
  /* config options here */
>>>>>>> origin/main
};

export default nextConfig;
