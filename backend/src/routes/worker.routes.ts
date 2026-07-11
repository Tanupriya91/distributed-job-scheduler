import { Router } from "express";
import * as workerController from "../controllers/worker.controller";
import { authenticate } from "../middleware/auth.middleware";
import { validateQuery } from "../middleware/validate.middleware";
import { paginationQuerySchema } from "../validation/pagination.schema";
import { asyncHandler } from "../utils/async-handler";

// Deliberately NOT nested under /organizations — workers are shared
// infrastructure across all tenants (see Phase 4), not owned by any one
// organization. Any authenticated user can view worker health; this
// exposes operational metadata (hostname, concurrency, heartbeats), never
// tenant job payloads.
export const workerRouter = Router();

workerRouter.use(authenticate);

workerRouter.get("/", validateQuery(paginationQuerySchema), asyncHandler(workerController.listWorkers));

workerRouter.get("/:workerId", asyncHandler(workerController.getWorker));
