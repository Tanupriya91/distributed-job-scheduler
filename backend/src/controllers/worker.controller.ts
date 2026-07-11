import { Request, Response } from "express";
import { Worker, prisma } from "@job-scheduler/db";
import { AppError } from "../utils/app-error";
import { paginationMeta } from "../utils/pagination";

// A worker is considered healthy if it's ACTIVE and has heartbeated recently.
// 30s = 3x the default 10s heartbeat interval, giving room for a couple of
// missed beats before flagging it stale. This is a fixed heuristic, not
// read from each worker's actual configured interval (which isn't stored) —
// a reasonable simplification for a dashboard health indicator.
const STALE_THRESHOLD_MS = 30_000;

function withHealth(worker: Worker) {
  return {
    ...worker,
    isHealthy: worker.status === "ACTIVE" && Date.now() - worker.lastSeenAt.getTime() < STALE_THRESHOLD_MS,
  };
}

export async function listWorkers(req: Request, res: Response) {
  const { page, pageSize } = req.query as unknown as { page: number; pageSize: number };

  const [data, total] = await Promise.all([
    prisma.worker.findMany({ skip: (page - 1) * pageSize, take: pageSize, orderBy: { startedAt: "desc" } }),
    prisma.worker.count(),
  ]);

  res.status(200).json({ data: data.map(withHealth), pagination: paginationMeta(page, pageSize, total) });
}

export async function getWorker(req: Request, res: Response) {
  const worker = await prisma.worker.findUnique({ where: { id: req.params.workerId } });
  if (!worker) throw AppError.notFound("Worker not found");

  const [activeJobCount, recentHeartbeats] = await Promise.all([
    prisma.job.count({ where: { workerId: worker.id, status: { in: ["CLAIMED", "RUNNING"] } } }),
    prisma.workerHeartbeat.findMany({ where: { workerId: worker.id }, orderBy: { createdAt: "desc" }, take: 20 }),
  ]);

  res.status(200).json({ ...withHealth(worker), activeJobCount, recentHeartbeats });
}
