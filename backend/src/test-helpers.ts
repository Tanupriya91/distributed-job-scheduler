import request from "supertest";
import { Role, prisma } from "@job-scheduler/db";
import { app } from "./app";

export async function registerTestUser(overrides?: { email?: string; organizationName?: string }) {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const email = overrides?.email ?? `test+${suffix}@example.com`;
  const organizationName = overrides?.organizationName ?? `Test Org ${suffix}`;

  const res = await request(app)
    .post("/api/auth/register")
    .send({ email, password: "password123", organizationName });

  if (res.status !== 201) {
    throw new Error(`registerTestUser failed: ${res.status} ${JSON.stringify(res.body)}`);
  }

  return {
    token: res.body.token as string,
    user: res.body.user as { id: string; email: string },
    organization: res.body.organization as { id: string; name: string; slug: string },
  };
}

export async function addMembership(userId: string, organizationId: string, role: "OWNER" | "ADMIN" | "MEMBER") {
  return prisma.organizationMembership.create({ data: { userId, organizationId, role: role as Role } });
}

export async function setupQueue(overrides?: {
  concurrencyLimit?: number;
  retryPolicy?: { strategy?: string; maxAttempts?: number; baseDelaySeconds?: number; maxDelaySeconds?: number };
}) {
  const owner = await registerTestUser();
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  const projectRes = await request(app)
    .post(`/api/organizations/${owner.organization.id}/projects`)
    .set(authHeader(owner.token))
    .send({ name: `Test Project ${suffix}` });

  const queueRes = await request(app)
    .post(`/api/organizations/${owner.organization.id}/projects/${projectRes.body.id}/queues`)
    .set(authHeader(owner.token))
    .send({
      name: `test-queue-${suffix}`,
      concurrencyLimit: overrides?.concurrencyLimit ?? 5,
      retryPolicy: overrides?.retryPolicy,
    });

  return {
    token: owner.token,
    orgId: owner.organization.id,
    projectId: projectRes.body.id as string,
    queueId: queueRes.body.id as string,
  };
}

export function authHeader(token: string): { Authorization: string } {
  return { Authorization: `Bearer ${token}` };
}

/** Deletes an Organization and everything cascading from it (projects, queues, jobs, ...). */
export async function cleanupOrg(organizationId: string) {
  await prisma.organization.delete({ where: { id: organizationId } }).catch(() => {});
}
