import { NextFunction, Request, Response } from "express";
import { Queue, RetryPolicy, prisma } from "@job-scheduler/db";
import { AppError } from "../utils/app-error";

type QueueWithRetryPolicy = Queue & { retryPolicy: RetryPolicy | null };

declare global {
  namespace Express {
    interface Request {
      queue?: QueueWithRetryPolicy;
    }
  }
}

export async function loadQueue(req: Request, _res: Response, next: NextFunction, queueId: string) {
  const queue = await prisma.queue.findFirst({
    where: { id: queueId, projectId: req.project!.id },
    include: { retryPolicy: true },
  });
  if (!queue) return next(AppError.notFound("Queue not found"));

  req.queue = queue;
  next();
}
