import "dotenv/config";
import { describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "./app";
import { addMembership, authHeader, cleanupOrg, registerTestUser } from "./test-helpers";

describe("Authorization", () => {
  it("prevents a user from a different organization from reading a project (cross-tenant isolation)", async () => {
    const owner = await registerTestUser();
    const outsider = await registerTestUser();

    const projectRes = await request(app)
      .post(`/api/organizations/${owner.organization.id}/projects`)
      .set(authHeader(owner.token))
      .send({ name: "Private Project" });
    expect(projectRes.status).toBe(201);

    const forbidden = await request(app)
      .get(`/api/organizations/${owner.organization.id}/projects/${projectRes.body.id}`)
      .set(authHeader(outsider.token));

    expect(forbidden.status).toBe(403);
    expect(forbidden.body.error.code).toBe("FORBIDDEN");

    await cleanupOrg(owner.organization.id);
    await cleanupOrg(outsider.organization.id);
  });

  it("restricts queue creation to OWNER/ADMIN — a MEMBER gets 403", async () => {
    const owner = await registerTestUser();
    const member = await registerTestUser();
    await addMembership(member.user.id, owner.organization.id, "MEMBER");

    const projectRes = await request(app)
      .post(`/api/organizations/${owner.organization.id}/projects`)
      .set(authHeader(owner.token))
      .send({ name: "RBAC Test Project" });

    const asMember = await request(app)
      .post(`/api/organizations/${owner.organization.id}/projects/${projectRes.body.id}/queues`)
      .set(authHeader(member.token))
      .send({ name: "member-queue" });
    expect(asMember.status).toBe(403);

    const asOwner = await request(app)
      .post(`/api/organizations/${owner.organization.id}/projects/${projectRes.body.id}/queues`)
      .set(authHeader(owner.token))
      .send({ name: "owner-queue" });
    expect(asOwner.status).toBe(201);

    // A MEMBER can still read — role restriction is on mutation, not visibility.
    const memberRead = await request(app)
      .get(`/api/organizations/${owner.organization.id}/projects/${projectRes.body.id}/queues`)
      .set(authHeader(member.token));
    expect(memberRead.status).toBe(200);

    await cleanupOrg(owner.organization.id);
    await cleanupOrg(member.organization.id);
  });
});
