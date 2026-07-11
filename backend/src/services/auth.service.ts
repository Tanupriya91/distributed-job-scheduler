import bcrypt from "bcryptjs";
import { prisma, Role } from "@job-scheduler/db";
import { AppError } from "../utils/app-error";
import { signToken } from "../utils/jwt";
import { uniqueOrganizationSlug } from "./organization.service";

const SALT_ROUNDS = 10;

function toSafeUser(user: { id: string; email: string; name: string | null }) {
  return { id: user.id, email: user.email, name: user.name };
}

export async function registerUser(input: {
  email: string;
  password: string;
  name?: string;
  organizationName: string;
}) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    throw AppError.conflict("An account with this email already exists");
  }

  const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);
  const slug = await uniqueOrganizationSlug(input.organizationName);

  const { user, organization } = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { email: input.email, passwordHash, name: input.name },
    });

    const organization = await tx.organization.create({
      data: { name: input.organizationName, slug },
    });

    await tx.organizationMembership.create({
      data: { userId: user.id, organizationId: organization.id, role: Role.OWNER },
    });

    return { user, organization };
  });

  const token = signToken({ sub: user.id, email: user.email });

  return { user: toSafeUser(user), organization, token };
}

export async function loginUser(input: { email: string; password: string }) {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user) {
    throw AppError.unauthorized("Invalid email or password");
  }

  const passwordMatches = await bcrypt.compare(input.password, user.passwordHash);
  if (!passwordMatches) {
    throw AppError.unauthorized("Invalid email or password");
  }

  const token = signToken({ sub: user.id, email: user.email });

  return { user: toSafeUser(user), token };
}

export async function getCurrentUser(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { memberships: { include: { organization: true } } },
  });

  if (!user) throw AppError.notFound("User not found");

  return {
    ...toSafeUser(user),
    organizations: user.memberships.map((m) => ({
      id: m.organization.id,
      name: m.organization.name,
      slug: m.organization.slug,
      role: m.role,
    })),
  };
}
