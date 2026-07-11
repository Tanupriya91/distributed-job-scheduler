export type Role = "OWNER" | "ADMIN" | "MEMBER";

export type OrgMembership = { id: string; name: string; slug: string; role: Role };

export type CurrentUser = {
  id: string;
  email: string;
  name: string | null;
  organizations: OrgMembership[];
};

export type Organization = { id: string; name: string; slug: string; createdAt: string; updatedAt: string };

export type Project = {
  id: string;
  name: string;
  slug: string;
  organizationId: string;
  createdAt: string;
  updatedAt: string;
};

export type RetryStrategy = "FIXED" | "LINEAR" | "EXPONENTIAL";

export type RetryPolicy = {
  id: string;
  strategy: RetryStrategy;
  maxAttempts: number;
  baseDelaySeconds: number;
  maxDelaySeconds: number;
};

export type Queue = {
  id: string;
  name: string;
  priority: number;
  concurrencyLimit: number;
  isPaused: boolean;
  projectId: string;
  retryPolicy: RetryPolicy;
  createdAt: string;
  updatedAt: string;
};

export type JobType = "IMMEDIATE" | "DELAYED" | "SCHEDULED" | "RECURRING";
export type JobStatus =
  | "SCHEDULED"
  | "QUEUED"
  | "CLAIMED"
  | "RUNNING"
  | "COMPLETED"
  | "FAILED"
  | "DEAD_LETTER"
  | "CANCELLED";

export type Job = {
  id: string;
  name: string;
  type: JobType;
  status: JobStatus;
  payload: Record<string, unknown>;
  runAt: string;
  attempts: number;
  retryStrategy: RetryStrategy;
  maxAttempts: number;
  baseDelaySeconds: number;
  maxDelaySeconds: number;
  idempotencyKey: string | null;
  queueId: string;
  workerId: string | null;
  claimedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  lastError: string | null;
  recurringJobId: string | null;
  batchId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type JobExecution = {
  id: string;
  attemptNumber: number;
  status: "COMPLETED" | "FAILED";
  startedAt: string;
  completedAt: string;
  error: string | null;
  jobId: string;
  workerId: string | null;
  job?: { id: string; name: string; status: JobStatus };
};

export type DeadLetterEntry = {
  id: string;
  reason: string;
  failedAt: string;
  retriedAt: string | null;
  jobId: string;
  job: { id: string; name: string; payload: Record<string, unknown>; attempts: number };
};

export type RecurringJob = {
  id: string;
  name: string;
  cronExpression: string;
  payload: Record<string, unknown>;
  isPaused: boolean;
  nextRunAt: string;
  lastRunAt: string | null;
  retryStrategy: RetryStrategy;
  maxAttempts: number;
  baseDelaySeconds: number;
  maxDelaySeconds: number;
  queueId: string;
};

export type JobBatch = {
  id: string;
  name: string | null;
  totalJobs: number;
  queueId: string;
  createdAt: string;
  progress?: { total: number; byStatus: Record<string, number> };
};

export type WorkerStatus = "ACTIVE" | "DRAINING" | "OFFLINE";

export type Worker = {
  id: string;
  hostname: string;
  pid: number;
  status: WorkerStatus;
  concurrency: number;
  startedAt: string;
  stoppedAt: string | null;
  lastSeenAt: string;
  isHealthy: boolean;
};

export type WorkerHeartbeat = { id: string; activeJobs: number; createdAt: string };

export type WorkerDetail = Worker & { activeJobCount: number; recentHeartbeats: WorkerHeartbeat[] };

export type Paginated<T> = {
  data: T[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
};

export type QueueStats = {
  statusCounts: Partial<Record<JobStatus, number>>;
  throughputLastHour: { completed: number; deadLettered: number; failedAttempts: number };
  avgExecutionMs: number | null;
};

export type ProjectStats = {
  queueCount: number;
  activeQueueCount: number;
  statusCounts: Partial<Record<JobStatus, number>>;
};
