import type { NextConfig } from "next";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseHostname = supabaseUrl ? new URL(supabaseUrl).hostname : "";

// [SECURITY] CSP — 'unsafe-inline' necessário para hidratação do Next.js.
// 'unsafe-eval' necessário apenas em dev (React usa eval() para call stacks).
// Em produção o React nunca usa eval(); o flag é omitido automaticamente.
const isDev = process.env.NODE_ENV === "development";

const ContentSecurityPolicy = `
  default-src 'self';
  script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""};
  style-src 'self' 'unsafe-inline';
  img-src 'self' ${supabaseHostname} blob: data:;
  connect-src 'self' ${supabaseUrl} wss://${supabaseHostname};
  frame-src 'none';
  font-src 'self';
  object-src 'none';
  base-uri 'self';
  form-action 'self';
`.replace(/\n/g, " ").trim();

const securityHeaders = [
  // [SECURITY] HSTS: force HTTPS for 2 years, all subdomains, submit to preload list
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  // [SECURITY] CSP: restrict resource loading origins
  { key: "Content-Security-Policy", value: ContentSecurityPolicy },
  // [SECURITY] Prevent clickjacking
  { key: "X-Frame-Options", value: "DENY" },
  // [SECURITY] Prevent MIME-type sniffing
  { key: "X-Content-Type-Options", value: "nosniff" },
  // [SECURITY] Limit referrer info
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // [SECURITY] Disable dangerous browser features
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
];

const nextConfig: NextConfig = {
  images: {
    remotePatterns: supabaseHostname
      ? [{ protocol: "https", hostname: supabaseHostname }]
      : [],
  },
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
