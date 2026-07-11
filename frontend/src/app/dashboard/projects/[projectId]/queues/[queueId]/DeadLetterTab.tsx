"use client";

import { useState } from "react";
import { useDeadLetterQueue } from "@/lib/hooks/queues";
import { useRetryJob } from "@/lib/hooks/jobs";
import { Button } from "@/components/ui/Button";
import { Pagination } from "@/components/ui/Pagination";
import { EmptyState, ErrorState } from "@/components/ui/EmptyState";
import { Spinner } from "@/components/ui/Spinner";
import { Badge } from "@/components/ui/Badge";

export function DeadLetterTab({
  orgId,
  projectId,
  queueId,
}: {
  orgId: string | null;
  projectId: string;
  queueId: string;
}) {
  const [page, setPage] = useState(1);
  const { data, isLoading, error } = useDeadLetterQueue(orgId, projectId, queueId, page);
  const retryJob = useRetryJob(orgId, projectId, queueId);

  return (
    <div>
      {isLoading && <Spinner />}
      {error && <ErrorState message="Failed to load Dead Letter Queue" />}
      {data && data.data.length === 0 && (
        <EmptyState title="Dead Letter Queue is empty" description="Permanently failed jobs will show up here." />
      )}

      {data && data.data.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2">Job</th>
                <th className="px-4 py-2">Reason</th>
                <th className="px-4 py-2">Failed at</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.data.map((entry) => (
                <tr key={entry.id}>
                  <td className="px-4 py-2 font-medium text-slate-800">
                    {entry.job.name}
                    <span className="ml-1 text-xs text-slate-400">({entry.job.attempts} attempts)</span>
                  </td>
                  <td className="max-w-xs truncate px-4 py-2 text-red-600">{entry.reason}</td>
                  <td className="px-4 py-2 text-slate-500">{new Date(entry.failedAt).toLocaleString()}</td>
                  <td className="px-4 py-2">
                    {entry.retriedAt ? (
                      <Badge color="blue">Retried {new Date(entry.retriedAt).toLocaleDateString()}</Badge>
                    ) : (
                      <Badge color="red">Unresolved</Badge>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <Button type="button" variant="ghost" onClick={() => retryJob.mutate(entry.jobId)}>
                      Retry
                    </Button>
                  </td>
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
