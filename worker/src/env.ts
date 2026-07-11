import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  WORKER_CONCURRENCY: z.coerce.number().int().min(1).default(5),
  POLL_INTERVAL_MS: z.coerce.number().int().min(100).default(1000),
  HEARTBEAT_INTERVAL_MS: z.coerce.number().int().min(1000).default(10000),
  SHUTDOWN_TIMEOUT_MS: z.coerce.number().int().min(1000).default(30000),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment configuration:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
