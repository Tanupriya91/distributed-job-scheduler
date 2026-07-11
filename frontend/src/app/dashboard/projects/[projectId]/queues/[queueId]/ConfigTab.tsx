"use client";

import { useState, FormEvent } from "react";
import { useUpdateQueue } from "@/lib/hooks/queues";
import { Queue, RetryStrategy } from "@/lib/types";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Label, Select } from "@/components/ui/Input";
import { ApiError } from "@/lib/api-client";

export function ConfigTab({
  orgId,
  projectId,
  queue,
}: {
  orgId: string | null;
  projectId: string;
  queue: Queue;
}) {
  const updateQueue = useUpdateQueue(orgId, projectId, queue.id);
  const [name, setName] = useState(queue.name);
  const [priority, setPriority] = useState(queue.priority);
  const [concurrencyLimit, setConcurrencyLimit] = useState(queue.concurrencyLimit);
  const [strategy, setStrategy] = useState<RetryStrategy>(queue.retryPolicy.strategy);
  const [maxAttempts, setMaxAttempts] = useState(queue.retryPolicy.maxAttempts);
  const [baseDelaySeconds, setBaseDelaySeconds] = useState(queue.retryPolicy.baseDelaySeconds);
  const [maxDelaySeconds, setMaxDelaySeconds] = useState(queue.retryPolicy.maxDelaySeconds);
  const [saved, setSaved] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaved(false);
    setFormError(null);
    try {
      await updateQueue.mutateAsync({
        name,
        priority,
        concurrencyLimit,
        retryPolicy: { strategy, maxAttempts, baseDelaySeconds, maxDelaySeconds },
      });
      setSaved(true);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Failed to save changes");
    }
  }

  return (
    <Card className="max-w-xl">
      <CardBody>
        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && <p className="text-sm text-red-600">{formError}</p>}
          {saved && <p className="text-sm text-green-600">Saved.</p>}
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
              <Input
                type="number"
                min={1}
                value={maxAttempts}
                onChange={(e) => setMaxAttempts(Number(e.target.value))}
              />
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

          <Button type="submit" disabled={updateQueue.isPending}>
            {updateQueue.isPending ? "Saving..." : "Save changes"}
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}
