import "dotenv/config";
import "./handlers/examples";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Job, Prisma, prisma } from "@job-scheduler/db";
import { runJob } from "./execution";

describe("runJob", () => {
  let organizationId: string;
  let queueId: string;
  let workerId: string;

  beforeAll(async () => {
    const org = await prisma.organization.create({
      data: { name: "Execution Test Org", slug: `execution-test-org-${Date.now()}` },
    });
    organizationId = org.id;

    const project = await prisma.project.create({
      data: { name: "Execution Test Project", slug: "execution-test-project", organizationId },
    });

    const queue = await prisma.queue.create({
      data: { name: "execution-test-queue", concurrencyLimit: 5, projectId: project.id, retryPolicy: { create: {} } },
    });
    queueId = queue.id;

    const worker = await prisma.worker.create({ data: { hostname: "test", pid: 1, concurrency: 5 } });
    workerId = worker.id;
  });

  afterAll(async () => {
    await prisma.organization.delete({ where: { id: organizationId } });
    await prisma.worker.delete({ where: { id: workerId } });
    await prisma.$disconnect();
  });

  async function createJob(overrides: Partial<Prisma.JobUncheckedCreateInput> = {}): Promise<Job> {
    return prisma.job.create({
      data: {
        name: "log-message",
        type: "IMMEDIATE",
        status: "CLAIMED",
        payload: {},
        runAt: new Date(),
        attempts: 0,
        retryStrategy: "FIXED",
        maxAttempts: 3,
        baseDelaySeconds: 30,
        maxDelaySeconds: 3600,
        queueId,
        workerId,
        claimedAt: new Date(),
        ...overrides,
      },
    });
  }

  it("marks a successful job COMPLETED and records a JobExecution row", async () => {
    const job = await createJob({ name: "log-message" });
    await runJob(job);

    const updated = await prisma.job.findUniqueOrThrow({ where: { id: job.id } });
    expect(updated.status).toBe("COMPLETED");
    expect(updated.attempts).toBe(1);

    const executions = await prisma.jobExecution.findMany({ where: { jobId: job.id } });
    expect(executions).toHaveLength(1);
    expect(executions[0].status).toBe("COMPLETED");
  });

  it("schedules a retry (SCHEDULED, cleared claim fields) when a job fails and attempts remain", async () => {
    const job = await createJob({ name: "fail-randomly", payload: { failureRate: 1 }, maxAttempts: 3 });
    await runJob(job);

    const updated = await prisma.job.findUniqueOrThrow({ where: { id: job.id } });
    expect(updated.status).toBe("SCHEDULED");
    expect(updated.attempts).toBe(1);
    expect(updated.workerId).toBeNull();
    expect(updated.claimedAt).toBeNull();
    expect(updated.runAt.getTime()).toBeGreaterThan(Date.now());

    const executions = await prisma.jobExecution.findMany({ where: { jobId: job.id } });
    expect(executions).toHaveLength(1);
    expect(executions[0].status).toBe("FAILED");
  });

  it("moves a job to DEAD_LETTER with a DeadLetterQueue entry once retries are exhausted", async () => {
    const job = await createJob({ name: "fail-randomly", payload: { failureRate: 1 }, maxAttempts: 1 });
    await runJob(job);

    const updated = await prisma.job.findUniqueOrThrow({ where: { id: job.id } });
    expect(updated.status).toBe("DEAD_LETTER");
    expect(updated.attempts).toBe(1);

    const dlq = await prisma.deadLetterQueue.findUnique({ where: { jobId: job.id } });
    expect(dlq).not.toBeNull();
    expect(dlq?.reason).toContain("Simulated failure");
  });

  it("fails with a clear error when no handler is registered for the job name", async () => {
    const job = await createJob({ name: "totally-unregistered-handler", maxAttempts: 1 });
    await runJob(job);

    const updated = await prisma.job.findUniqueOrThrow({ where: { id: job.id } });
    expect(updated.status).toBe("DEAD_LETTER");
    expect(updated.lastError).toContain("No handler registered");
  });
});
