import { Router } from "express";
import { Role } from "@job-scheduler/db";
import * as queueController from "../controllers/queue.controller";
import { requireRole } from "../middleware/membership.middleware";
import { loadQueue } from "../middleware/queue.middleware";
import { validateBody, validateQuery } from "../middleware/validate.middleware";
import { createQueueSchema, updateQueueSchema } from "../validation/queue.schema";
import { paginationQuerySchema } from "../validation/pagination.schema";
import { asyncHandler } from "../utils/async-handler";

export const queueRouter = Router({ mergeParams: true });

queueRouter.param("queueId", asyncHandler(loadQueue));

queueRouter.post(
  "/",
  requireRole(Role.OWNER, Role.ADMIN),
  validateBody(createQueueSchema),
  asyncHandler(queueController.createQueue)
);

queueRouter.get("/", validateQuery(paginationQuerySchema), asyncHandler(queueController.listQueues));

queueRouter.get("/:queueId", asyncHandler(queueController.getQueue));

queueRouter.patch(
  "/:queueId",
  requireRole(Role.OWNER, Role.ADMIN),
  validateBody(updateQueueSchema),
  asyncHandler(queueController.updateQueue)
);

queueRouter.delete("/:queueId", requireRole(Role.OWNER, Role.ADMIN), asyncHandler(queueController.deleteQueue));

queueRouter.post(
  "/:queueId/pause",
  requireRole(Role.OWNER, Role.ADMIN),
  asyncHandler(queueController.pauseQueue)
);

queueRouter.post(
  "/:queueId/resume",
  requireRole(Role.OWNER, Role.ADMIN),
  asyncHandler(queueController.resumeQueue)
);
