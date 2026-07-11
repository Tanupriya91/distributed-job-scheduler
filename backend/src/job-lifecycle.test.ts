import "dotenv/config";
import { describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "./app";
import { authHeader, cleanupOrg, setupQueue } from "./test-helpers";

describe("Job creation and lifecycle", () => {
  it("creates IMMEDIATE, DELAYED, and SCHEDULED jobs with correct status/runAt semantics", async () => {
    const { token, orgId, projectId, queueId } = await setupQueue();
    const base = `/api/organizations/${orgId}/projects/${projectId}/queues/${queueId}/jobs`;

    const immediate = await request(app)
      .post(base)
      .set(authHeader(token))
      .send({ type: "IMMEDIATE", name: "log-message", payload: {} });
    expect(immediate.status).toBe(201);
    expect(immediate.body.status).toBe("QUEUED");

    const delayed = await request(app)
      .post(base)
      .set(authHeader(token))
      .send({ type: "DELAYED", name: "log-message", delaySeconds: 60, payload: {} });
    expect(delayed.status).toBe(201);
    expect(delayed.body.status).toBe("SCHEDULED");
    expect(new Date(delayed.body.runAt).getTime()).toBeGreaterThan(Date.now() + 55_000);

    const futureDate = new Date(Date.now() + 3_600_000).toISOString();
    const scheduled = await request(app)
      .post(base)
      .set(authHeader(token))
      .send({ type: "SCHEDULED", name: "log-message", runAt: futureDate, payload: {} });
    expect(scheduled.status).toBe(201);
    expect(scheduled.body.status).toBe("SCHEDULED");

    await cleanupOrg(orgId);
  });

  it("rejects a SCHEDULED job with a past runAt and a DELAYED job missing delaySeconds", async () => {
    const { token, orgId, projectId, queueId } = await setupQueue();
    const base = `/api/organizations/${orgId}/projects/${projectId}/queues/${queueId}/jobs`;

    const pastScheduled = await request(app)
      .post(base)
      .set(authHeader(token))
      .send({ type: "SCHEDULED", name: "log-message", runAt: "2020-01-01T00:00:00.000Z", payload: {} });
    expect(pastScheduled.status).toBe(400);

    const missingDelay = await request(app)
      .post(base)
      .set(authHeader(token))
      .send({ type: "DELAYED", name: "log-message", payload: {} });
    expect(missingDelay.status).toBe(400);

    await cleanupOrg(orgId);
  });

  it("is idempotent: the same idempotencyKey returns the original job instead of creating a duplicate", async () => {
    const { token, orgId, projectId, queueId } = await setupQueue();
    const base = `/api/organizations/${orgId}/projects/${projectId}/queues/${queueId}/jobs`;

    const first = await request(app)
      .post(base)
      .set(authHeader(token))
      .send({ type: "IMMEDIATE", name: "log-message", payload: { n: 1 }, idempotencyKey: "test-key-1" });
    expect(first.status).toBe(201);

    const second = await request(app)
      .post(base)
      .set(authHeader(token))
      .send({ type: "IMMEDIATE", name: "log-message", payload: { n: 999 }, idempotencyKey: "test-key-1" });
    expect(second.status).toBe(200);
    expect(second.body.id).toBe(first.body.id);
    expect(second.body.payload).toEqual({ n: 1 });

    await cleanupOrg(orgId);
  });

  it("only allows cancelling SCHEDULED/QUEUED jobs, and rejects re-cancelling", async () => {
    const { token, orgId, projectId, queueId } = await setupQueue();
    const base = `/api/organizations/${orgId}/projects/${projectId}/queues/${queueId}/jobs`;

    const job = await request(app)
      .post(base)
      .set(authHeader(token))
      .send({ type: "IMMEDIATE", name: "log-message", payload: {} });

    const cancelled = await request(app).delete(`${base}/${job.body.id}`).set(authHeader(token));
    expect(cancelled.status).toBe(200);
    expect(cancelled.body.status).toBe("CANCELLED");

    const cancelAgain = await request(app).delete(`${base}/${job.body.id}`).set(authHeader(token));
    expect(cancelAgain.status).toBe(409);

    await cleanupOrg(orgId);
  });

  it("filters job listing by status and type", async () => {
    const { token, orgId, projectId, queueId } = await setupQueue();
    const base = `/api/organizations/${orgId}/projects/${projectId}/queues/${queueId}/jobs`;

    await request(app).post(base).set(authHeader(token)).send({ type: "IMMEDIATE", name: "log-message", payload: {} });
    await request(app)
      .post(base)
      .set(authHeader(token))
      .send({ type: "DELAYED", name: "log-message", delaySeconds: 60, payload: {} });

    const immediateOnly = await request(app).get(`${base}?type=IMMEDIATE`).set(authHeader(token));
    expect(immediateOnly.status).toBe(200);
    expect(immediateOnly.body.data.length).toBeGreaterThan(0);
    expect(immediateOnly.body.data.every((j: { type: string }) => j.type === "IMMEDIATE")).toBe(true);

    const scheduledStatus = await request(app).get(`${base}?status=SCHEDULED`).set(authHeader(token));
    expect(scheduledStatus.body.data.every((j: { status: string }) => j.status === "SCHEDULED")).toBe(true);

    await cleanupOrg(orgId);
  });
});
