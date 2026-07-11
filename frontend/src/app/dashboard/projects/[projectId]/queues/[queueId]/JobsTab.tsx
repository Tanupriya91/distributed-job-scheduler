"use client";

import { useState, FormEvent } from "react";
import { useCancelJob, useCreateJob, useJobExecutions, useJobs, useRetryJob } from "@/lib/hooks/jobs";
import { Job, JobStatus, JobType } from "@/lib/types";
import { JobStatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/Button";
import { Input, Label, Select, Textarea } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Pagination } from "@/components/ui/Pagination";
import { EmptyState, ErrorState } from "@/components/ui/EmptyState";
import { Spinner } from "@/components/ui/Spinner";

const STATUS_OPTIONS: JobStatus[] = [
  "SCHEDULED",
  "QUEUED",
  "CLAIMED",
  "RUNNING",
  "COMPLETED",
  "FAILED",
  "DEAD_LETTER",
  "CANCELLED",
];
const TYPE_OPTIONS: JobType[] = ["IMMEDIATE", "DELAYED", "SCHEDULED", "RECURRING"];

export function JobsTab({
  orgId,
  projectId,
  queueId,
}: {
  orgId: string | null;
  projectId: string;
  queueId: string;
}) {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<JobStatus | "">("");
  const [typeFilter, setTypeFilter] = useState<JobType | "">("");
  const { data, isLoading, error } = useJobs(
    orgId,
    projectId,
    queueId,
    page,
    statusFilter || undefined,
    typeFilter || undefined
  );
  const cancelJob = useCancelJob(orgId, projectId, queueId);
  const retryJob = useRetryJob(orgId, projectId, queueId);

  const [showCreate, setShowCreate] = useState(false);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-2">
          <Select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as JobStatus | "");
              setPage(1);
            }}
            className="w-40"
          >
            <option value="">All statuses</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
          <Select
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value as JobType | "");
              setPage(1);
            }}
            className="w-36"
          >
            <option value="">All types</option>
            {TYPE_OPTIONS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
        </div>
        <Button onClick={() => setShowCreate(true)}>+ New job</Button>
      </div>

      {isLoading && <Spinner />}
      {error && <ErrorState message="Failed to load jobs" />}
      {data && data.data.length === 0 && <EmptyState title="No jobs" description="No jobs match these filters." />}

      {data && data.data.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2">Name</th>
                <th className="px-4 py-2">Type</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Attempts</th>
                <th className="px-4 py-2">Run at</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.data.map((job) => (
                <tr key={job.id} className="cursor-pointer hover:bg-slate-50" onClick={() => setSelectedJob(job)}>
                  <td className="px-4 py-2 font-medium text-slate-800">{job.name}</td>
                  <td className="px-4 py-2 text-slate-500">{job.type}</td>
                  <td className="px-4 py-2">
                    <JobStatusBadge status={job.status} />
                  </td>
                  <td className="px-4 py-2 text-slate-500">
                    {job.attempts}/{job.maxAttempts}
                  </td>
                  <td className="px-4 py-2 text-slate-500">{new Date(job.runAt).toLocaleString()}</td>
                  <td className="px-4 py-2 text-right">
                    {(job.status === "QUEUED" || job.status === "SCHEDULED") && (
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          cancelJob.mutate(job.id);
                        }}
                      >
                        Cancel
                      </Button>
                    )}
                    {job.status === "DEAD_LETTER" && (
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          retryJob.mutate(job.id);
                        }}
                      >
                        Retry
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination page={data.pagination.page} totalPages={data.pagination.totalPages} onPageChange={setPage} />
        </div>
      )}

      <CreateJobModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        orgId={orgId}
        projectId={projectId}
        queueId={queueId}
      />
      {selectedJob && (
        <JobDetailModal
          job={selectedJob}
          orgId={orgId}
          projectId={projectId}
          queueId={queueId}
          onClose={() => setSelectedJob(null)}
        />
      )}
    </div>
  );
}

