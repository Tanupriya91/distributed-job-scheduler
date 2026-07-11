import { parseExpression } from "cron-parser";
import { JobStatus, JobType, prisma } from "@job-scheduler/db";
import { logger } from "./logger";

/**
 * Finds RecurringJob definitions whose nextRunAt has arrived, and for each
 * one: atomically claims the "firing" and spawns a real Job row.
 *
 * Race safety: multiple worker processes may run this tick concurrently.
 * The claim is a single-row conditional UPDATE
 * (`WHERE id = ? AND "nextRunAt" <= now()`), which Postgres re-checks
 * against the row's committed state at lock time — unlike the bug fixed in
 * claim.ts, this doesn't need an advisory lock because the condition being
 * checked (nextRunAt) IS the row being updated, so Postgres's normal
 * read-committed row-locking behavior already gives a fresh read for free.
 * Whichever worker's UPDATE affects 1 row "wins" the firing; the other
 * worker's UPDATE affects 0 rows (nextRunAt is already in the future by
 * then) and it skips spawning a duplicate Job.
 */
export async function dispatchDueRecurringJobs(): Promise<void> {
  const due = await prisma.recurringJob.findMany({
    where: { isPaused: false, nextRunAt: { lte: new Date() } },
    select: { id: true, cronExpression: true, nextRunAt: true },
  });

  for (const recurringJob of due) {
    let nextRunAt: Date;
    try {
      nextRunAt = parseExpression(recurringJob.cronExpression, { currentDate: recurringJob.nextRunAt })
        .next()
        .toDate();
    } catch (err) {
      logger.error({ err, recurringJobId: recurringJob.id }, "Invalid cron expression, skipping");
      continue;
    }

    const { count } = await prisma.recurringJob.updateMany({
      where: { id: recurringJob.id, nextRunAt: { lte: new Date() } },
      data: { nextRunAt, lastRunAt: new Date() },
    });

    if (count === 0) continue; // another worker already claimed this firing

    const full = await prisma.recurringJob.findUniqueOrThrow({ where: { id: recurringJob.id } });

    await prisma.job.create({
      data: {
        name: full.name,
        type: JobType.RECURRING,
        status: JobStatus.QUEUED,
        payload: full.payload as object,
        runAt: new Date(),
        retryStrategy: full.retryStrategy,
        maxAttempts: full.maxAttempts,
        baseDelaySeconds: full.baseDelaySeconds,
        maxDelaySeconds: full.maxDelaySeconds,
        queueId: full.queueId,
        recurringJobId: full.id,
      },
    });

    logger.info({ recurringJobId: full.id, name: full.name, nextRunAt }, "Spawned job from recurring definition");
  }
}
