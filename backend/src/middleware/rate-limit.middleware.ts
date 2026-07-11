import rateLimit from "express-rate-limit";
import { Request, Response } from "express";
import { env } from "../env";

export function createRateLimiter(options: {
  windowMs: number;
  max: number;
  message: string;
  keyGenerator?: (req: Request) => string;
}) {
  return rateLimit({
    windowMs: options.windowMs,
    max: options.max,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: options.keyGenerator,
    handler: (_req: Request, res: Response) => {
      res.status(429).json({ error: { code: "RATE_LIMITED", message: options.message } });
    },
  });
}

// The integration test suite legitimately fires dozens of requests per file
// from the same IP within seconds — a production-sized limit would make
// the suite itself trip the limiter. Rather than skip rate limiting in
// tests entirely (which would mean the real middleware never runs under
// test), the ceiling is raised sharply instead — rate-limit.test.ts builds
// its own low-threshold instance via createRateLimiter to verify the real
// 429 behavior.
const isTest = process.env.NODE_ENV === "test";

export const apiRateLimiter = createRateLimiter({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: isTest ? 100_000 : env.RATE_LIMIT_MAX,
  message: "Too many requests. Please slow down and try again shortly.",
});

export const authRateLimiter = createRateLimiter({
  windowMs: env.AUTH_RATE_LIMIT_WINDOW_MS,
  max: isTest ? 100_000 : env.AUTH_RATE_LIMIT_MAX,
  message: "Too many authentication attempts. Please try again in a few minutes.",
});
