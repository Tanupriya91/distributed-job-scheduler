import { RetryStrategy } from "@job-scheduler/db";

/**
 * Computes the delay (in seconds) before the next retry attempt.
 *
 * `attemptNumber` is the attempt that just FAILED (1-indexed). FIXED always
 * waits baseDelaySeconds. LINEAR grows by a multiple of the attempt number
 * (base, 2*base, 3*base...). EXPONENTIAL doubles each time (base, 2*base,
 * 4*base...). All strategies are capped at maxDelaySeconds so a
 * misconfigured queue can't schedule a retry days away by accident.
 */
export function computeBackoffSeconds(
  strategy: RetryStrategy,
  attemptNumber: number,
  baseDelaySeconds: number,
  maxDelaySeconds: number
): number {
  let delay: number;

  switch (strategy) {
    case "FIXED":
      delay = baseDelaySeconds;
      break;
    case "LINEAR":
      delay = baseDelaySeconds * attemptNumber;
      break;
    case "EXPONENTIAL":
      delay = baseDelaySeconds * 2 ** (attemptNumber - 1);
      break;
  }

  return Math.min(delay, maxDelaySeconds);
}

export function computeNextRunAt(
  strategy: RetryStrategy,
  attemptNumber: number,
  baseDelaySeconds: number,
  maxDelaySeconds: number,
  from: Date = new Date()
): Date {
  const delaySeconds = computeBackoffSeconds(strategy, attemptNumber, baseDelaySeconds, maxDelaySeconds);
  return new Date(from.getTime() + delaySeconds * 1000);
}
