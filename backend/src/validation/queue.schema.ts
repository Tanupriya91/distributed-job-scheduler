import { z } from "zod";

const retryStrategySchema = z.enum(["FIXED", "LINEAR", "EXPONENTIAL"]);

const createRetryPolicySchema = z
  .object({
    strategy: retryStrategySchema.default("FIXED"),
    maxAttempts: z.coerce.number().int().min(1).max(20).default(3),
    baseDelaySeconds: z.coerce.number().int().min(1).default(30),
    maxDelaySeconds: z.coerce.number().int().min(1).default(3600),
  })
  .refine((data) => data.maxDelaySeconds >= data.baseDelaySeconds, {
    message: "maxDelaySeconds must be >= baseDelaySeconds",
    path: ["maxDelaySeconds"],
  });

export const retryPolicyOverrideSchema = z.object({
  strategy: retryStrategySchema.optional(),
  maxAttempts: z.coerce.number().int().min(1).max(20).optional(),
  baseDelaySeconds: z.coerce.number().int().min(1).optional(),
  maxDelaySeconds: z.coerce.number().int().min(1).optional(),
});

export const createQueueSchema = z.object({
  name: z.string().min(1, "name is required"),
  priority: z.coerce.number().int().min(0).max(100).default(0),
  concurrencyLimit: z.coerce.number().int().min(1).max(1000).default(1),
  retryPolicy: createRetryPolicySchema.default({}),
});

export const updateQueueSchema = z.object({
  name: z.string().min(1).optional(),
  priority: z.coerce.number().int().min(0).max(100).optional(),
  concurrencyLimit: z.coerce.number().int().min(1).max(1000).optional(),
  isPaused: z.boolean().optional(),
  retryPolicy: retryPolicyOverrideSchema.optional(),
});
