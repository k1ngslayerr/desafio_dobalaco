import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { env } from "@/lib/env";

// [SECURITY] Rate limiting backed by Upstash Redis; free tier: 10 000 req/day
// Sliding window algorithm to prevent burst attacks

const redis = new Redis({
  url: env.UPSTASH_REDIS_REST_URL,
  token: env.UPSTASH_REDIS_REST_TOKEN,
});

// 5 requests per 60 seconds per IP – for auth endpoints
export const authLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, "60 s"),
  prefix: "rl:auth",
  analytics: false,
});

// 10 requests per 60 seconds per user – for submission creation
export const submissionLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, "60 s"),
  prefix: "rl:submission",
  analytics: false,
});

// 30 requests per 60 seconds per user – for reactions
export const reactionLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(30, "60 s"),
  prefix: "rl:reaction",
  analytics: false,
});

// Generic admin limiter
export const adminLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(20, "60 s"),
  prefix: "rl:admin",
  analytics: false,
});

// [SECURITY] We deliberately do NOT rate-limit by client IP. x-forwarded-for
// is user-controllable in many deploy topologies (forging the leftmost IP
// is trivial unless you implement Vercel-specific edge-IP parsing), and all
// our limited routes already require an authenticated session — keying by
// user.id is both safer and more meaningful.
