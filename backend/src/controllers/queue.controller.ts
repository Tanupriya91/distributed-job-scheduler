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
