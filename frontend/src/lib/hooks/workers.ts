import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { toQueryString } from "@/lib/qs";
import { Paginated, Worker, WorkerDetail } from "@/lib/types";

export function useWorkers(page = 1) {
  return useQuery({
    queryKey: ["workers", page],
    queryFn: () => api.get<Paginated<Worker>>(`/api/workers${toQueryString({ page, pageSize: 20 })}`),
    refetchInterval: 5000,
  });
}

export function useWorker(workerId: string) {
  return useQuery({
    queryKey: ["worker", workerId],
    queryFn: () => api.get<WorkerDetail>(`/api/workers/${workerId}`),
    refetchInterval: 5000,
  });
}
