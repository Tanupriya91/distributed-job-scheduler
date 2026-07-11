import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { toQueryString } from "@/lib/qs";
import { Job, JobExecution, JobStatus, JobType, Paginated } from "@/lib/types";

const base = (orgId: string, projectId: string, queueId: string) =>
  `/api/organizations/${orgId}/projects/${projectId}/queues/${queueId}/jobs`;

export function useJobs(
  orgId: string | null,
  projectId: string,
  queueId: string,
  page = 1,
  status?: JobStatus,
  type?: JobType
) {
  return useQuery({
    queryKey: ["jobs", orgId, projectId, queueId, page, status, type],
    queryFn: () =>
      api.get<Paginated<Job>>(`${base(orgId!, projectId, queueId)}${toQueryString({ page, pageSize: 20, status, type })}`),
    enabled: !!orgId,
    refetchInterval: 4000,
  });
}

export function useJob(orgId: string | null, projectId: string, queueId: string, jobId: string) {
  return useQuery({
    queryKey: ["job", orgId, projectId, queueId, jobId],
    queryFn: () => api.get<Job>(`${base(orgId!, projectId, queueId)}/${jobId}`),
    enabled: !!orgId,
    refetchInterval: 4000,
  });
}

export function useJobExecutions(orgId: string | null, projectId: string, queueId: string, jobId: string) {
  return useQuery({
    queryKey: ["job-executions", orgId, projectId, queueId, jobId],
    queryFn: () => api.get<{ data: JobExecution[] }>(`${base(orgId!, projectId, queueId)}/${jobId}/executions`),
    enabled: !!orgId,
  });
}

type CreateJobInput = {
  type: JobType;
  name: string;
  payload?: Record<string, unknown>;
  delaySeconds?: number;
  runAt?: string;
  idempotencyKey?: string;
};

export function useCreateJob(orgId: string | null, projectId: string, queueId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateJobInput) => api.post<Job>(base(orgId!, projectId, queueId), data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["jobs", orgId, projectId, queueId] }),
  });
}

export function useCancelJob(orgId: string | null, projectId: string, queueId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (jobId: string) => api.delete<Job>(`${base(orgId!, projectId, queueId)}/${jobId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["jobs", orgId, projectId, queueId] }),
  });
}

export function useRetryJob(orgId: string | null, projectId: string, queueId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (jobId: string) => api.post<Job>(`${base(orgId!, projectId, queueId)}/${jobId}/retry`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jobs", orgId, projectId, queueId] });
      queryClient.invalidateQueries({ queryKey: ["dead-letter-queue", orgId, projectId, queueId] });
    },
  });
}
