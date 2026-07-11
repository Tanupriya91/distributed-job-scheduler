import { env } from "./env";
import { prisma } from "@job-scheduler/db";
import { logger } from "./logger";
import { claimJobsForQueue } from "./claim";
import { runJob } from "./execution";
import { sendHeartbeat } from "./heartbeat";
import { registerWorker, markDraining, markOffline } from "./register";
import { dispatchDueRecurringJobs } from "./recurring";
import "./handlers/examples";

const runningJobs = new Set<Promise<void>>();
let shuttingDown = false;
let workerId: string;
let pollTimer: NodeJS.Timeout | undefined;
let heartbeatTimer: NodeJS.Timeout | undefined;
let recurringTimer: NodeJS.Timeout | undefined;

function trackJob(promise: Promise<void>) {
  runningJobs.add(promise);
  promise.finally(() => runningJobs.delete(promise));
}

async function pollTick() {
  if (shuttingDown) return;

  try {
    const availableSlots = env.WORKER_CONCURRENCY - runningJobs.size;

    if (availableSlots > 0) {
      const queues = await prisma.queue.findMany({
        where: { isPaused: false },
        orderBy: { priority: "desc" },
        select: { id: true, concurrencyLimit: true },
      });

      let remaining = availableSlots;
      for (const queue of queues) {
        if (remaining <= 0) break;

        const claimed = await claimJobsForQueue(queue.id, queue.concurrencyLimit, workerId, remaining);
        for (const job of claimed) {
          trackJob(runJob(job).catch((err) => logger.error({ err }, "Unexpected error running job")));
        }
        remaining -= claimed.length;
      }
    }
  } catch (err) {
    logger.error({ err }, "Error during poll tick");
  }

  if (!shuttingDown) {
    pollTimer = setTimeout(pollTick, env.POLL_INTERVAL_MS);
  }
}

async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;

  logger.info({ signal }, "Shutting down gracefully...");
  if (pollTimer) clearTimeout(pollTimer);
  if (heartbeatTimer) clearInterval(heartbeatTimer);
  if (recurringTimer) clearInterval(recurringTimer);

  await markDraining(workerId);

  const drained = Promise.all(Array.from(runningJobs)).then(() => {});
  const timeout = new Promise<void>((resolve) => setTimeout(resolve, env.SHUTDOWN_TIMEOUT_MS));
  await Promise.race([drained, timeout]);

  if (runningJobs.size > 0) {
    logger.warn(
      { remaining: runningJobs.size },
      "Shutdown timeout reached with jobs still running — they will be left in RUNNING state"
    );
  }

  await markOffline(workerId);
  await prisma.$disconnect();
  logger.info("Worker stopped");
  process.exit(0);
}

async function main() {
  const worker = await registerWorker(env.WORKER_CONCURRENCY);
  workerId = worker.id;

  logger.info({ workerId, concurrency: env.WORKER_CONCURRENCY }, "Worker registered, starting poll loop");

  heartbeatTimer = setInterval(() => {
    sendHeartbeat(workerId, runningJobs.size).catch((err) => logger.error({ err }, "Heartbeat failed"));
  }, env.HEARTBEAT_INTERVAL_MS);

  recurringTimer = setInterval(() => {
    if (!shuttingDown) {
      dispatchDueRecurringJobs().catch((err) => logger.error({ err }, "Recurring job dispatch failed"));
    }
  }, env.RECURRING_CHECK_INTERVAL_MS);

  pollTick();
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

main().catch((err) => {
  logger.error({ err }, "Worker failed to start");
  process.exit(1);
});