function CreateJobModal({
  open,
  onClose,
  orgId,
  projectId,
  queueId,
}: {
  open: boolean;
  onClose: () => void;
  orgId: string | null;
  projectId: string;
  queueId: string;
}) {
  const createJob = useCreateJob(orgId, projectId, queueId);
  const [type, setType] = useState<"IMMEDIATE" | "DELAYED" | "SCHEDULED">("IMMEDIATE");
  const [name, setName] = useState("");
  const [payloadText, setPayloadText] = useState("{}");
  const [delaySeconds, setDelaySeconds] = useState(60);
  const [runAt, setRunAt] = useState("");
  const [payloadError, setPayloadError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(payloadText);
    } catch {
      setPayloadError("Payload must be valid JSON");
      return;
    }
    setPayloadError(null);

    await createJob.mutateAsync({
      type,
      name,
      payload,
      ...(type === "DELAYED" ? { delaySeconds } : {}),
      ...(type === "SCHEDULED" ? { runAt: new Date(runAt).toISOString() } : {}),
    });
    onClose();
    setName("");
    setPayloadText("{}");
  }

  return (
    <Modal open={open} onClose={onClose} title="New job">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label>Type</Label>
          <Select value={type} onChange={(e) => setType(e.target.value as typeof type)}>
            <option value="IMMEDIATE">Immediate</option>
            <option value="DELAYED">Delayed</option>
            <option value="SCHEDULED">Scheduled</option>
          </Select>
        </div>
        <div>
          <Label>Handler name</Label>
          <Input required placeholder="e.g. log-message" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        {type === "DELAYED" && (
          <div>
            <Label>Delay (seconds)</Label>
            <Input
              type="number"
              min={1}
              value={delaySeconds}
              onChange={(e) => setDelaySeconds(Number(e.target.value))}
            />
          </div>
        )}
        {type === "SCHEDULED" && (
          <div>
            <Label>Run at</Label>
            <Input type="datetime-local" required value={runAt} onChange={(e) => setRunAt(e.target.value)} />
          </div>
        )}
        <div>
          <Label>Payload (JSON)</Label>
          <Textarea rows={4} value={payloadText} onChange={(e) => setPayloadText(e.target.value)} />
          {payloadError && <p className="mt-1 text-xs text-red-600">{payloadError}</p>}
        </div>
        <Button type="submit" className="w-full" disabled={createJob.isPending}>
          {createJob.isPending ? "Creating..." : "Create job"}
        </Button>
      </form>
    </Modal>
  );
}

function JobDetailModal({
  job,
  orgId,
  projectId,
  queueId,
  onClose,
}: {
  job: Job;
  orgId: string | null;
  projectId: string;
  queueId: string;
  onClose: () => void;
}) {
  const { data: executions } = useJobExecutions(orgId, projectId, queueId, job.id);

  return (
    <Modal open onClose={onClose} title={`Job: ${job.name}`}>
      <div className="space-y-3 text-sm">
        <div className="flex items-center gap-2">
          <JobStatusBadge status={job.status} />
          <span className="text-slate-500">{job.type}</span>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase text-slate-400">Payload</p>
          <pre className="mt-1 max-h-32 overflow-auto rounded bg-slate-50 p-2 text-xs">
            {JSON.stringify(job.payload, null, 2)}
          </pre>
        </div>
        {job.lastError && (
          <div>
            <p className="text-xs font-semibold uppercase text-slate-400">Last error</p>
            <p className="mt-1 rounded bg-red-50 p-2 text-xs text-red-700">{job.lastError}</p>
          </div>
        )}
        <div>
          <p className="text-xs font-semibold uppercase text-slate-400">
            Attempts ({job.attempts}/{job.maxAttempts})
          </p>
          <div className="mt-1 space-y-1">
            {executions?.data.map((ex) => (
              <div key={ex.id} className="flex items-center justify-between rounded bg-slate-50 px-2 py-1 text-xs">
                <span>#{ex.attemptNumber}</span>
                <span>{ex.status}</span>
                <span className="text-slate-400">{new Date(ex.startedAt).toLocaleTimeString()}</span>
              </div>
            ))}
            {executions?.data.length === 0 && <p className="text-xs text-slate-400">No attempts yet</p>}
          </div>
        </div>
      </div>
    </Modal>
  );
}
