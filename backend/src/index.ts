import express, { Request, Response } from "express";
import { prisma } from "@job-scheduler/db";

const app = express();
const PORT = process.env.PORT || 4000;

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
    console.error("Database health check failed:", err);
    res.status(500).json({ status: "error", database: "unreachable" });
  }
});

app.listen(PORT, () => {
  console.log(`Backend API listening on http://localhost:${PORT}`);
});