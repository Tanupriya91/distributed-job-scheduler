import { z } from "zod";

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  name: z.string().min(1).optional(),
  organizationName: z.string().min(1, "organizationName is required"),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
