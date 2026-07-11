import { Router } from "express";
import { authRouter } from "./auth.routes";
import { organizationRouter } from "./organization.routes";
import { workerRouter } from "./worker.routes";

export const apiRouter = Router();

apiRouter.use("/auth", authRouter);
apiRouter.use("/organizations", organizationRouter);
apiRouter.use("/workers", workerRouter);
