import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { Organization } from "@/lib/types";

export function useOrganizations() {
  return useQuery({
    queryKey: ["organizations"],
    queryFn: () => api.get<{ id: string; name: string; slug: string; role: string }[]>("/api/organizations"),
  });
}

export function useCreateOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string }) => api.post<Organization>("/api/organizations", data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["organizations"] }),
  });
}
