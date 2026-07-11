import { Job, JobStatus, prisma } from "@job-scheduler/db";
import { getHandler } from "./handlers/registry";
import { logger } from "./logger";

export async function runJob(job: Job): Promise<void> {
  await prisma.job.update({
    where: { id: job.id },
    data: { status: JobStatus.RUNNING, startedAt: new Date() },
  });

  const handler = getHandler(job.name);

  try {
    if (!handler) {
      throw new Error(`No handler registered for job name "${job.name}"`);
    }

    await handler(job.payload as Record<string, unknown>);

    await prisma.job.update({
      where: { id: job.id },
      data: { status: JobStatus.COMPLETED, completedAt: new Date() },
    });
    logger.info({ jobId: job.id, name: job.name }, "Job completed");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    // Phase 4 stops here: the job is simply marked FAILED. Deciding whether
    // it should retry (with backoff) or move to the Dead Letter Queue is
    // Phase 5 reliability logic, not the worker's execution loop.
    await prisma.job.update({
      where: { id: job.id },
      data: {
        status: JobStatus.FAILED,
        completedAt: new Date(),
        attempts: { increment: 1 },
        lastError: message,
      },
    });
    logger.error({ jobId: job.id, name: job.name, err: message }, "Job failed");
  }
}
