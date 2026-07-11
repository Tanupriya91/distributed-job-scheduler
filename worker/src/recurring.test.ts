import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@job-scheduler/db";
import { dispatchDueRecurringJobs } from "./recurring";

describe("dispatchDueRecurringJobs", () => {
  let organizationId: string;
  let recurringJobId: string;

  beforeAll(async () => {
    const org = await prisma.organization.create({
      data: { name: "Recurring Test Org", slug: `recurring-test-org-${Date.now()}` },
    });
    organizationId = org.id;

    const project = await prisma.project.create({
      data: { name: "Recurring Test Project", slug: "recurring-test-project", organizationId },
    });

    const queue = await prisma.queue.create({
      data: { name: "recurring-test-queue", concurrencyLimit: 5, projectId: project.id, retryPolicy: { create: {} } },
    });

    const recurringJob = await prisma.recurringJob.create({
      data: {
        name: "log-message",
        cronExpression: "*/10 * * * * *",
        payload: {},
        nextRunAt: new Date(Date.now() - 1000), // already due
        retryStrategy: "FIXED",
        maxAttempts: 3,
        baseDelaySeconds: 30,
        maxDelaySeconds: 3600,
        queueId: queue.id,
      },
    });
    recurringJobId = recurringJob.id;
  });

  afterAll(async () => {
    await prisma.organization.delete({ where: { id: organizationId } });
    await prisma.$disconnect();
  });

  it("spawns exactly one Job even when multiple dispatch ticks race for the same firing", async () => {
    // Simulates multiple worker processes each running their own
    // RECURRING_CHECK_INTERVAL_MS tick at the same instant against the
    // same due RecurringJob.
    await Promise.all(Array.from({ length: 5 }, () => dispatchDueRecurringJobs()));

    const spawned = await prisma.job.findMany({ where: { recurringJobId } });
    expect(spawned).toHaveLength(1);

    const updated = await prisma.recurringJob.findUniqueOrThrow({ where: { id: recurringJobId } });
    expect(updated.nextRunAt.getTime()).toBeGreaterThan(Date.now());
    expect(updated.lastRunAt).not.toBeNull();
  });
});
