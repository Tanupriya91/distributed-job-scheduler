import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { toQueryString } from "@/lib/qs";
import { Paginated, RecurringJob } from "@/lib/types";

const base = (orgId: string, projectId: string, queueId: string) =>
  `/api/organizations/${orgId}/projects/${projectId}/queues/${queueId}/recurring-jobs`;

export function useRecurringJobs(orgId: string | null, projectId: string, queueId: string, page = 1) {
  return useQuery({
    queryKey: ["recurring-jobs", orgId, projectId, queueId, page],
    queryFn: () =>
      api.get<Paginated<RecurringJob>>(`${base(orgId!, projectId, queueId)}${toQueryString({ page, pageSize: 20 })}`),
    enabled: !!orgId,
    refetchInterval: 5000,
  });
}

export function useCreateRecurringJob(orgId: string | null, projectId: string, queueId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; cronExpression: string; payload?: Record<string, unknown> }) =>
      api.post<RecurringJob>(base(orgId!, projectId, queueId), data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["recurring-jobs", orgId, projectId, queueId] }),
  });
}

export function useSetRecurringJobPaused(orgId: string | null, projectId: string, queueId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, paused }: { id: string; paused: boolean }) =>
      api.post<RecurringJob>(`${base(orgId!, projectId, queueId)}/${id}/${paused ? "pause" : "resume"}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["recurring-jobs", orgId, projectId, queueId] }),
  });
}

export function useDeleteRecurringJob(orgId: string | null, projectId: string, queueId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`${base(orgId!, projectId, queueId)}/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["recurring-jobs", orgId, projectId, queueId] }),
  });
}
