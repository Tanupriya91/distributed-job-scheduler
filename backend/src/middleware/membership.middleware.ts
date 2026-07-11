import { NextFunction, Request, Response } from "express";
import { prisma, Role } from "@job-scheduler/db";
import { AppError } from "../utils/app-error";

declare global {
  namespace Express {
    interface Request {
      membership?: { organizationId: string; role: Role };
    }
  }
}

export async function requireOrgMembership(req: Request, _res: Response, next: NextFunction) {
  const { organizationId } = req.params;

  const membership = await prisma.organizationMembership.findUnique({
    where: { userId_organizationId: { userId: req.user!.id, organizationId } },
  });

  if (!membership) {
    return next(AppError.forbidden("You are not a member of this organization"));
  }

  req.membership = { organizationId, role: membership.role };
  next();
}

export function requireRole(...allowed: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.membership || !allowed.includes(req.membership.role)) {
      return next(AppError.forbidden(`Requires one of the following roles: ${allowed.join(", ")}`));
    }
    next();
  };
}
