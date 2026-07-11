"use client";

import { useState, FormEvent } from "react";
import {
  useCreateRecurringJob,
  useDeleteRecurringJob,
  useRecurringJobs,
  useSetRecurringJobPaused,
} from "@/lib/hooks/recurringJobs";
import { Button } from "@/components/ui/Button";
import { Input, Label, Textarea } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { EmptyState, ErrorState } from "@/components/ui/EmptyState";
import { Spinner } from "@/components/ui/Spinner";
import { ApiError } from "@/lib/api-client";

export function RecurringTab({
  orgId,
  projectId,
  queueId,
}: {
  orgId: string | null;
  projectId: string;
  queueId: string;
}) {
  const { data, isLoading, error } = useRecurringJobs(orgId, projectId, queueId, 1);
  const setPaused = useSetRecurringJobPaused(orgId, projectId, queueId);
  const deleteRecurring = useDeleteRecurringJob(orgId, projectId, queueId);
  const [showCreate, setShowCreate] = useState(false);

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <Button onClick={() => setShowCreate(true)}>+ New recurring job</Button>
      </div>

      {isLoading && <Spinner />}
      {error && <ErrorState message="Failed to load recurring jobs" />}
      {data && data.data.length === 0 && (
        <EmptyState title="No recurring jobs" description="Create a cron-based job definition." />
      )}

      {data && data.data.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2">Name</th>
                <th className="px-4 py-2">Cron</th>
                <th className="px-4 py-2">Next run</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.data.map((rj) => (
                <tr key={rj.id}>
                  <td className="px-4 py-2 font-medium text-slate-800">{rj.name}</td>
                  <td className="px-4 py-2 font-mono text-xs text-slate-500">{rj.cronExpression}</td>
                  <td className="px-4 py-2 text-slate-500">{new Date(rj.nextRunAt).toLocaleString()}</td>
                  <td className="px-4 py-2">
                    <Badge color={rj.isPaused ? "yellow" : "green"}>{rj.isPaused ? "Paused" : "Active"}</Badge>
                  </td>
                  <td className="space-x-1 px-4 py-2 text-right">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setPaused.mutate({ id: rj.id, paused: !rj.isPaused })}
                    >
                      {rj.isPaused ? "Resume" : "Pause"}
                    </Button>
                    <Button type="button" variant="ghost" onClick={() => deleteRecurring.mutate(rj.id)}>
                      Delete
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <CreateRecurringJobModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        orgId={orgId}
        projectId={projectId}
        queueId={queueId}
      />
    </div>
  );
}

function CreateRecurringJobModal({
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
  const createRecurring = useCreateRecurringJob(orgId, projectId, queueId);
  const [name, setName] = useState("");
  const [cronExpression, setCronExpression] = useState("*/5 * * * *");
  const [payloadText, setPayloadText] = useState("{}");
  const [formError, setFormError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(payloadText);
    } catch {
      setFormError("Payload must be valid JSON");
      return;
    }
    try {
      await createRecurring.mutateAsync({ name, cronExpression, payload });
      onClose();
      setName("");
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Failed to create recurring job");
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="New recurring job">
      <form onSubmit={handleSubmit} className="space-y-4">
        {formError && <p className="text-sm text-red-600">{formError}</p>}
        <div>
          <Label>Handler name</Label>
          <Input required placeholder="e.g. log-message" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <Label>Cron expression</Label>
          <Input required value={cronExpression} onChange={(e) => setCronExpression(e.target.value)} />
          <p className="mt-1 text-xs text-slate-400">
            Standard 5-field cron, or 6-field with a leading seconds field (e.g. */10 * * * * * fires every 10s).
          </p>
        </div>
        <div>
          <Label>Payload (JSON)</Label>
          <Textarea rows={3} value={payloadText} onChange={(e) => setPayloadText(e.target.value)} />
        </div>
        <Button type="submit" className="w-full" disabled={createRecurring.isPending}>
          {createRecurring.isPending ? "Creating..." : "Create"}
        </Button>
      </form>
    </Modal>
  );
}
