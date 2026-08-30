import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { completeSocialActivity, respondSocialActivity } from "./service";

export interface SocialActivityParticipant {
  activity_id: string;
  player_id: string;
  invitation_status: string;
  attendance_status: string;
  cost_share: number | null;
  profiles?: { id: string; username: string | null; display_name: string | null } | null;
}

export interface SocialActivityDetailRow {
  id: string;
  activity_type: string;
  host_player_id: string;
  band_id: string | null;
  title: string;
  description: string | null;
  status: string;
  start_at: string;
  end_at: string;
  duration_minutes: number;
  cost_payer: string;
  estimated_cost: number | null;
  actual_cost: number | null;
  visibility: string;
  completed_at: string | null;
  cancelled_at: string | null;
  social_activity_participants?: SocialActivityParticipant[];
}

const ACTIVITY_SELECT = `
  id, activity_type, host_player_id, band_id, title, description, status,
  start_at, end_at, duration_minutes, cost_payer, estimated_cost, actual_cost,
  visibility, completed_at, cancelled_at,
  social_activity_participants (
    activity_id, player_id, invitation_status, attendance_status, cost_share,
    profiles:player_id ( id, username, display_name )
  )
`;

/** Every social activity the active character can see (hosted, invited or band-visible). */
export function useSocialActivities() {
  const { profileId } = useActiveProfile();

  return useQuery({
    queryKey: ["social-activities", profileId],
    enabled: !!profileId,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("social_activities")
        .select(ACTIVITY_SELECT)
        .order("start_at", { ascending: true })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as SocialActivityDetailRow[];
    },
  });
}

export function useSocialActivity(activityId?: string) {
  const { profileId } = useActiveProfile();

  return useQuery({
    queryKey: ["social-activity", activityId, profileId],
    enabled: !!activityId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("social_activities")
        .select(ACTIVITY_SELECT)
        .eq("id", activityId)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as SocialActivityDetailRow | null;
    },
  });
}

export function useSocialActivityActions() {
  const queryClient = useQueryClient();
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["social-activities"] });
    queryClient.invalidateQueries({ queryKey: ["social-activity"] });
    queryClient.invalidateQueries({ queryKey: ["scheduled-activities"] });
  };

  const respond = useMutation({
    mutationFn: ({ activityId, response }: { activityId: string; response: "accepted" | "declined" | "cancelled" }) =>
      respondSocialActivity(activityId, response),
    onSuccess: (_data, variables) => {
      invalidate();
      toast.success(
        variables.response === "accepted"
          ? "Invitation accepted — it is now in your diary."
          : variables.response === "declined"
            ? "Invitation declined."
            : "Activity cancelled."
      );
    },
    onError: (error: Error) => toast.error(error.message || "Could not update the invitation"),
  });

  const complete = useMutation({
    mutationFn: (activityId: string) => completeSocialActivity(activityId),
    onSuccess: () => {
      invalidate();
      toast.success("Activity completed — outcomes have been applied.");
    },
    onError: (error: Error) => toast.error(error.message || "Could not complete the activity"),
  });

  return { respond, complete };
}

export function categorizeSocialActivities(rows: SocialActivityDetailRow[], profileId: string | null) {
  const now = Date.now();
  const myEntry = (row: SocialActivityDetailRow) =>
    row.social_activity_participants?.find((p) => p.player_id === profileId) ?? null;

  const invitations = rows.filter(
    (row) => myEntry(row)?.invitation_status === "pending" && !["cancelled", "completed", "expired"].includes(row.status)
  );
  const hosting = rows.filter((row) => row.host_player_id === profileId && !["completed", "cancelled"].includes(row.status));
  const upcoming = rows.filter(
    (row) =>
      new Date(row.start_at).getTime() >= now &&
      !["completed", "cancelled", "expired"].includes(row.status) &&
      ["host", "accepted"].includes(myEntry(row)?.invitation_status ?? "")
  );
  const readyToComplete = rows.filter(
    (row) =>
      row.host_player_id === profileId &&
      new Date(row.end_at).getTime() <= now &&
      !["completed", "cancelled", "expired"].includes(row.status)
  );
  const completed = rows
    .filter((row) => row.status === "completed")
    .sort((a, b) => new Date(b.end_at).getTime() - new Date(a.end_at).getTime());
  const bandActivities = rows.filter((row) => !!row.band_id && !["completed", "cancelled"].includes(row.status));

  return { invitations, hosting, upcoming, readyToComplete, completed, bandActivities };
}
