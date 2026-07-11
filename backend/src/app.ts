import { env } from "./env";
import express, { Request, Response } from "express";
import cors from "cors";
import { prisma } from "@job-scheduler/db";
import { apiRouter } from "./routes";
import { requestLogger } from "./middleware/request-logger.middleware";
import { errorHandler, notFoundHandler } from "./middleware/error.middleware";
import { apiRateLimiter } from "./middleware/rate-limit.middleware";
import { logger } from "./logger";

export const app = express();

app.use(cors({ origin: env.FRONTEND_ORIGIN }));
app.use(requestLogger);
app.use(express.json());

app.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({
    status: "ok",
    service: "backend-api",
    timestamp: new Date().toISOString(),
  });
});

app.get("/health/db", async (_req: Request, res: Response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({ status: "ok", database: "connected" });
  } catch (err) {
    logger.error({ err }, "Database health check failed");
    res.status(500).json({ status: "error", database: "unreachable" });
  }
});

app.use("/api", apiRateLimiter, apiRouter);

app.use(notFoundHandler);
app.use(errorHandler);
