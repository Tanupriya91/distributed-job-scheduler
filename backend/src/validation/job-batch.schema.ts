import { z } from "zod";

export const createJobBatchSchema = z.object({
  name: z.string().min(1).optional(),
  jobs: z
    .array(
      z.object({
        name: z.string().min(1, "name is required"),
        payload: z.record(z.unknown()).default({}),
        idempotencyKey: z.string().min(1).optional(),
      })
    )
    .min(1, "a batch must contain at least one job")
    .max(1000, "a batch cannot contain more than 1000 jobs"),
});
