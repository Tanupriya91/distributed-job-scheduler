import { NextFunction, Request, Response } from "express";
import { Project, prisma } from "@job-scheduler/db";
import { AppError } from "../utils/app-error";

declare global {
  namespace Express {
    interface Request {
      project?: Project;
    }
  }
}

export async function loadProject(req: Request, _res: Response, next: NextFunction, projectId: string) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, organizationId: req.params.organizationId },
  });
  if (!project) return next(AppError.notFound("Project not found"));

  req.project = project;
  next();
}
