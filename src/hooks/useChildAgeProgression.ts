import { useEffect, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * School / life stages used to gate actions and unlock new UI on the
 * parenting loop. Persisted age/stage are now synchronised by a database RPC
 * using the database clock, so browser clock manipulation cannot advance a child.
 */
export type SchoolStage =
  | "infant" // 0-1
  | "toddler" // 2-3
  | "preschool" // 4-5
  | "primary" // 6-10
  | "middle" // 11-13
  | "high" // 14-17
  | "graduated"; // 18+

export interface SchoolStageMeta {
  stage: SchoolStage;
  label: string;
  ageRange: [number, number];
  description: string;
  playability: "npc" | "guided" | "playable";
}

export const SCHOOL_STAGES: SchoolStageMeta[] = [
  { stage: "infant", label: "Infant", ageRange: [0, 1], playability: "npc", description: "Round-the-clock care: feeding, sleep, comfort." },
  { stage: "toddler", label: "Toddler", ageRange: [2, 3], playability: "npc", description: "Exploration and play; basic learning starts." },
  { stage: "preschool", label: "Preschool", ageRange: [4, 5], playability: "npc", description: "Social play and early lessons unlock." },
  { stage: "primary", label: "Primary School", ageRange: [6, 10], playability: "guided", description: "Daily school, homework help, hobbies." },
  { stage: "middle", label: "Middle School", ageRange: [11, 13], playability: "guided", description: "Talents emerge — coach a skill focus." },
  { stage: "high", label: "High School", ageRange: [14, 17], playability: "guided", description: "Mentor career direction; allowance matters." },
  { stage: "graduated", label: "Adult", ageRange: [18, 999], playability: "playable", description: "Independent — eligible to become a playable character." },
];

export function getSchoolStage(age: number): SchoolStageMeta {
  return SCHOOL_STAGES.find((s) => age >= s.ageRange[0] && age <= s.ageRange[1]) ?? SCHOOL_STAGES[0];
}

/**
 * Returns the last authoritative age/stage immediately, then asks Postgres to
 * reconcile it from the canonical birth timestamp. The RPC is idempotent and
 * permission-checked; the client never writes current_age, school_stage or
 * playability_state directly.
 */
export function useChildAgeProgression(child: any | null | undefined) {
  const qc = useQueryClient();

  const result = useMemo(() => {
    if (!child) return null;
    const liveAge = Math.max(0, Number(child.current_age ?? 0));
    const stageMeta = getSchoolStage(liveAge);
    return { liveAge, stageMeta };
  }, [child]);

  useEffect(() => {
    if (!child?.id) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await (supabase as any).rpc("sync_child_progression", {
        p_child_id: child.id,
      });
      if (cancelled || error || !data) return;
      const synced = Array.isArray(data) ? data[0] : data;
      const changed =
        Number(synced?.current_age ?? 0) !== Number(child.current_age ?? 0) ||
        synced?.school_stage !== child.school_stage ||
        synced?.playability_state !== child.playability_state;
      if (changed) {
        await qc.invalidateQueries({ queryKey: ["player-child", child.id] });
        await qc.invalidateQueries({ queryKey: ["player-children"] });
      }
    })();
    return () => { cancelled = true; };
  }, [child?.id, child?.current_age, child?.school_stage, child?.playability_state, qc]);

  return result;
}
