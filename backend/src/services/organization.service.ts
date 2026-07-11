import { prisma } from "@job-scheduler/db";
import { AppError } from "../utils/app-error";
import { slugify } from "../utils/slugify";

export async function uniqueOrganizationSlug(name: string): Promise<string> {
  const base = slugify(name) || "org";
  let candidate = base;
  let attempt = 0;

  while (await prisma.organization.findUnique({ where: { slug: candidate } })) {
    attempt += 1;
    candidate = `${base}-${Math.random().toString(36).slice(2, 6)}`;
    if (attempt > 5) throw AppError.conflict("Could not generate a unique organization slug");
  }

  return candidate;
}
