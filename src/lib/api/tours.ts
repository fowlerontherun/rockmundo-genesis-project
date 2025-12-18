// @ts-nocheck
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/lib/supabase-types";

export type TourRecord = Tables<"tours">;

export interface CreateTourInput {
  name: TourRecord["name"];
  bandId: TourRecord["band_id"];
  startDate: TourRecord["start_date"];
  endDate: TourRecord["end_date"];
  userId: TourRecord["user_id"];
}

export interface UpdateTourInput {
  name?: TourRecord["name"];
  bandId?: TourRecord["band_id"];
  startDate?: TourRecord["start_date"];
  endDate?: TourRecord["end_date"];
}

const toDbPayload = (input: Partial<CreateTourInput & UpdateTourInput>) => {
  const payload: Partial<TourRecord> = {};

  if (input.name !== undefined) {
    payload.name = input.name;
  }

  if (input.bandId !== undefined) {
    payload.band_id = input.bandId;
  }

  if ((input as CreateTourInput).userId !== undefined) {
    payload.user_id = (input as CreateTourInput).userId;
  }

  if (input.startDate !== undefined) {
    payload.start_date = input.startDate;
  }

  if (input.endDate !== undefined) {
    payload.end_date = input.endDate;
  }

  return payload;
};

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

export const createTour = async (input: CreateTourInput): Promise<TourRecord> => {
  const payload = toDbPayload(input);

  const { data, error } = await supabase
    .from("tours")
    .insert({
      ...payload,
      created_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data as TourRecord;
};

export const updateTour = async (
  id: string,
  input: UpdateTourInput
): Promise<TourRecord> => {
  const payload = toDbPayload(input);

  const { data, error } = await supabase
    .from("tours")
    .update(payload)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error("Unable to locate tour for update");
  }

  return data as TourRecord;
};

export const deleteTour = async (id: string): Promise<void> => {
  const { error } = await supabase.from("tours").delete().eq("id", id);

  if (error) {
    throw error;
  }
};
