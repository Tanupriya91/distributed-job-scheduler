import { logger } from "../logger";
import { registerHandler } from "./registry";

// A generic scheduler doesn't know what a job "means" — these are example
// handlers standing in for real business logic, the way a fresh Sidekiq/
// BullMQ install ships with example worker classes. Real deployments would
// register their own handlers instead of (or alongside) these.

registerHandler("log-message", async (payload) => {
  logger.info({ payload }, "log-message handler executed");
});

registerHandler("sleep", async (payload) => {
  const ms = typeof payload.ms === "number" ? payload.ms : 1000;
  await new Promise((resolve) => setTimeout(resolve, ms));
});

registerHandler("fail-randomly", async (payload) => {
  const failureRate = typeof payload.failureRate === "number" ? payload.failureRate : 0.5;
  if (Math.random() < failureRate) {
    throw new Error(`Simulated failure (failureRate=${failureRate})`);
  }
});

registerHandler("http-request", async (payload) => {
  if (typeof payload.url !== "string") {
    throw new Error("payload.url is required for http-request jobs");
  }
  const response = await fetch(payload.url, {
    method: typeof payload.method === "string" ? payload.method : "GET",
  });
  if (!response.ok) {
    throw new Error(`http-request failed: ${response.status} ${response.statusText}`);
  }
});
