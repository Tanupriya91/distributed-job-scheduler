"use client";

import { useState } from "react";
import { useQueueExecutions } from "@/lib/hooks/queues";
import { Select } from "@/components/ui/Input";
import { Pagination } from "@/components/ui/Pagination";
import { EmptyState, ErrorState } from "@/components/ui/EmptyState";
import { Spinner } from "@/components/ui/Spinner";
import { Badge } from "@/components/ui/Badge";

export function ExecutionsTab({
  orgId,
  projectId,
  queueId,
}: {
  orgId: string | null;
  projectId: string;
  queueId: string;
}) {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<"" | "COMPLETED" | "FAILED">("");
  const { data, isLoading, error } = useQueueExecutions(orgId, projectId, queueId, page, status || undefined);

  return (
    <div>
      <div className="mb-3">
        <Select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as typeof status);
            setPage(1);
          }}
          className="w-40"
        >
          <option value="">All attempts</option>
          <option value="COMPLETED">Completed</option>
          <option value="FAILED">Failed</option>
        </Select>
      </div>

      {isLoading && <Spinner />}
      {error && <ErrorState message="Failed to load execution log" />}
      {data && data.data.length === 0 && (
        <EmptyState title="No execution history yet" description="Attempts will show up here once jobs run." />
      )}

      {data && data.data.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2">Job</th>
                <th className="px-4 py-2">Attempt</th>
                <th className="px-4 py-2">Result</th>
                <th className="px-4 py-2">Started</th>
                <th className="px-4 py-2">Duration</th>
                <th className="px-4 py-2">Error</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.data.map((ex) => (
                <tr key={ex.id}>
                  <td className="px-4 py-2 font-medium text-slate-800">{ex.job?.name}</td>
                  <td className="px-4 py-2 text-slate-500">#{ex.attemptNumber}</td>
                  <td className="px-4 py-2">
                    <Badge color={ex.status === "COMPLETED" ? "green" : "red"}>{ex.status}</Badge>
                  </td>
                  <td className="px-4 py-2 text-slate-500">{new Date(ex.startedAt).toLocaleString()}</td>
                  <td className="px-4 py-2 text-slate-500">
                    {new Date(ex.completedAt).getTime() - new Date(ex.startedAt).getTime()}ms
                  </td>
                  <td className="max-w-xs truncate px-4 py-2 text-red-600">{ex.error ?? "-"}</td>
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
