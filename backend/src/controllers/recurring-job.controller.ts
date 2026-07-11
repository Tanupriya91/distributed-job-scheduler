import { parseExpression } from "cron-parser";
import { Request, Response } from "express";
import { Prisma, prisma } from "@job-scheduler/db";
import { paginationMeta } from "../utils/pagination";

type RetryPolicyOverride = {
  strategy?: "FIXED" | "LINEAR" | "EXPONENTIAL";
  maxAttempts?: number;
  baseDelaySeconds?: number;
  maxDelaySeconds?: number;
};

export async function createRecurringJob(req: Request, res: Response) {
  const { queueId } = req.params;
  const { name, cronExpression, payload, retryPolicy } = req.body as {
    name: string;
    cronExpression: string;
    payload: Record<string, unknown>;
    retryPolicy?: RetryPolicyOverride;
  };

  const basePolicy = req.queue!.retryPolicy!;
  const override = retryPolicy ?? {};
  const nextRunAt = parseExpression(cronExpression, { currentDate: new Date() }).next().toDate();

  const recurringJob = await prisma.recurringJob.create({
    data: {
      name,
      cronExpression,
      payload: payload as Prisma.InputJsonValue,
      nextRunAt,
      retryStrategy: override.strategy ?? basePolicy.strategy,
      maxAttempts: override.maxAttempts ?? basePolicy.maxAttempts,
      baseDelaySeconds: override.baseDelaySeconds ?? basePolicy.baseDelaySeconds,
      maxDelaySeconds: override.maxDelaySeconds ?? basePolicy.maxDelaySeconds,
      queueId,
    },
  });

  res.status(201).json(recurringJob);
}

export async function listRecurringJobs(req: Request, res: Response) {
  const { queueId } = req.params;
  const { page, pageSize, search } = req.query as unknown as {
    page: number;
    pageSize: number;
    search?: string;
  };

  const where: Prisma.RecurringJobWhereInput = {
    queueId,
    ...(search ? { name: { contains: search, mode: "insensitive" } } : {}),
  };

  const [data, total] = await Promise.all([
    prisma.recurringJob.findMany({ where, skip: (page - 1) * pageSize, take: pageSize, orderBy: { createdAt: "desc" } }),
    prisma.recurringJob.count({ where }),
  ]);

  res.status(200).json({ data, pagination: paginationMeta(page, pageSize, total) });
}

export async function getRecurringJob(req: Request, res: Response) {
  res.status(200).json(req.recurringJob);
}

export async function updateRecurringJob(req: Request, res: Response) {
  const { name, cronExpression, payload, isPaused, retryPolicy } = req.body as {
    name?: string;
    cronExpression?: string;
    payload?: Record<string, unknown>;
    isPaused?: boolean;
    retryPolicy?: RetryPolicyOverride;
  };

  const recurringJob = await prisma.recurringJob.update({
    where: { id: req.recurringJob!.id },
    data: {
      name,
      cronExpression,
      payload: payload as Prisma.InputJsonValue | undefined,
      isPaused,
      // Changing the schedule restarts it relative to now, rather than the
      // old nextRunAt (which may no longer make sense under the new cron).
      ...(cronExpression ? { nextRunAt: parseExpression(cronExpression, { currentDate: new Date() }).next().toDate() } : {}),
      ...(retryPolicy?.strategy ? { retryStrategy: retryPolicy.strategy } : {}),
      ...(retryPolicy?.maxAttempts !== undefined ? { maxAttempts: retryPolicy.maxAttempts } : {}),
      ...(retryPolicy?.baseDelaySeconds !== undefined ? { baseDelaySeconds: retryPolicy.baseDelaySeconds } : {}),
      ...(retryPolicy?.maxDelaySeconds !== undefined ? { maxDelaySeconds: retryPolicy.maxDelaySeconds } : {}),
    },
  });

  res.status(200).json(recurringJob);
}

export async function deleteRecurringJob(req: Request, res: Response) {
  await prisma.recurringJob.delete({ where: { id: req.recurringJob!.id } });
  res.status(204).send();
}

export async function pauseRecurringJob(req: Request, res: Response) {
  const recurringJob = await prisma.recurringJob.update({
    where: { id: req.recurringJob!.id },
    data: { isPaused: true },
  });
  res.status(200).json(recurringJob);
}

export async function resumeRecurringJob(req: Request, res: Response) {
  const recurringJob = await prisma.recurringJob.update({
    where: { id: req.recurringJob!.id },
    data: { isPaused: false },
  });
  res.status(200).json(recurringJob);
}
