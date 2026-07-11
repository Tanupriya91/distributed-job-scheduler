import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { toQueryString } from "@/lib/qs";
import { Paginated, Project, ProjectStats } from "@/lib/types";

export function useProjects(orgId: string | null, page = 1) {
  return useQuery({
    queryKey: ["projects", orgId, page],
    queryFn: () =>
      api.get<Paginated<Project>>(`/api/organizations/${orgId}/projects${toQueryString({ page, pageSize: 20 })}`),
    enabled: !!orgId,
  });
}

export function useProject(orgId: string | null, projectId: string) {
  return useQuery({
    queryKey: ["project", orgId, projectId],
    queryFn: () => api.get<Project>(`/api/organizations/${orgId}/projects/${projectId}`),
    enabled: !!orgId,
  });
}

export function useProjectStats(orgId: string | null, projectId: string) {
  return useQuery({
    queryKey: ["project-stats", orgId, projectId],
    queryFn: () => api.get<ProjectStats>(`/api/organizations/${orgId}/projects/${projectId}/stats`),
    enabled: !!orgId,
    refetchInterval: 5000,
  });
}

export function useCreateProject(orgId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string }) => api.post<Project>(`/api/organizations/${orgId}/projects`, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["projects", orgId] }),
  });
}
