import "dotenv/config";
import { describe, expect, it } from "vitest";
import express from "express";
import request from "supertest";
import { createRateLimiter } from "./middleware/rate-limit.middleware";

// The app-wide limiters (apiRateLimiter/authRateLimiter) run with a very
// high ceiling under NODE_ENV=test so the rest of the integration suite
// doesn't trip them — see rate-limit.middleware.ts. That means testing
// them through the real `app` would prove nothing. Instead, this builds a
// throwaway Express app using the exact same `createRateLimiter` factory
// with a deliberately tiny threshold, so the real middleware logic (window,
// counting, the custom 429 handler) is genuinely exercised.
describe("createRateLimiter", () => {
  it("allows requests under the limit and rejects with 429 once it's exceeded", async () => {
    const app = express();
    app.use(createRateLimiter({ windowMs: 60_000, max: 3, message: "slow down" }));
    app.get("/ping", (_req, res) => res.status(200).json({ ok: true }));

    const agent = request(app);

    const first = await agent.get("/ping");
    const second = await agent.get("/ping");
    const third = await agent.get("/ping");
    expect([first.status, second.status, third.status]).toEqual([200, 200, 200]);

    const fourth = await agent.get("/ping");
    expect(fourth.status).toBe(429);
    expect(fourth.body.error.code).toBe("RATE_LIMITED");
    expect(fourth.body.error.message).toBe("slow down");
  });

  it("tracks separate clients independently", async () => {
    // Deliberately not using X-Forwarded-For + `trust proxy` to simulate
    // separate clients: express-rate-limit itself flags `trust proxy: true`
    // as unsafe (ERR_ERL_PERMISSIVE_TRUST_PROXY) because it lets a client
    // spoof its own X-Forwarded-For header to get a fresh budget on every
    // request — the exact bypass rate limiting exists to prevent. A real
    // deployment behind a reverse proxy should set `trust proxy` to the
    // exact number of trusted hops, never `true`. To test the counting
    // logic itself without that footgun, this uses a custom keyGenerator
    // keyed off an explicit test header instead of IP extraction.
    const app = express();
    app.use(
      createRateLimiter({
        windowMs: 60_000,
        max: 1,
        message: "slow down",
        keyGenerator: (req) => String(req.headers["x-test-client-id"]),
      })
    );
    app.get("/ping", (_req, res) => res.status(200).json({ ok: true }));

    const first = await request(app).get("/ping").set("X-Test-Client-Id", "client-a");
    expect(first.status).toBe(200);

    const second = await request(app).get("/ping").set("X-Test-Client-Id", "client-a");
    expect(second.status).toBe(429);

    const third = await request(app).get("/ping").set("X-Test-Client-Id", "client-b");
    expect(third.status).toBe(200);
  });
});
