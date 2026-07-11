import { Router } from "express";
import { Role } from "@job-scheduler/db";
import * as projectController from "../controllers/project.controller";
import { requireOrgMembership, requireRole } from "../middleware/membership.middleware";
import { validateBody, validateQuery } from "../middleware/validate.middleware";
import { createProjectSchema, paginationQuerySchema, updateProjectSchema } from "../validation/project.schema";
import { asyncHandler } from "../utils/async-handler";

export const projectRouter = Router({ mergeParams: true });

projectRouter.use(asyncHandler(requireOrgMembership));

projectRouter.post(
  "/",
  requireRole(Role.OWNER, Role.ADMIN),
  validateBody(createProjectSchema),
  asyncHandler(projectController.createProject)
);

projectRouter.get("/", validateQuery(paginationQuerySchema), asyncHandler(projectController.listProjects));

projectRouter.get("/:projectId", asyncHandler(projectController.getProject));

projectRouter.patch(
  "/:projectId",
  requireRole(Role.OWNER, Role.ADMIN),
  validateBody(updateProjectSchema),
  asyncHandler(projectController.updateProject)
);

projectRouter.delete(
  "/:projectId",
  requireRole(Role.OWNER, Role.ADMIN),
  asyncHandler(projectController.deleteProject)
);
