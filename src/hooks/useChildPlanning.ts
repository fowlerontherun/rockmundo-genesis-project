import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth-context";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { asAny } from "@/lib/type-helpers";
import { toast } from "sonner";

export interface ChildRequest {
  id: string;
  parent_a_id: string;
  parent_b_id: string;
  marriage_id: string;
  controller_parent_id: string | null;
  surname_policy: string;
  custom_surname: string | null;
  upbringing_focus: string;
  pathway: string;
  agency: string | null;
  application_fee_cents: number | null;
  status: string;
  expires_at: string | null;
  gestation_ends_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PlayerChild {
  id: string;
  parent_a_id: string;
  parent_b_id: string;
  controller_user_id: string | null;
  child_profile_id: string | null;
  child_request_id: string | null;
  marriage_id: string | null;
  name: string;
  surname: string;
  birth_game_date: Record<string, unknown>;
  current_age: number;
  playability_state: string;
  inherited_potentials: Record<string, number>;
  traits: string[];
  emotional_stability: number;
  bond_parent_a: number;
  bond_parent_b: number;
  created_at: string;
  updated_at: string;
}

export function useChildRequests(profileId: string | undefined) {
  return useQuery({
    queryKey: ["child-requests", profileId],
    queryFn: async (): Promise<ChildRequest[]> => {
      if (!profileId) return [];
      const { data, error } = await supabase
        .from(asAny("child_requests"))
        .select("*")
        .or(`parent_a_id.eq.${profileId},parent_b_id.eq.${profileId}`)
        .in("status", ["pending", "accepted"])
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as ChildRequest[];
    },
    enabled: !!profileId,
  });
}

export function usePlayerChildren(profileId: string | undefined) {
  return useQuery({
    queryKey: ["player-children", profileId],
    queryFn: async (): Promise<PlayerChild[]> => {
      if (!profileId) return [];
      const { data, error } = await supabase
        .from(asAny("player_children"))
        .select("*")
        .or(`parent_a_id.eq.${profileId},parent_b_id.eq.${profileId}`)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as PlayerChild[];
    },
    enabled: !!profileId,
  });
}

export function useRequestChild() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      parentAId: string;
      parentBId: string;
      marriageId: string;
      controllerParentId: string;
      surnamePolicy: string;
      customSurname?: string;
      upbringingFocus: string;
      pathway?: "biological" | "adoption";
      agency?: string;
      applicationFeeCents?: number;
    }) => {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      const { data, error } = await supabase
        .from(asAny("child_requests"))
        .insert(asAny({
          parent_a_id: params.parentAId,
          parent_b_id: params.parentBId,
          marriage_id: params.marriageId,
          controller_parent_id: params.controllerParentId,
          surname_policy: params.surnamePolicy,
          custom_surname: params.customSurname ?? null,
          upbringing_focus: params.upbringingFocus,
          pathway: params.pathway ?? "biological",
          agency: params.agency ?? null,
          application_fee_cents: params.applicationFeeCents ?? null,
          status: "pending",
          expires_at: expiresAt.toISOString(),
        }))
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Child planning request sent to your partner! 👶");
      queryClient.invalidateQueries({ queryKey: ["child-requests"] });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to send child request");
    },
  });
}

