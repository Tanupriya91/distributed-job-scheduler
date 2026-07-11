import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { toQueryString } from "@/lib/qs";
import { DeadLetterEntry, JobExecution, Paginated, Queue, QueueStats, RetryStrategy } from "@/lib/types";

const base = (orgId: string, projectId: string) => `/api/organizations/${orgId}/projects/${projectId}/queues`;

export function useQueues(orgId: string | null, projectId: string, page = 1) {
  return useQuery({
    queryKey: ["queues", orgId, projectId, page],
    queryFn: () => api.get<Paginated<Queue>>(`${base(orgId!, projectId)}${toQueryString({ page, pageSize: 20 })}`),
    enabled: !!orgId,
    refetchInterval: 5000,
  });
}

export function useQueue(orgId: string | null, projectId: string, queueId: string) {
  return useQuery({
    queryKey: ["queue", orgId, projectId, queueId],
    queryFn: () => api.get<Queue>(`${base(orgId!, projectId)}/${queueId}`),
    enabled: !!orgId,
    refetchInterval: 5000,
  });
}

export function useQueueStats(orgId: string | null, projectId: string, queueId: string) {
  return useQuery({
    queryKey: ["queue-stats", orgId, projectId, queueId],
    queryFn: () => api.get<QueueStats>(`${base(orgId!, projectId)}/${queueId}/stats`),
    enabled: !!orgId,
    refetchInterval: 5000,
  });
}

export function useQueueExecutions(orgId: string | null, projectId: string, queueId: string, page = 1, status?: string) {
  return useQuery({
    queryKey: ["queue-executions", orgId, projectId, queueId, page, status],
    queryFn: () =>
      api.get<Paginated<JobExecution>>(
        `${base(orgId!, projectId)}/${queueId}/executions${toQueryString({ page, pageSize: 20, status })}`
      ),
    enabled: !!orgId,
    refetchInterval: 5000,
  });
}

export function useDeadLetterQueue(orgId: string | null, projectId: string, queueId: string, page = 1) {
  return useQuery({
    queryKey: ["dead-letter-queue", orgId, projectId, queueId, page],
    queryFn: () =>
      api.get<Paginated<DeadLetterEntry>>(
        `${base(orgId!, projectId)}/${queueId}/dead-letter-queue${toQueryString({ page, pageSize: 20 })}`
      ),
    enabled: !!orgId,
    refetchInterval: 5000,
  });
}

type QueueMutationInput = {
  name: string;
  priority?: number;
  concurrencyLimit?: number;
  retryPolicy?: { strategy?: RetryStrategy; maxAttempts?: number; baseDelaySeconds?: number; maxDelaySeconds?: number };
};

export function useCreateQueue(orgId: string | null, projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: QueueMutationInput) => api.post<Queue>(base(orgId!, projectId), data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["queues", orgId, projectId] }),
  });
}

export function useUpdateQueue(orgId: string | null, projectId: string, queueId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<QueueMutationInput> & { isPaused?: boolean }) =>
      api.patch<Queue>(`${base(orgId!, projectId)}/${queueId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["queue", orgId, projectId, queueId] });
      queryClient.invalidateQueries({ queryKey: ["queues", orgId, projectId] });
    },
  });
}

export function useSetQueuePaused(orgId: string | null, projectId: string, queueId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (paused: boolean) =>
      api.post<Queue>(`${base(orgId!, projectId)}/${queueId}/${paused ? "pause" : "resume"}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["queue", orgId, projectId, queueId] });
      queryClient.invalidateQueries({ queryKey: ["queues", orgId, projectId] });
    },
  });
}
