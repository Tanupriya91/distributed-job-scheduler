import { Job, JobExecutionStatus, JobStatus, prisma } from "@job-scheduler/db";
import { getHandler } from "./handlers/registry";
import { logger } from "./logger";
import { computeNextRunAt } from "./retry";

export async function runJob(job: Job): Promise<void> {
  const startedAt = new Date();

  await prisma.job.update({
    where: { id: job.id },
    data: { status: JobStatus.RUNNING, startedAt },
  });

  const handler = getHandler(job.name);
  const attemptNumber = job.attempts + 1;

  try {
    if (!handler) {
      throw new Error(`No handler registered for job name "${job.name}"`);
    }

    await handler(job.payload as Record<string, unknown>);

    const completedAt = new Date();
    await prisma.$transaction([
      prisma.job.update({
        where: { id: job.id },
        data: { status: JobStatus.COMPLETED, completedAt, attempts: attemptNumber },
      }),
      prisma.jobExecution.create({
        data: {
          jobId: job.id,
          attemptNumber,
          status: JobExecutionStatus.COMPLETED,
          startedAt,
          completedAt,
          workerId: job.workerId,
        },
      }),
    ]);
    logger.info({ jobId: job.id, name: job.name, attemptNumber }, "Job completed");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const completedAt = new Date();

    const willRetry = attemptNumber < job.maxAttempts;

    if (willRetry) {
      const nextRunAt = computeNextRunAt(
        job.retryStrategy,
        attemptNumber,
        job.baseDelaySeconds,
        job.maxDelaySeconds,
        completedAt
      );

      await prisma.$transaction([
        prisma.job.update({
          where: { id: job.id },
          data: {
            status: JobStatus.SCHEDULED,
            runAt: nextRunAt,
            attempts: attemptNumber,
            lastError: message,
            // Clear claim/execution fields — this job is unclaimed again,
            // waiting for its next scheduled attempt.
            workerId: null,
            claimedAt: null,
            startedAt: null,
          },
        }),
        prisma.jobExecution.create({
          data: {
            jobId: job.id,
            attemptNumber,
            status: JobExecutionStatus.FAILED,
            startedAt,
            completedAt,
            error: message,
            workerId: job.workerId,
          },
        }),
      ]);
      logger.warn(
        { jobId: job.id, name: job.name, attemptNumber, maxAttempts: job.maxAttempts, nextRunAt },
        "Job failed, retry scheduled"
      );
    } else {
      await prisma.$transaction([
        prisma.job.update({
          where: { id: job.id },
          data: { status: JobStatus.DEAD_LETTER, completedAt, attempts: attemptNumber, lastError: message },
        }),
        prisma.jobExecution.create({
          data: {
            jobId: job.id,
            attemptNumber,
            status: JobExecutionStatus.FAILED,
            startedAt,
            completedAt,
            error: message,
            workerId: job.workerId,
          },
        }),
        prisma.deadLetterQueue.create({
          data: { jobId: job.id, reason: message },
        }),
      ]);
      logger.error(
        { jobId: job.id, name: job.name, attemptNumber, maxAttempts: job.maxAttempts },
        "Job exhausted retries, moved to Dead Letter Queue"
      );
    }
  }
}
