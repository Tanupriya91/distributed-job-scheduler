"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { useProject } from "@/lib/hooks/projects";
import { useQueue, useQueueStats, useSetQueuePaused } from "@/lib/hooks/queues";
import { StatCard } from "@/components/StatCard";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { JobsTab } from "./JobsTab";
import { ExecutionsTab } from "./ExecutionsTab";
import { DeadLetterTab } from "./DeadLetterTab";
import { RecurringTab } from "./RecurringTab";
import { ConfigTab } from "./ConfigTab";

const TABS = ["Jobs", "Executions", "Dead Letter Queue", "Recurring Jobs", "Configuration"] as const;
type Tab = (typeof TABS)[number];

export default function QueueDetailPage({ params }: { params: { projectId: string; queueId: string } }) {
  const { projectId, queueId } = params;
  const { currentOrgId } = useAuth();
  const { data: project } = useProject(currentOrgId, projectId);
  const { data: queue } = useQueue(currentOrgId, projectId, queueId);
  const { data: stats } = useQueueStats(currentOrgId, projectId, queueId);
  const setPaused = useSetQueuePaused(currentOrgId, projectId, queueId);
  const [tab, setTab] = useState<Tab>("Jobs");

  return (
    <div>
      <div className="mb-1 text-sm text-slate-500">
        <Link href="/dashboard/projects" className="hover:underline">
          Projects
        </Link>{" "}
        /{" "}
        <Link href={`/dashboard/projects/${projectId}`} className="hover:underline">
          {project?.name ?? "..."}
        </Link>{" "}
        / {queue?.name ?? "..."}
      </div>

      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-semibold text-slate-900">{queue?.name ?? "Queue"}</h1>
          {queue && <Badge color={queue.isPaused ? "yellow" : "green"}>{queue.isPaused ? "Paused" : "Active"}</Badge>}
        </div>
        {queue && (
          <Button type="button" variant="secondary" onClick={() => setPaused.mutate(!queue.isPaused)} disabled={setPaused.isPending}>
            {queue.isPaused ? "Resume queue" : "Pause queue"}
          </Button>
        )}
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Waiting" value={(stats?.statusCounts.QUEUED ?? 0) + (stats?.statusCounts.SCHEDULED ?? 0)} />
        <StatCard label="In flight" value={(stats?.statusCounts.RUNNING ?? 0) + (stats?.statusCounts.CLAIMED ?? 0)} />
        <StatCard label="Completed (1h)" value={stats?.throughputLastHour.completed ?? 0} />
        <StatCard
          label="Avg exec time"
          value={stats?.avgExecutionMs != null ? `${stats.avgExecutionMs}ms` : "-"}
          hint={stats ? `${stats.throughputLastHour.deadLettered} dead-lettered/1h` : undefined}
        />
      </div>

      <div className="mb-4 flex gap-1 border-b border-slate-200">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`border-b-2 px-3 py-2 text-sm font-medium ${
              tab === t
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Jobs" && <JobsTab orgId={currentOrgId} projectId={projectId} queueId={queueId} />}
      {tab === "Executions" && <ExecutionsTab orgId={currentOrgId} projectId={projectId} queueId={queueId} />}
      {tab === "Dead Letter Queue" && <DeadLetterTab orgId={currentOrgId} projectId={projectId} queueId={queueId} />}
      {tab === "Recurring Jobs" && <RecurringTab orgId={currentOrgId} projectId={projectId} queueId={queueId} />}
      {tab === "Configuration" && queue && <ConfigTab orgId={currentOrgId} projectId={projectId} queue={queue} />}
    </div>
  );
}
