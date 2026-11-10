import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { env } from "@/lib/env";
import { isUiPreview } from "@/lib/ui-preview";

// [SECURITY] Rate limiting backed by Upstash Redis; free tier: 10 000 req/day
// Sliding window algorithm to prevent burst attacks

// Real handlers are intercepted in preview; keep build-time imports offline too.
const redis = isUiPreview ? null : new Redis({
  url: env.UPSTASH_REDIS_REST_URL,
  token: env.UPSTASH_REDIS_REST_TOKEN,
});

const previewLimiter = {
  async limit(identifier: string): Promise<never> {
    throw new Error(`Real API handler called in UI preview: ${identifier}`);
  },
};

// 5 requests per 60 seconds per IP – for auth endpoints
export const authLimiter = redis ? new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, "60 s"),
  prefix: "rl:auth",
  analytics: false,
}) : previewLimiter;

// 10 requests per 60 seconds per user – for submission creation
export const submissionLimiter = redis ? new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, "60 s"),
  prefix: "rl:submission",
  analytics: false,
}) : previewLimiter;

// 30 requests per 60 seconds per user – for reactions
export const reactionLimiter = redis ? new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(30, "60 s"),
  prefix: "rl:reaction",
  analytics: false,
}) : previewLimiter;

// Generic admin limiter
export const adminLimiter = redis ? new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(20, "60 s"),
  prefix: "rl:admin",
  analytics: false,
}) : previewLimiter;

// [SECURITY] We deliberately do NOT rate-limit by client IP. x-forwarded-for
// is user-controllable in many deploy topologies (forging the leftmost IP
// is trivial unless you implement Vercel-specific edge-IP parsing), and all
// our limited routes already require an authenticated session — keying by
// user.id is both safer and more meaningful.
