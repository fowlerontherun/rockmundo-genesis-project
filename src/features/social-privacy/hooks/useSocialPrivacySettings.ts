import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchOwnSocialPrivacySettings,
  saveOwnSocialPrivacySettings,
  type SocialPrivacySettingsUpdate,
} from "../services/socialPrivacySettings";

export const socialPrivacySettingsQueryKey = (profileId: string | null) => [
  "social-privacy-settings",
  profileId,
];

export function useSocialPrivacySettings(profileId: string | null) {
  const queryClient = useQueryClient();

  const settingsQuery = useQuery({
    queryKey: socialPrivacySettingsQueryKey(profileId),
    queryFn: () => fetchOwnSocialPrivacySettings(profileId!),
    enabled: Boolean(profileId),
  });

  const saveMutation = useMutation({
    mutationFn: (input: SocialPrivacySettingsUpdate) => saveOwnSocialPrivacySettings(profileId!, input),
    onSuccess: (saved) => {
      queryClient.setQueryData(socialPrivacySettingsQueryKey(profileId), saved);
    },
  });

  return {
    ...settingsQuery,
    saveSettings: saveMutation.mutateAsync,
    isSaving: saveMutation.isPending,
    saveError: saveMutation.error,
  };
}
