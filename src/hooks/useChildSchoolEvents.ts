import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { asAny } from "@/lib/type-helpers";
import { toast } from "sonner";

export interface ChildSchoolEvent {
  id: string;
  child_id: string;
  parent_profile_id: string;
  event_type: string;
  teacher_name: string | null;
  subject: string | null;
  rating: number;
  behavior_rating: number | null;
  academic_rating: number | null;
  notes: string | null;
  effects: Record<string, unknown>;
  occurred_at: string;
  created_at: string;
}

export function useChildSchoolEvents(childId: string | undefined) {
  return useQuery({
    queryKey: ["child-school-events", childId],
    enabled: !!childId,
    queryFn: async (): Promise<ChildSchoolEvent[]> => {
      if (!childId) return [];
      const { data, error } = await supabase
        .from(asAny("child_school_events"))
        .select("*")
        .eq("child_id", childId)
        .order("occurred_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as unknown as ChildSchoolEvent[];
    },
  });
}

export function useChildrenSchoolEvents(childIds: string[]) {
  return useQuery({
    queryKey: ["children-school-events", childIds.join(",")],
    enabled: childIds.length > 0,
    queryFn: async (): Promise<ChildSchoolEvent[]> => {
      const { data, error } = await supabase
        .from(asAny("child_school_events"))
        .select("*")
        .in("child_id", childIds)
        .order("occurred_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as unknown as ChildSchoolEvent[];
    },
  });
}

export interface LogSchoolEventParams {
  childId: string;
  eventType?: string;
  teacherName?: string | null;
  subject?: string | null;
  rating: number;
  behaviorRating?: number | null;
  academicRating?: number | null;
  notes?: string | null;
}

export function useLogChildSchoolEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: LogSchoolEventParams) => {
      const { data, error } = await (supabase as any).rpc("log_child_school_event", {
        p_child_id: params.childId,
        p_event_type: params.eventType ?? "parent_teacher_day",
        p_teacher_name: params.teacherName ?? null,
        p_subject: params.subject ?? null,
        p_rating: params.rating,
        p_behavior_rating: params.behaviorRating ?? null,
        p_academic_rating: params.academicRating ?? null,
        p_notes: params.notes ?? null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, params) => {
      toast.success("Parent-teacher day logged");
      qc.invalidateQueries({ queryKey: ["child-school-events", params.childId] });
      qc.invalidateQueries({ queryKey: ["children-school-events"] });
      qc.invalidateQueries({ queryKey: ["player-child", params.childId] });
      qc.invalidateQueries({ queryKey: ["player-children"] });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to log school event");
    },
  });
}
