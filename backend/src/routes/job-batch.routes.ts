import { Router } from "express";
import * as jobBatchController from "../controllers/job-batch.controller";
import { loadJobBatch } from "../middleware/job-batch.middleware";
import { validateBody, validateQuery } from "../middleware/validate.middleware";
import { createJobBatchSchema } from "../validation/job-batch.schema";
import { paginationQuerySchema } from "../validation/pagination.schema";
import { asyncHandler } from "../utils/async-handler";

export const jobBatchRouter = Router({ mergeParams: true });

jobBatchRouter.param("batchId", asyncHandler(loadJobBatch));

jobBatchRouter.post("/", validateBody(createJobBatchSchema), asyncHandler(jobBatchController.createJobBatch));

jobBatchRouter.get("/", validateQuery(paginationQuerySchema), asyncHandler(jobBatchController.listJobBatches));

jobBatchRouter.get("/:batchId", asyncHandler(jobBatchController.getJobBatch));
