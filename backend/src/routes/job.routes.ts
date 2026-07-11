import { Router } from "express";
import * as jobController from "../controllers/job.controller";
import { loadJob } from "../middleware/job.middleware";
import { validateBody, validateQuery } from "../middleware/validate.middleware";
import { createJobSchema, listJobsQuerySchema } from "../validation/job.schema";
import { asyncHandler } from "../utils/async-handler";

export const jobRouter = Router({ mergeParams: true });

jobRouter.param("jobId", asyncHandler(loadJob));

jobRouter.post("/", validateBody(createJobSchema), asyncHandler(jobController.createJob));

jobRouter.get("/", validateQuery(listJobsQuerySchema), asyncHandler(jobController.listJobs));

jobRouter.get("/:jobId", asyncHandler(jobController.getJob));

jobRouter.delete("/:jobId", asyncHandler(jobController.cancelJob));

jobRouter.post("/:jobId/retry", asyncHandler(jobController.retryJob));

jobRouter.get("/:jobId/executions", asyncHandler(jobController.listJobExecutions));
