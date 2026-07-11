import { Badge, BadgeColor } from "./ui/Badge";
import { JobStatus, WorkerStatus } from "@/lib/types";

const JOB_STATUS_COLOR: Record<JobStatus, BadgeColor> = {
  SCHEDULED: "blue",
  QUEUED: "gray",
  CLAIMED: "yellow",
  RUNNING: "yellow",
  COMPLETED: "green",
  FAILED: "orange",
  DEAD_LETTER: "red",
  CANCELLED: "gray",
};

export function JobStatusBadge({ status }: { status: JobStatus }) {
  return <Badge color={JOB_STATUS_COLOR[status]}>{status.replace("_", " ")}</Badge>;
}

const WORKER_STATUS_COLOR: Record<WorkerStatus, BadgeColor> = {
  ACTIVE: "green",
  DRAINING: "yellow",
  OFFLINE: "gray",
};

export function WorkerStatusBadge({ status }: { status: WorkerStatus }) {
  return <Badge color={WORKER_STATUS_COLOR[status]}>{status}</Badge>;
}

export function HealthBadge({ isHealthy }: { isHealthy: boolean }) {
  return <Badge color={isHealthy ? "green" : "red"}>{isHealthy ? "Healthy" : "Stale"}</Badge>;
}
