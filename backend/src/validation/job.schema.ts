import { z } from "zod";
import { retryPolicyOverrideSchema } from "./queue.schema";

const jobStatusSchema = z.enum([
  "SCHEDULED",
  "QUEUED",
  "CLAIMED",
  "RUNNING",
  "COMPLETED",
  "FAILED",
  "DEAD_LETTER",
  "CANCELLED",
]);

const commonJobFields = {
  name: z.string().min(1, "name is required"),
  payload: z.record(z.unknown()).default({}),
  idempotencyKey: z.string().min(1).optional(),
  retryPolicy: retryPolicyOverrideSchema.optional(),
};

const immediateJobSchema = z.object({
  type: z.literal("IMMEDIATE"),
  ...commonJobFields,
});

const delayedJobSchema = z.object({
  type: z.literal("DELAYED"),
  delaySeconds: z.coerce.number().int().min(1, "delaySeconds must be at least 1"),
  ...commonJobFields,
});

const scheduledJobSchema = z.object({
  type: z.literal("SCHEDULED"),
  runAt: z.coerce.date(),
  ...commonJobFields,
});

export const createJobSchema = z
  .discriminatedUnion("type", [immediateJobSchema, delayedJobSchema, scheduledJobSchema])
  .superRefine((data, ctx) => {
    if (data.type === "SCHEDULED" && data.runAt.getTime() <= Date.now()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "runAt must be in the future", path: ["runAt"] });
    }
  });

export const listJobsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: jobStatusSchema.optional(),
  type: z.enum(["IMMEDIATE", "DELAYED", "SCHEDULED"]).optional(),
});
