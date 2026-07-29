import { supabase } from "@/integrations/supabase/client";

export interface CatchUpToTourResult {
  tour_id: string;
  profile_id: string;
  travel_id?: string;
  fee: number;
  arrival_time?: string;
  already_in_city?: boolean;
  already_booked?: boolean;
  request_id: string;
}

const createRequestId = (): string => crypto.randomUUID();

export const catchUpToTour = async (
  tourId: string,
  profileId: string,
  requestId = createRequestId(),
): Promise<CatchUpToTourResult> => {
  const { data, error } = await (supabase.rpc as any)("catch_up_to_tour", {
    p_tour_id: tourId,
    p_profile_id: profileId,
    p_request_id: requestId,
  });

  if (error) throw error;
  if (!data) throw new Error("tour_catch_up_empty_response");

  return data as CatchUpToTourResult;
};
