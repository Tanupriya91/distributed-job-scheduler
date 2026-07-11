import { prisma } from "@job-scheduler/db";

export async function sendHeartbeat(workerId: string, activeJobs: number): Promise<void> {
  await prisma.$transaction([
    prisma.worker.update({ where: { id: workerId }, data: { lastSeenAt: new Date() } }),
    prisma.workerHeartbeat.create({ data: { workerId, activeJobs } }),
  ]);
}
