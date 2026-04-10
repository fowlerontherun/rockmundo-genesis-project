import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveProfile } from "@/hooks/useActiveProfile";

export interface ConflictingActivity {
  id: string;
  activity_type: string;
  scheduled_start: string;
  scheduled_end: string;
  title: string;
}

export interface SuggestedSlot {
  start: Date;
  end: Date;
  label: string;
}

export interface ConflictCheckResult {
  hasConflict: boolean;
  conflicts: ConflictingActivity[];
  suggestions: SuggestedSlot[];
}

export function useScheduleConflictCheck() {
  const { profileId } = useActiveProfile();
  const [isChecking, setIsChecking] = useState(false);
  const [result, setResult] = useState<ConflictCheckResult | null>(null);

  const checkConflicts = async (
    start: Date,
    end: Date
  ): Promise<ConflictCheckResult> => {
    if (!profileId) {
      return { hasConflict: false, conflicts: [], suggestions: [] };
    }

    setIsChecking(true);
    try {
      // Find overlapping activities
      const { data: conflicts, error } = await (supabase as any)
        .from("player_scheduled_activities")
        .select("id, activity_type, scheduled_start, scheduled_end, title")
        .eq("profile_id", profileId)
        .in("status", ["scheduled", "in_progress"])
        .lt("scheduled_start", end.toISOString())
        .gt("scheduled_end", start.toISOString());

      if (error) {
        console.error("Conflict check error:", error);
        return { hasConflict: false, conflicts: [], suggestions: [] };
      }

      const typedConflicts: ConflictingActivity[] = (conflicts || []).map((c: any) => ({
        id: c.id,
        activity_type: c.activity_type,
        scheduled_start: c.scheduled_start,
        scheduled_end: c.scheduled_end,
        title: c.title,
      }));

      let suggestions: SuggestedSlot[] = [];
      if (typedConflicts.length > 0) {
        suggestions = await findNextAvailableSlots(
          profileId,
          start,
          end.getTime() - start.getTime()
        );
      }

      const checkResult: ConflictCheckResult = {
        hasConflict: typedConflicts.length > 0,
        conflicts: typedConflicts,
        suggestions,
      };

      setResult(checkResult);
      return checkResult;
    } finally {
      setIsChecking(false);
    }
  };

  const clearResult = () => setResult(null);

  return { checkConflicts, isChecking, result, clearResult };
}

async function findNextAvailableSlots(
  profileId: string,
  aroundDate: Date,
  durationMs: number
): Promise<SuggestedSlot[]> {
  // Look at the next 48 hours for available gaps
  const searchStart = new Date(aroundDate);
  const searchEnd = new Date(searchStart.getTime() + 48 * 60 * 60 * 1000);

  const { data: activities } = await (supabase as any)
    .from("player_scheduled_activities")
    .select("scheduled_start, scheduled_end")
    .eq("profile_id", profileId)
    .in("status", ["scheduled", "in_progress"])
    .lt("scheduled_start", searchEnd.toISOString())
    .gt("scheduled_end", searchStart.toISOString())
    .order("scheduled_start", { ascending: true });

  const busy = (activities || []).map((a: any) => ({
    start: new Date(a.scheduled_start).getTime(),
    end: new Date(a.scheduled_end).getTime(),
  }));

  // Merge overlapping intervals
  busy.sort((a: any, b: any) => a.start - b.start);
  const merged: { start: number; end: number }[] = [];
  for (const b of busy) {
    if (merged.length && b.start <= merged[merged.length - 1].end) {
      merged[merged.length - 1].end = Math.max(merged[merged.length - 1].end, b.end);
    } else {
      merged.push({ ...b });
    }
  }

  const suggestions: SuggestedSlot[] = [];
  let cursor = searchStart.getTime();

  // Check gaps between busy periods
  for (const block of merged) {
    if (block.start - cursor >= durationMs && cursor >= Date.now()) {
      const slotStart = new Date(cursor);
      const slotEnd = new Date(cursor + durationMs);
      suggestions.push({
        start: slotStart,
        end: slotEnd,
        label: formatSlotLabel(slotStart, slotEnd),
      });
      if (suggestions.length >= 3) break;
    }
    cursor = Math.max(cursor, block.end);
  }

  // Check after last busy block
  if (suggestions.length < 3 && cursor + durationMs <= searchEnd.getTime() && cursor >= Date.now()) {
    const slotStart = new Date(cursor);
    const slotEnd = new Date(cursor + durationMs);
    suggestions.push({
      start: slotStart,
      end: slotEnd,
      label: formatSlotLabel(slotStart, slotEnd),
    });
  }

  return suggestions;
}

function formatSlotLabel(start: Date, end: Date): string {
  const dateStr = start.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  const startTime = start.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
  const endTime = end.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
  return `${dateStr} ${startTime}–${endTime}`;
}
