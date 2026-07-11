import os from "os";
import { Worker, WorkerStatus, prisma } from "@job-scheduler/db";

export async function registerWorker(concurrency: number): Promise<Worker> {
  return prisma.worker.create({
    data: {
      hostname: os.hostname(),
      pid: process.pid,
      concurrency,
      status: WorkerStatus.ACTIVE,
    },
  });
}

export async function markDraining(workerId: string): Promise<void> {
  await prisma.worker.update({ where: { id: workerId }, data: { status: WorkerStatus.DRAINING } });
}

export async function markOffline(workerId: string): Promise<void> {
  await prisma.worker.update({
    where: { id: workerId },
    data: { status: WorkerStatus.OFFLINE, stoppedAt: new Date() },
  });
}
