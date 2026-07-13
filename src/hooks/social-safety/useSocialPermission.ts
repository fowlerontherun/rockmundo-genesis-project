import { useQuery } from "@tanstack/react-query";
import { getSocialPermissions } from "@/services/social-safety/SocialPermissionService";

export function useSocialPermission(targetProfileId?: string | null) {
  return useQuery({
    queryKey: ["social-permission", targetProfileId],
    queryFn: () => getSocialPermissions(targetProfileId!),
    enabled: !!targetProfileId,
    staleTime: 30_000,
  });
}
