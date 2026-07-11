import { Request, Response } from "express";
import { prisma, Prisma } from "@job-scheduler/db";
import { AppError } from "../utils/app-error";
import { slugify } from "../utils/slugify";
import { paginationMeta } from "../utils/pagination";

async function uniqueProjectSlug(organizationId: string, name: string): Promise<string> {
  const base = slugify(name) || "project";
  let candidate = base;
  let attempt = 0;

  while (
    await prisma.project.findUnique({
      where: { organizationId_slug: { organizationId, slug: candidate } },
    })
  ) {
    attempt += 1;
    candidate = `${base}-${Math.random().toString(36).slice(2, 6)}`;
    if (attempt > 5) throw AppError.conflict("Could not generate a unique project slug");
  }

  return candidate;
}

async function findProjectOrThrow(organizationId: string, projectId: string) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, organizationId },
  });
  if (!project) throw AppError.notFound("Project not found");
  return project;
}

export async function createProject(req: Request, res: Response) {
  const { organizationId } = req.params;
  const { name } = req.body as { name: string };

  const slug = await uniqueProjectSlug(organizationId, name);
  const project = await prisma.project.create({ data: { name, slug, organizationId } });

  res.status(201).json(project);
}

export async function listProjects(req: Request, res: Response) {
  const { organizationId } = req.params;
  const { page, pageSize, search } = req.query as unknown as {
    page: number;
    pageSize: number;
    search?: string;
  };

  const where: Prisma.ProjectWhereInput = {
    organizationId,
    ...(search ? { name: { contains: search, mode: "insensitive" } } : {}),
  };

  const [data, total] = await Promise.all([
    prisma.project.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { createdAt: "desc" },
    }),
    prisma.project.count({ where }),
  ]);

  res.status(200).json({ data, pagination: paginationMeta(page, pageSize, total) });
}

export async function getProject(req: Request, res: Response) {
  const project = await findProjectOrThrow(req.params.organizationId, req.params.projectId);
  res.status(200).json(project);
}

export async function updateProject(req: Request, res: Response) {
  await findProjectOrThrow(req.params.organizationId, req.params.projectId);

  const project = await prisma.project.update({
    where: { id: req.params.projectId },
    data: req.body as { name?: string },
  });

  res.status(200).json(project);
}

export async function deleteProject(req: Request, res: Response) {
  await findProjectOrThrow(req.params.organizationId, req.params.projectId);
  await prisma.project.delete({ where: { id: req.params.projectId } });
  res.status(204).send();
}
