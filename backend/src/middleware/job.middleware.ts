import { NextFunction, Request, Response } from "express";
import { Job, prisma } from "@job-scheduler/db";
import { AppError } from "../utils/app-error";

declare global {
  namespace Express {
    interface Request {
      job?: Job;
    }
  }
}

export async function loadJob(req: Request, _res: Response, next: NextFunction, jobId: string) {
  const job = await prisma.job.findFirst({
    where: { id: jobId, queueId: req.queue!.id },
  });
  if (!job) return next(AppError.notFound("Job not found"));

  req.job = job;
  next();
}
