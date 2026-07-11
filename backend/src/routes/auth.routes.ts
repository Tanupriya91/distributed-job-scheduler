import { Router } from "express";
import * as authController from "../controllers/auth.controller";
import { authenticate } from "../middleware/auth.middleware";
import { validateBody } from "../middleware/validate.middleware";
import { authRateLimiter } from "../middleware/rate-limit.middleware";
import { loginSchema, registerSchema } from "../validation/auth.schema";
import { asyncHandler } from "../utils/async-handler";

export const authRouter = Router();

authRouter.post(
  "/register",
  authRateLimiter,
  validateBody(registerSchema),
  asyncHandler(authController.register)
);
authRouter.post("/login", authRateLimiter, validateBody(loginSchema), asyncHandler(authController.login));
authRouter.get("/me", authenticate, asyncHandler(authController.me));
