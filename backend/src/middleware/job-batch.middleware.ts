import { NextFunction, Request, Response } from "express";
import { JobBatch, prisma } from "@job-scheduler/db";
import { AppError } from "../utils/app-error";

declare global {
  namespace Express {
    interface Request {
      jobBatch?: JobBatch;
    }
  }
}

export async function loadJobBatch(req: Request, _res: Response, next: NextFunction, batchId: string) {
  const jobBatch = await prisma.jobBatch.findFirst({
    where: { id: batchId, queueId: req.queue!.id },
  });
  if (!jobBatch) return next(AppError.notFound("Job batch not found"));

  req.jobBatch = jobBatch;
  next();
}
