"use client";

import { useState, FormEvent } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { useProject, useProjectStats } from "@/lib/hooks/projects";
import { useCreateQueue, useQueues } from "@/lib/hooks/queues";
import { RetryStrategy } from "@/lib/types";
import { StatCard } from "@/components/StatCard";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Label, Select } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { EmptyState, ErrorState } from "@/components/ui/EmptyState";
import { Spinner } from "@/components/ui/Spinner";

export default function ProjectDetailPage({ params }: { params: { projectId: string } }) {
  const { projectId } = params;
  const { currentOrgId } = useAuth();
  const { data: project } = useProject(currentOrgId, projectId);
  const { data: stats } = useProjectStats(currentOrgId, projectId);
  const { data: queues, isLoading, error } = useQueues(currentOrgId, projectId, 1);
  const createQueue = useCreateQueue(currentOrgId, projectId);

  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [priority, setPriority] = useState(0);
  const [concurrencyLimit, setConcurrencyLimit] = useState(1);
  const [strategy, setStrategy] = useState<RetryStrategy>("FIXED");
  const [maxAttempts, setMaxAttempts] = useState(3);
  const [baseDelaySeconds, setBaseDelaySeconds] = useState(30);
  const [maxDelaySeconds, setMaxDelaySeconds] = useState(3600);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    await createQueue.mutateAsync({
      name,
      priority,
      concurrencyLimit,
      retryPolicy: { strategy, maxAttempts, baseDelaySeconds, maxDelaySeconds },
    });
    setShowCreate(false);
    setName("");
  }

  const completed = stats?.statusCounts.COMPLETED ?? 0;
  const deadLettered = stats?.statusCounts.DEAD_LETTER ?? 0;
  const inFlight = (stats?.statusCounts.RUNNING ?? 0) + (stats?.statusCounts.CLAIMED ?? 0);
  const waiting = (stats?.statusCounts.QUEUED ?? 0) + (stats?.statusCounts.SCHEDULED ?? 0);

  return (
    <div>
      <div className="mb-1 text-sm text-slate-500">
        <Link href="/dashboard/projects" className="hover:underline">
          Projects
        </Link>{" "}
        / {project?.name ?? "..."}
      </div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900">{project?.name ?? "Project"}</h1>
        <Button onClick={() => setShowCreate(true)}>+ New queue</Button>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Queues" value={stats?.queueCount ?? "-"} hint={`${stats?.activeQueueCount ?? 0} active`} />
        <StatCard label="Waiting" value={waiting} />
        <StatCard label="In flight" value={inFlight} />
        <StatCard label="Completed" value={completed} hint={deadLettered > 0 ? `${deadLettered} dead-lettered` : undefined} />
      </div>

      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Queues</h2>

      {isLoading && <Spinner />}
      {error && <ErrorState message="Failed to load queues" />}
      {queues && queues.data.length === 0 && (
        <EmptyState title="No queues yet" description="Create a queue to start scheduling jobs." />
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {queues?.data.map((queue) => (
          <Link key={queue.id} href={`/dashboard/projects/${projectId}/queues/${queue.id}`}>
            <Card className="h-full transition-shadow hover:shadow-md">
              <CardBody>
                <div className="flex items-center justify-between">
                  <p className="font-medium text-slate-900">{queue.name}</p>
                  <Badge color={queue.isPaused ? "yellow" : "green"}>{queue.isPaused ? "Paused" : "Active"}</Badge>
                </div>
                <p className="mt-1 text-xs text-slate-400">
                  priority {queue.priority} · concurrency {queue.concurrencyLimit} · {queue.retryPolicy.strategy} retry
                </p>
              </CardBody>
            </Card>
          </Link>
        ))}
      </div>

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="New queue">
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <Label>Queue name</Label>
            <Input required value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Priority</Label>
              <Input type="number" value={priority} onChange={(e) => setPriority(Number(e.target.value))} />
            </div>
            <div>
              <Label>Concurrency limit</Label>
              <Input
                type="number"
                min={1}
                value={concurrencyLimit}
                onChange={(e) => setConcurrencyLimit(Number(e.target.value))}
              />
            </div>
          </div>

          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Retry policy</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Strategy</Label>
              <Select value={strategy} onChange={(e) => setStrategy(e.target.value as RetryStrategy)}>
                <option value="FIXED">Fixed</option>
                <option value="LINEAR">Linear</option>
                <option value="EXPONENTIAL">Exponential</option>
              </Select>
            </div>
            <div>
              <Label>Max attempts</Label>
              <Input type="number" min={1} value={maxAttempts} onChange={(e) => setMaxAttempts(Number(e.target.value))} />
            </div>
            <div>
              <Label>Base delay (s)</Label>
              <Input
                type="number"
                min={1}
                value={baseDelaySeconds}
                onChange={(e) => setBaseDelaySeconds(Number(e.target.value))}
              />
            </div>
            <div>
              <Label>Max delay (s)</Label>
              <Input
                type="number"
                min={1}
                value={maxDelaySeconds}
                onChange={(e) => setMaxDelaySeconds(Number(e.target.value))}
              />
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={createQueue.isPending}>
            {createQueue.isPending ? "Creating..." : "Create queue"}
          </Button>
        </form>
      </Modal>
    </div>
  );
}
