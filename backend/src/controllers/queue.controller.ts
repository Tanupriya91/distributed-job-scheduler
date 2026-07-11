import { Request, Response } from "express";
import { Prisma, prisma } from "@job-scheduler/db";
import { paginationMeta } from "../utils/pagination";

type RetryPolicyInput = {
  strategy: "FIXED" | "LINEAR" | "EXPONENTIAL";
  maxAttempts: number;
  baseDelaySeconds: number;
  maxDelaySeconds: number;
};

export async function createQueue(req: Request, res: Response) {
  const { projectId } = req.params;
  const { name, priority, concurrencyLimit, retryPolicy } = req.body as {
    name: string;
    priority: number;
    concurrencyLimit: number;
    retryPolicy: RetryPolicyInput;
  };

  const queue = await prisma.queue.create({
    data: {
      name,
      priority,
      concurrencyLimit,
      projectId,
      retryPolicy: { create: retryPolicy },
    },
    include: { retryPolicy: true },
  });

  res.status(201).json(queue);
}

export async function listQueues(req: Request, res: Response) {
  const { projectId } = req.params;
  const { page, pageSize, search } = req.query as unknown as {
    page: number;
    pageSize: number;
    search?: string;
  };

  const where: Prisma.QueueWhereInput = {
    projectId,
    ...(search ? { name: { contains: search, mode: "insensitive" } } : {}),
  };

  const [data, total] = await Promise.all([
    prisma.queue.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
      include: { retryPolicy: true },
    }),
    prisma.queue.count({ where }),
  ]);

  res.status(200).json({ data, pagination: paginationMeta(page, pageSize, total) });
}

export async function getQueue(req: Request, res: Response) {
  res.status(200).json(req.queue);
}

export async function updateQueue(req: Request, res: Response) {
  const { retryPolicy, ...queueFields } = req.body as {
    name?: string;
    priority?: number;
    concurrencyLimit?: number;
    isPaused?: boolean;
    retryPolicy?: Partial<RetryPolicyInput>;
  };

  const queue = await prisma.queue.update({
    where: { id: req.queue!.id },
    data: {
      ...queueFields,
      ...(retryPolicy ? { retryPolicy: { update: retryPolicy } } : {}),
    },
    include: { retryPolicy: true },
  });

  res.status(200).json(queue);
}

export async function deleteQueue(req: Request, res: Response) {
  await prisma.queue.delete({ where: { id: req.queue!.id } });
  res.status(204).send();
}

export async function pauseQueue(req: Request, res: Response) {
  const queue = await prisma.queue.update({
    where: { id: req.queue!.id },
    data: { isPaused: true },
    include: { retryPolicy: true },
  });
  res.status(200).json(queue);
}

export async function resumeQueue(req: Request, res: Response) {
  const queue = await prisma.queue.update({
    where: { id: req.queue!.id },
    data: { isPaused: false },
    include: { retryPolicy: true },
  });
  res.status(200).json(queue);
}

export async function getQueueStats(req: Request, res: Response) {
  const queueId = req.queue!.id;
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

  const [statusCounts, completedLastHour, deadLetteredLastHour, failedAttemptsLastHour, avgExecution] =
    await Promise.all([
      prisma.job.groupBy({ by: ["status"], where: { queueId }, _count: true }),
      prisma.job.count({ where: { queueId, status: "COMPLETED", completedAt: { gte: oneHourAgo } } }),
      prisma.job.count({ where: { queueId, status: "DEAD_LETTER", completedAt: { gte: oneHourAgo } } }),
      prisma.jobExecution.count({
        where: { status: "FAILED", createdAt: { gte: oneHourAgo }, job: { queueId } },
      }),
      prisma.$queryRaw<{ avg_ms: string | null }[]>`
        SELECT AVG(EXTRACT(EPOCH FROM (je."completedAt" - je."startedAt")) * 1000) as avg_ms
        FROM "JobExecution" je
        JOIN "Job" j ON j.id = je."jobId"
        WHERE j."queueId" = ${queueId} AND je.status = 'COMPLETED' AND je."createdAt" >= ${oneHourAgo}
      `,
    ]);

  // Postgres AVG() over an EXTRACT(EPOCH ...) expression comes back through
  // Prisma's $queryRaw as a numeric string, not a JS number — coerce it so
  // the API's JSON contract is a proper number, not "5.833333333333333".
  const avgMs = avgExecution[0]?.avg_ms;

  res.status(200).json({
    statusCounts: Object.fromEntries(statusCounts.map((c) => [c.status, c._count])),
    throughputLastHour: { completed: completedLastHour, deadLettered: deadLetteredLastHour, failedAttempts: failedAttemptsLastHour },
    avgExecutionMs: avgMs !== null && avgMs !== undefined ? Math.round(Number(avgMs)) : null,
  });
}

export async function listQueueExecutions(req: Request, res: Response) {
  const queueId = req.queue!.id;
  const { page, pageSize, status } = req.query as unknown as {
    page: number;
    pageSize: number;
    status?: "COMPLETED" | "FAILED";
  };

  const where: Prisma.JobExecutionWhereInput = {
    job: { queueId },
    ...(status ? { status } : {}),
  };

  const [data, total] = await Promise.all([
    prisma.jobExecution.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { createdAt: "desc" },
      include: { job: { select: { id: true, name: true, status: true } } },
    }),
    prisma.jobExecution.count({ where }),
  ]);

  res.status(200).json({ data, pagination: paginationMeta(page, pageSize, total) });
}

export async function listDeadLetterQueue(req: Request, res: Response) {
  const queueId = req.queue!.id;
  const { page, pageSize } = req.query as unknown as { page: number; pageSize: number };

  const where: Prisma.DeadLetterQueueWhereInput = { job: { queueId } };

  const [data, total] = await Promise.all([
    prisma.deadLetterQueue.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { failedAt: "desc" },
      include: { job: { select: { id: true, name: true, payload: true, attempts: true } } },
    }),
    prisma.deadLetterQueue.count({ where }),
  ]);

  res.status(200).json({ data, pagination: paginationMeta(page, pageSize, total) });
}
