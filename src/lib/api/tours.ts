import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/lib/supabase-types";

export type TourRecord = Tables<"tours">;

export interface UpdateTourInput {
  name: TourRecord["name"];
}

export const listTours = async (bandId?: string): Promise<TourRecord[]> => {
  let query = supabase.from("tours").select("*").order("start_date", { ascending: true });

  if (bandId) {
    query = query.eq("band_id", bandId);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return data ?? [];
};

export const getTour = async (id: string): Promise<TourRecord | null> => {
  const { data, error } = await supabase.from("tours").select("*").eq("id", id).single();

  if (error) {
    if (error.code === "PGRST116") {
      return null;
    }

    throw error;
  }

  return data ?? null;
};

export const updateTour = async (
  id: string,
  input: UpdateTourInput
): Promise<TourRecord> => {
  const { data, error } = await (supabase.rpc as any)("update_tour_metadata", {
    p_tour_id: id,
    p_name: input.name,
  });

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error("Unable to locate tour for update");
  }

  return data as TourRecord;
};