export function useRespondToChildRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ requestId, accept }: { requestId: string; accept: boolean }) => {
      if (accept) {
        // Look up the request to determine pathway-specific wait
        const { data: req } = await supabase
          .from(asAny("child_requests"))
          .select("pathway")
          .eq("id", requestId)
          .single();
        const pathway = (req as any)?.pathway ?? "biological";
        const waitDays = pathway === "adoption" ? 14 : 7;

        const gestationEnds = new Date();
        gestationEnds.setDate(gestationEnds.getDate() + waitDays);

        const { error } = await supabase
          .from(asAny("child_requests"))
          .update(asAny({
            status: "accepted",
            gestation_ends_at: gestationEnds.toISOString(),
          }))
          .eq("id", requestId);
        if (error) throw error;
        return { pathway, waitDays };
      } else {
        const { error } = await supabase
          .from(asAny("child_requests"))
          .update(asAny({ status: "rejected" }))
          .eq("id", requestId);
        if (error) throw error;
        return { pathway: null, waitDays: 0 };
      }
    },
    onSuccess: (result, vars) => {
      if (vars.accept) {
        const isAdoption = result?.pathway === "adoption";
        toast.success(
          isAdoption
            ? `Adoption request accepted! Match in ~${result.waitDays} days 🤝`
            : `Child request accepted! Expecting in ${result.waitDays} days 🍼`
        );
      } else {
        toast.success("Child request declined");
      }
      queryClient.invalidateQueries({ queryKey: ["child-requests"] });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to respond");
    },
  });
}

const UPBRINGING_MODIFIERS: Record<string, Record<string, number>> = {
  balanced: {},
  artistic: { songwriting: 1.15, creativity: 1.15, performance: 1.10, technical: 0.90 },
  academic: { technical: 1.15, composition: 1.15, songwriting: 1.05, performance: 0.90 },
  athletic: { performance: 1.15, drums: 1.10, bass: 1.05, songwriting: 0.90 },
  social: { vocals: 1.15, performance: 1.10, guitar: 1.05, composition: 0.90 },
};

export function calculateInheritedPotentials(
  parentASkills: Record<string, number>,
  parentBSkills: Record<string, number>,
  upbringingFocus: string,
): Record<string, number> {
  const domains = ["vocals", "guitar", "bass", "drums", "songwriting", "performance", "creativity", "technical", "composition"];
  const modifiers = UPBRINGING_MODIFIERS[upbringingFocus] ?? {};
  const potentials: Record<string, number> = {};

  for (const domain of domains) {
    const a = parentASkills[domain] ?? 1;
    const b = parentBSkills[domain] ?? 1;
    const random = (Math.random() * 20 - 10); // -10 to +10
    let potential = 0.45 * a + 0.45 * b + 0.10 * random;
    potential *= modifiers[domain] ?? 1.0;
    potentials[domain] = Math.max(1, Math.min(20, Math.round(potential)));
  }

  return potentials;
}

export function useCompleteChildBirth() {
  const queryClient = useQueryClient();
  const { profileId } = useActiveProfile();

  return useMutation({
    mutationFn: async (params: {
      requestId: string;
      name: string;
      parentAId: string;
      parentBId: string;
      marriageId: string;
      controllerUserId: string;
      surname: string;
      inheritedPotentials: Record<string, number>;
    }) => {
      // Create child record
      const { data, error } = await supabase
        .from(asAny("player_children"))
        .insert(asAny({
          parent_a_id: params.parentAId,
          parent_b_id: params.parentBId,
          controller_user_id: params.controllerUserId,
          child_request_id: params.requestId,
          marriage_id: params.marriageId,
          name: params.name,
          surname: params.surname,
          birth_game_date: { date: new Date().toISOString() },
          current_age: 0,
          playability_state: "npc",
          inherited_potentials: params.inheritedPotentials,
        }))
        .select()
        .single();
      if (error) throw error;

      // Mark request completed
      await supabase
        .from(asAny("child_requests"))
        .update(asAny({ status: "completed" }))
        .eq("id", params.requestId);

      // Post activity feed entry
      if (profileId) {
        await supabase.from("activity_feed").insert({
          user_id: profileId,
          profile_id: profileId,
          activity_type: "child_born",
          message: `👶 Welcome ${params.name} ${params.surname} to the family!`,
          metadata: { child_id: (data as any)?.id },
        });
      }

      return data;
    },
    onSuccess: () => {
      toast.success("A child is born! 🎉👶");
      queryClient.invalidateQueries({ queryKey: ["player-children"] });
      queryClient.invalidateQueries({ queryKey: ["child-requests"] });
      queryClient.invalidateQueries({ queryKey: ["activity-feed"] });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to complete birth");
    },
  });
}
