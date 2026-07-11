import { NextFunction, Request, Response } from "express";
import { RecurringJob, prisma } from "@job-scheduler/db";
import { AppError } from "../utils/app-error";

declare global {
  namespace Express {
    interface Request {
      recurringJob?: RecurringJob;
    }
  }
}

export async function loadRecurringJob(
  req: Request,
  _res: Response,
  next: NextFunction,
  recurringJobId: string
) {
  const recurringJob = await prisma.recurringJob.findFirst({
    where: { id: recurringJobId, queueId: req.queue!.id },
  });
  if (!recurringJob) return next(AppError.notFound("Recurring job not found"));

  req.recurringJob = recurringJob;
  next();
}
