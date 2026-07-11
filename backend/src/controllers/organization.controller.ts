import { Request, Response } from "express";
import { prisma, Role } from "@job-scheduler/db";
import { uniqueOrganizationSlug } from "../services/organization.service";

export async function createOrganization(req: Request, res: Response) {
  const { name } = req.body as { name: string };
  const slug = await uniqueOrganizationSlug(name);

  const organization = await prisma.$transaction(async (tx) => {
    const organization = await tx.organization.create({ data: { name, slug } });
    await tx.organizationMembership.create({
      data: { userId: req.user!.id, organizationId: organization.id, role: Role.OWNER },
    });
    return organization;
  });

  res.status(201).json(organization);
}

export async function listMyOrganizations(req: Request, res: Response) {
  const memberships = await prisma.organizationMembership.findMany({
    where: { userId: req.user!.id },
    include: { organization: true },
  });

  res.status(200).json(
    memberships.map((m) => ({
      id: m.organization.id,
      name: m.organization.name,
      slug: m.organization.slug,
      role: m.role,
    }))
  );
}
