import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@job-scheduler/db";
import { claimJobsForQueue } from "./claim";

describe("claimJobsForQueue", () => {
  let organizationId: string;
  let queueId: string;
  let pausedQueueId: string;
  let workerIds: string[];

  beforeAll(async () => {
    const org = await prisma.organization.create({
      data: { name: "Claim Test Org", slug: `claim-test-org-${Date.now()}` },
    });
    organizationId = org.id;

    const project = await prisma.project.create({
      data: { name: "Claim Test Project", slug: "claim-test-project", organizationId },
    });

    const queue = await prisma.queue.create({
      data: { name: "claim-test-queue", concurrencyLimit: 3, projectId: project.id, retryPolicy: { create: {} } },
    });
    queueId = queue.id;

    const pausedQueue = await prisma.queue.create({
      data: {
        name: "paused-queue",
        concurrencyLimit: 5,
        isPaused: true,
        projectId: project.id,
        retryPolicy: { create: {} },
      },
    });
    pausedQueueId = pausedQueue.id;

    const workers = await Promise.all(
      Array.from({ length: 5 }, (_, i) =>
        prisma.worker.create({ data: { hostname: "test-host", pid: 1000 + i, concurrency: 5 } })
      )
    );
    workerIds = workers.map((w) => w.id);

    await prisma.job.createMany({
      data: Array.from({ length: 10 }, () => ({
        name: "log-message",
        type: "IMMEDIATE" as const,
        status: "QUEUED" as const,
        payload: {},
        runAt: new Date(),
        retryStrategy: "FIXED" as const,
        maxAttempts: 3,
        baseDelaySeconds: 30,
        maxDelaySeconds: 3600,
        queueId,
      })),
    });
  });

  afterAll(async () => {
    await prisma.organization.delete({ where: { id: organizationId } });
    await prisma.worker.deleteMany({ where: { id: { in: workerIds } } });
    await prisma.$disconnect();
  });

  it("never claims more jobs than the queue's concurrencyLimit, even under concurrent claimers", async () => {
    // Simulate 5 workers polling the SAME queue at the same instant, each
    // trying to grab up to 5 jobs, against a queue whose concurrencyLimit
    // is only 3. This is the scenario that breaks a naive "check count,
    // then claim" implementation.
    const results = await Promise.all(workerIds.map((workerId) => claimJobsForQueue(queueId, 3, workerId, 5)));

    const allClaimedIds = results.flatMap((jobs) => jobs.map((j) => j.id));
    const uniqueIds = new Set(allClaimedIds);

    expect(uniqueIds.size).toBe(allClaimedIds.length); // no job claimed twice
    expect(allClaimedIds.length).toBe(3); // never exceeds concurrencyLimit

    const stillQueued = await prisma.job.count({ where: { queueId, status: "QUEUED" } });
    expect(stillQueued).toBe(7);
  });

  it("leaves paused-queue jobs eligible in the DB but marks the queue as paused for the poll loop to skip", async () => {
    await prisma.job.create({
      data: {
        name: "log-message",
        type: "IMMEDIATE",
        status: "QUEUED",
        payload: {},
        runAt: new Date(),
        retryStrategy: "FIXED",
        maxAttempts: 3,
        baseDelaySeconds: 30,
        maxDelaySeconds: 3600,
        queueId: pausedQueueId,
      },
    });

    const queue = await prisma.queue.findUniqueOrThrow({ where: { id: pausedQueueId } });
    expect(queue.isPaused).toBe(true);

    // claimJobsForQueue has no opinion on pause state by design — the poll
    // loop filters isPaused=false queues out before ever calling it. Confirm
    // that contract: if called directly against a paused queue, it still
    // claims (the safety belongs to the caller, not this function).
    const claimed = await claimJobsForQueue(pausedQueueId, 5, workerIds[0], 5);
    expect(claimed.length).toBe(1);
  });

  it("claims a SCHEDULED job whose runAt is in the past but not one in the future", async () => {
    const past = await prisma.job.create({
      data: {
        name: "log-message",
        type: "SCHEDULED",
        status: "SCHEDULED",
        payload: {},
        runAt: new Date(Date.now() - 1000),
        retryStrategy: "FIXED",
        maxAttempts: 3,
        baseDelaySeconds: 30,
        maxDelaySeconds: 3600,
        queueId,
      },
    });
    const future = await prisma.job.create({
      data: {
        name: "log-message",
        type: "SCHEDULED",
        status: "SCHEDULED",
        payload: {},
        runAt: new Date(Date.now() + 3_600_000),
        retryStrategy: "FIXED",
        maxAttempts: 3,
        baseDelaySeconds: 30,
        maxDelaySeconds: 3600,
        queueId,
      },
    });

    const claimed = await claimJobsForQueue(queueId, 100, workerIds[0], 20);
    const claimedIds = claimed.map((j) => j.id);

    expect(claimedIds).toContain(past.id);
    expect(claimedIds).not.toContain(future.id);
  });
});
