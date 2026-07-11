"use client";

import { useState } from "react";
import { useWorkers } from "@/lib/hooks/workers";
import { HealthBadge, WorkerStatusBadge } from "@/components/StatusBadge";
import { StatCard } from "@/components/StatCard";
import { Pagination } from "@/components/ui/Pagination";
import { EmptyState, ErrorState } from "@/components/ui/EmptyState";
import { Spinner } from "@/components/ui/Spinner";

export default function WorkersPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading, error } = useWorkers(page);

  const healthyCount = data?.data.filter((w) => w.isHealthy).length ?? 0;

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold text-slate-900">Workers</h1>

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <StatCard label="Total workers" value={data?.pagination.total ?? "-"} />
        <StatCard label="Healthy" value={healthyCount} />
        <StatCard label="Stale / offline" value={(data?.data.length ?? 0) - healthyCount} />
      </div>

      {isLoading && <Spinner />}
      {error && <ErrorState message="Failed to load workers" />}
      {data && data.data.length === 0 && (
        <EmptyState title="No workers registered" description="Start the worker service to see it here." />
      )}

      {data && data.data.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2">Hostname</th>
                <th className="px-4 py-2">PID</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Health</th>
                <th className="px-4 py-2">Concurrency</th>
                <th className="px-4 py-2">Started</th>
                <th className="px-4 py-2">Last heartbeat</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.data.map((worker) => (
                <tr key={worker.id}>
                  <td className="px-4 py-2 font-medium text-slate-800">{worker.hostname}</td>
                  <td className="px-4 py-2 text-slate-500">{worker.pid}</td>
                  <td className="px-4 py-2">
                    <WorkerStatusBadge status={worker.status} />
                  </td>
                  <td className="px-4 py-2">
                    <HealthBadge isHealthy={worker.isHealthy} />
                  </td>
                  <td className="px-4 py-2 text-slate-500">{worker.concurrency}</td>
                  <td className="px-4 py-2 text-slate-500">{new Date(worker.startedAt).toLocaleString()}</td>
                  <td className="px-4 py-2 text-slate-500">{new Date(worker.lastSeenAt).toLocaleTimeString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination page={data.pagination.page} totalPages={data.pagination.totalPages} onPageChange={setPage} />
        </div>
      )}
    </div>
  );
}
