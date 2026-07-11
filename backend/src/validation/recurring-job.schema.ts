import { parseExpression } from "cron-parser";
import { z } from "zod";
import { retryPolicyOverrideSchema } from "./queue.schema";

const cronExpressionSchema = z.string().min(1).refine(
  (expr) => {
    try {
      parseExpression(expr);
      return true;
    } catch {
      return false;
    }
  },
  { message: "Invalid cron expression" }
);

export const createRecurringJobSchema = z.object({
  name: z.string().min(1, "name is required"),
  cronExpression: cronExpressionSchema,
  payload: z.record(z.unknown()).default({}),
  retryPolicy: retryPolicyOverrideSchema.optional(),
});

export const updateRecurringJobSchema = z.object({
  name: z.string().min(1).optional(),
  cronExpression: cronExpressionSchema.optional(),
  payload: z.record(z.unknown()).optional(),
  isPaused: z.boolean().optional(),
  retryPolicy: retryPolicyOverrideSchema.optional(),
});
