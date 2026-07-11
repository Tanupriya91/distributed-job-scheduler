import { Router } from "express";
import { authRouter } from "./auth.routes";
import { organizationRouter } from "./organization.routes";

export const apiRouter = Router();

apiRouter.use("/auth", authRouter);
apiRouter.use("/organizations", organizationRouter);
