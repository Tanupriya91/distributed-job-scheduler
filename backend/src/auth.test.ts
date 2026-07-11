import "dotenv/config";
import { describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "./app";
import { cleanupOrg, registerTestUser } from "./test-helpers";

describe("Auth", () => {
  it("registers a new user with a new organization", async () => {
    const email = `auth-register-${Date.now()}@example.com`;
    const res = await request(app)
      .post("/api/auth/register")
      .send({ email, password: "password123", organizationName: "Auth Test Org" });

    expect(res.status).toBe(201);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user.email).toBe(email);
    expect(res.body.organization.name).toBe("Auth Test Org");

    await cleanupOrg(res.body.organization.id);
  });

  it("rejects duplicate email registration with 409", async () => {
    const email = `auth-dup-${Date.now()}@example.com`;
    const first = await request(app)
      .post("/api/auth/register")
      .send({ email, password: "password123", organizationName: "Org A" });

    const second = await request(app)
      .post("/api/auth/register")
      .send({ email, password: "password123", organizationName: "Org B" });

    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe("CONFLICT");

    await cleanupOrg(first.body.organization.id);
  });

  it("rejects registration with a missing organizationName", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ email: `no-org-${Date.now()}@example.com`, password: "password123" });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("logs in with correct credentials and rejects a wrong password", async () => {
    const email = `auth-login-${Date.now()}@example.com`;
    const registered = await request(app)
      .post("/api/auth/register")
      .send({ email, password: "password123", organizationName: "Login Org" });

    const good = await request(app).post("/api/auth/login").send({ email, password: "password123" });
    expect(good.status).toBe(200);
    expect(good.body.token).toBeTruthy();

    const bad = await request(app).post("/api/auth/login").send({ email, password: "wrongpass" });
    expect(bad.status).toBe(401);

    await cleanupOrg(registered.body.organization.id);
  });

  it("GET /api/auth/me requires a valid, present token", async () => {
    const { token, user, organization } = await registerTestUser();

    const authed = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${token}`);
    expect(authed.status).toBe(200);
    expect(authed.body.id).toBe(user.id);

    const noToken = await request(app).get("/api/auth/me");
    expect(noToken.status).toBe(401);

    const badToken = await request(app).get("/api/auth/me").set("Authorization", "Bearer not-a-real-token");
    expect(badToken.status).toBe(401);

    await cleanupOrg(organization.id);
  });
});
