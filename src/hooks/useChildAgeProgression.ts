import { useEffect, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { asAny } from "@/lib/type-helpers";
import { calculateInGameDate, type InGameDate } from "@/utils/gameCalendar";

/**
 * School / life stages used to gate actions and unlock new UI on the
 * parenting loop. Stages are derived purely from in-game age so the UI
 * updates automatically as game time advances.
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
  /** Brief description shown on the child detail page. */
  description: string;
  /** Playability state suggested by this stage. */
  playability: "npc" | "guided" | "playable";
}

export const SCHOOL_STAGES: SchoolStageMeta[] = [
  { stage: "infant", label: "Infant", ageRange: [0, 1], playability: "npc", description: "Round-the-clock care: feeding, sleep, comfort." },
  { stage: "toddler", label: "Toddler", ageRange: [2, 3], playability: "npc", description: "Exploration and play; basic learning starts." },
  { stage: "preschool", label: "Preschool", ageRange: [4, 5], playability: "npc", description: "Social play and early lessons unlock." },
  { stage: "primary", label: "Primary School", ageRange: [6, 10], playability: "guided", description: "Daily school, homework help, hobbies." },
  { stage: "middle", label: "Middle School", ageRange: [11, 13], playability: "guided", description: "Talents emerge — coach a skill focus." },
  { stage: "high", label: "High School", ageRange: [14, 17], playability: "guided", description: "Mentor career direction; allowance matters." },
  { stage: "graduated", label: "Adult", ageRange: [18, 999], playability: "playable", description: "Independent — playable as a character." },
];

export function getSchoolStage(age: number): SchoolStageMeta {
  return (
    SCHOOL_STAGES.find((s) => age >= s.ageRange[0] && age <= s.ageRange[1]) ??
    SCHOOL_STAGES[0]
  );
}

interface BirthGameDate {
  gameYear?: number;
  gameMonth?: number;
  gameDay?: number;
}

export function computeAgeFromBirth(birth: BirthGameDate | null | undefined, current: InGameDate): number {
  if (!birth?.gameYear) return 0;
  let age = current.gameYear - birth.gameYear;
  const beforeBirthday =
    current.gameMonth < (birth.gameMonth ?? 1) ||
    (current.gameMonth === (birth.gameMonth ?? 1) && current.gameDay < (birth.gameDay ?? 1));
  if (beforeBirthday) age -= 1;
  return Math.max(0, age);
}

/**
 * Derives the child's live age + school stage from the shared game epoch.
 * Persists changes back to player_children when the computed age or stage
 * drifts from the stored value (so badges/ChildCard stay in sync everywhere).
 */
export function useChildAgeProgression(child: any | null | undefined) {
  const qc = useQueryClient();

  const result = useMemo(() => {
    if (!child) return null;
    const current = calculateInGameDate();
    const liveAge = computeAgeFromBirth(child.birth_game_date as BirthGameDate, current);
    const stageMeta = getSchoolStage(liveAge);
    return { liveAge, stageMeta, currentGameDate: current };
  }, [child]);

  useEffect(() => {
    if (!child || !result) return;
    const { liveAge, stageMeta } = result;
    const ageDrift = (child.current_age ?? 0) !== liveAge;
    const stageDrift = (child.school_stage ?? null) !== stageMeta.stage;
    if (!ageDrift && !stageDrift) return;

    let cancelled = false;
    (async () => {
      const patch: Record<string, unknown> = {};
      if (ageDrift) patch.current_age = liveAge;
      if (stageDrift) patch.school_stage = stageMeta.stage;
      // Auto-promote playability state forward only (never demote a player's choice).
      const order = ["npc", "guided", "playable"];
      const currentIdx = order.indexOf(child.playability_state ?? "npc");
      const targetIdx = order.indexOf(stageMeta.playability);
      if (targetIdx > currentIdx) patch.playability_state = stageMeta.playability;

      const { error } = await supabase
        .from(asAny("player_children"))
        .update(patch)
        .eq("id", child.id);
      if (!cancelled && !error) {
        qc.invalidateQueries({ queryKey: ["player-child", child.id] });
        qc.invalidateQueries({ queryKey: ["player-children"] });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [child, result, qc]);

  return result;
}
