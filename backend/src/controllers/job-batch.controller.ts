import { Request, Response } from "express";
import { JobStatus, JobType, Prisma, prisma } from "@job-scheduler/db";
import { paginationMeta } from "../utils/pagination";

type BatchJobInput = { name: string; payload: Record<string, unknown>; idempotencyKey?: string };

export async function createJobBatch(req: Request, res: Response) {
  const { queueId } = req.params;
  const { name, jobs } = req.body as { name?: string; jobs: BatchJobInput[] };

  const basePolicy = req.queue!.retryPolicy!;
  const now = new Date();

  const batch = await prisma.jobBatch.create({
    data: {
      name,
      totalJobs: jobs.length,
      queueId,
      jobs: {
        create: jobs.map((job) => ({
          name: job.name,
          type: JobType.IMMEDIATE,
          status: JobStatus.QUEUED,
          payload: job.payload as Prisma.InputJsonValue,
          runAt: now,
          idempotencyKey: job.idempotencyKey,
          retryStrategy: basePolicy.strategy,
          maxAttempts: basePolicy.maxAttempts,
          baseDelaySeconds: basePolicy.baseDelaySeconds,
          maxDelaySeconds: basePolicy.maxDelaySeconds,
          queueId,
        })),
      },
    },
    include: { jobs: true },
  });

  res.status(201).json(batch);
}

export async function listJobBatches(req: Request, res: Response) {
  const { queueId } = req.params;
  const { page, pageSize } = req.query as unknown as { page: number; pageSize: number };

  const where: Prisma.JobBatchWhereInput = { queueId };

  const [data, total] = await Promise.all([
    prisma.jobBatch.findMany({ where, skip: (page - 1) * pageSize, take: pageSize, orderBy: { createdAt: "desc" } }),
    prisma.jobBatch.count({ where }),
  ]);

  res.status(200).json({ data, pagination: paginationMeta(page, pageSize, total) });
}

export async function getJobBatch(req: Request, res: Response) {
  const batch = req.jobBatch!;

  const counts = await prisma.job.groupBy({
    by: ["status"],
    where: { batchId: batch.id },
    _count: true,
  });

  const byStatus = Object.fromEntries(counts.map((c) => [c.status, c._count]));

  res.status(200).json({ ...batch, progress: { total: batch.totalJobs, byStatus } });
}
