import { env } from "./env";
import express, { Request, Response } from "express";
import { prisma } from "@job-scheduler/db";
import { apiRouter } from "./routes";
import { requestLogger } from "./middleware/request-logger.middleware";
import { errorHandler, notFoundHandler } from "./middleware/error.middleware";
import { logger } from "./logger";

const app = express();

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

app.use("/api", apiRouter);

app.use(notFoundHandler);
app.use(errorHandler);

app.listen(env.PORT, () => {
  logger.info(`Backend API listening on http://localhost:${env.PORT}`);
});
