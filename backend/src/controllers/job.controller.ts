import { Request, Response } from "express";
import { JobStatus, JobType, Prisma, prisma } from "@job-scheduler/db";
import { AppError } from "../utils/app-error";
import { paginationMeta } from "../utils/pagination";

type RetryPolicyOverride = {
  strategy?: "FIXED" | "LINEAR" | "EXPONENTIAL";
  maxAttempts?: number;
  baseDelaySeconds?: number;
  maxDelaySeconds?: number;
};

type CreateJobBody =
  | {
      type: "IMMEDIATE";
      name: string;
      payload: Record<string, unknown>;
      idempotencyKey?: string;
      retryPolicy?: RetryPolicyOverride;
    }
  | {
      type: "DELAYED";
      name: string;
      delaySeconds: number;
      payload: Record<string, unknown>;
      idempotencyKey?: string;
      retryPolicy?: RetryPolicyOverride;
    }
  | {
      type: "SCHEDULED";
      name: string;
      runAt: Date;
      payload: Record<string, unknown>;
      idempotencyKey?: string;
      retryPolicy?: RetryPolicyOverride;
    };

const CANCELLABLE_STATUSES: JobStatus[] = [JobStatus.SCHEDULED, JobStatus.QUEUED];

export async function createJob(req: Request, res: Response) {
  const { queueId } = req.params;
  const body = req.body as CreateJobBody;

  const basePolicy = req.queue!.retryPolicy!;
  const override = body.retryPolicy ?? {};

  let status: JobStatus;
  let runAt: Date;

  if (body.type === "IMMEDIATE") {
    status = JobStatus.QUEUED;
    runAt = new Date();
  } else if (body.type === "DELAYED") {
    status = JobStatus.SCHEDULED;
    runAt = new Date(Date.now() + body.delaySeconds * 1000);
  } else {
    status = JobStatus.SCHEDULED;
    runAt = body.runAt;
  }

  const data = {
    name: body.name,
    type: body.type as JobType,
    status,
    payload: body.payload as Prisma.InputJsonValue,
    runAt,
    retryStrategy: override.strategy ?? basePolicy.strategy,
    maxAttempts: override.maxAttempts ?? basePolicy.maxAttempts,
    baseDelaySeconds: override.baseDelaySeconds ?? basePolicy.baseDelaySeconds,
    maxDelaySeconds: override.maxDelaySeconds ?? basePolicy.maxDelaySeconds,
    idempotencyKey: body.idempotencyKey,
    queueId,
  };

  try {
    const job = await prisma.job.create({ data });
    res.status(201).json(job);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002" && body.idempotencyKey) {
      const existing = await prisma.job.findFirst({
        where: { queueId, idempotencyKey: body.idempotencyKey },
      });
      if (existing) {
        res.status(200).json(existing);
        return;
      }
    }
    throw err;
  }
}

export async function listJobs(req: Request, res: Response) {
  const { queueId } = req.params;
  const { page, pageSize, status, type } = req.query as unknown as {
    page: number;
    pageSize: number;
    status?: JobStatus;
    type?: JobType;
  };

  const where: Prisma.JobWhereInput = {
    queueId,
    ...(status ? { status } : {}),
    ...(type ? { type } : {}),
  };

  const [data, total] = await Promise.all([
    prisma.job.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { createdAt: "desc" },
    }),
    prisma.job.count({ where }),
  ]);

  res.status(200).json({ data, pagination: paginationMeta(page, pageSize, total) });
}

export async function getJob(req: Request, res: Response) {
  res.status(200).json(req.job);
}

export async function cancelJob(req: Request, res: Response) {
  if (!CANCELLABLE_STATUSES.includes(req.job!.status)) {
    throw AppError.conflict(`Cannot cancel a job in ${req.job!.status} state`);
  }

  const job = await prisma.job.update({
    where: { id: req.job!.id },
    data: { status: JobStatus.CANCELLED },
  });

  res.status(200).json(job);
}
