import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

const subscriptionQueryKey = (profileId?: string | null) => [
  "education",
  "youtube-skill-subscriptions",
  profileId,
] as const;

export const useEducationVideoSubscriptions = (profileId?: string | null) =>
  useQuery({
    queryKey: subscriptionQueryKey(profileId),
    enabled: Boolean(profileId),
    queryFn: async () => {
      const subscriptions = new Set<string>();
      for (let offset = 0; ; offset += 500) {
        const { data, error } = await (supabase as any)
          .from("education_youtube_skill_subscriptions")
          .select("skill_slug").eq("profile_id", profileId)
          .order("created_at", { ascending: true })
          .order("skill_slug", { ascending: true }).range(offset, offset + 499);
        if (error) throw error;
        for (const row of data ?? []) subscriptions.add(row.skill_slug);
        if (!data || data.length < 500) break;
      }
      return subscriptions;
    },
    staleTime: 1000 * 60,
  });

interface ToggleSubscriptionInput {
  skillSlug: string;
  subscribed: boolean;
}

export const useToggleEducationVideoSubscription = (profileId?: string | null) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ skillSlug, subscribed }: ToggleSubscriptionInput) => {
      if (!profileId) throw new Error("Choose a character before subscribing to a skill.");

      if (subscribed) {
        const { error } = await (supabase as any)
          .from("education_youtube_skill_subscriptions")
          .delete()
          .eq("profile_id", profileId)
          .eq("skill_slug", skillSlug);
        if (error) throw error;
        return { skillSlug, subscribed: false };
      }

      const { error } = await (supabase as any)
        .from("education_youtube_skill_subscriptions")
        .upsert(
          { profile_id: profileId, skill_slug: skillSlug },
          { onConflict: "profile_id,skill_slug" },
        );
      if (error) throw error;
      return { skillSlug, subscribed: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: subscriptionQueryKey(profileId) });
    },
  });
};
