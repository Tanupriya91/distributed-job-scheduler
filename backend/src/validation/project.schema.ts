import { z } from "zod";

export const createProjectSchema = z.object({
  name: z.string().min(1, "name is required"),
});

export const updateProjectSchema = z.object({
  name: z.string().min(1).optional(),
});

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
});
