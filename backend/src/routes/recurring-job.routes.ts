import { Router } from "express";
import { Role } from "@job-scheduler/db";
import * as recurringJobController from "../controllers/recurring-job.controller";
import { requireRole } from "../middleware/membership.middleware";
import { loadRecurringJob } from "../middleware/recurring-job.middleware";
import { validateBody, validateQuery } from "../middleware/validate.middleware";
import { createRecurringJobSchema, updateRecurringJobSchema } from "../validation/recurring-job.schema";
import { paginationQuerySchema } from "../validation/pagination.schema";
import { asyncHandler } from "../utils/async-handler";

export const recurringJobRouter = Router({ mergeParams: true });

recurringJobRouter.param("recurringJobId", asyncHandler(loadRecurringJob));

recurringJobRouter.post(
  "/",
  requireRole(Role.OWNER, Role.ADMIN),
  validateBody(createRecurringJobSchema),
  asyncHandler(recurringJobController.createRecurringJob)
);

recurringJobRouter.get(
  "/",
  validateQuery(paginationQuerySchema),
  asyncHandler(recurringJobController.listRecurringJobs)
);

recurringJobRouter.get("/:recurringJobId", asyncHandler(recurringJobController.getRecurringJob));

recurringJobRouter.patch(
  "/:recurringJobId",
  requireRole(Role.OWNER, Role.ADMIN),
  validateBody(updateRecurringJobSchema),
  asyncHandler(recurringJobController.updateRecurringJob)
);

recurringJobRouter.delete(
  "/:recurringJobId",
  requireRole(Role.OWNER, Role.ADMIN),
  asyncHandler(recurringJobController.deleteRecurringJob)
);

recurringJobRouter.post(
  "/:recurringJobId/pause",
  requireRole(Role.OWNER, Role.ADMIN),
  asyncHandler(recurringJobController.pauseRecurringJob)
);

recurringJobRouter.post(
  "/:recurringJobId/resume",
  requireRole(Role.OWNER, Role.ADMIN),
  asyncHandler(recurringJobController.resumeRecurringJob)
);
