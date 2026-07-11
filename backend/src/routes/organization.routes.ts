import { Router } from "express";
import * as organizationController from "../controllers/organization.controller";
import { authenticate } from "../middleware/auth.middleware";
import { validateBody } from "../middleware/validate.middleware";
import { createOrganizationSchema } from "../validation/organization.schema";
import { asyncHandler } from "../utils/async-handler";
import { projectRouter } from "./project.routes";

export const organizationRouter = Router();

organizationRouter.use(authenticate);

organizationRouter.post(
  "/",
  validateBody(createOrganizationSchema),
  asyncHandler(organizationController.createOrganization)
);
organizationRouter.get("/", asyncHandler(organizationController.listMyOrganizations));

organizationRouter.use("/:organizationId/projects", projectRouter);
