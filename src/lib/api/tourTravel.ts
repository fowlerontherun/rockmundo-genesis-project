import { supabase } from "@/integrations/supabase/client";

export interface RegenerateTourTravelLegsResult {
  tour_id: string;
  created: number;
  existing: number;
  already_repaired: boolean;
  request_id: string;
}

export interface SyncTourMemberTravelResult {
  tour_id: string;
  tour_name: string;
  created: number;
  skipped_existing: number;
  request_id: string;
}

const createRequestId = (): string => crypto.randomUUID();

export const regenerateTourTravelLegs = async (
  tourId: string,
  requestId = createRequestId(),
): Promise<RegenerateTourTravelLegsResult> => {
  const { data, error } = await (supabase.rpc as any)("regenerate_tour_travel_legs", {
    p_tour_id: tourId,
    p_request_id: requestId,
  });

  if (error) throw error;
  if (!data) throw new Error("tour_travel_repair_empty_response");

  return data as RegenerateTourTravelLegsResult;
};

export const syncTourMemberTravel = async (
  tourId: string,
  requestId = createRequestId(),
): Promise<SyncTourMemberTravelResult> => {
  const { data, error } = await (supabase.rpc as any)("sync_tour_member_travel", {
    p_tour_id: tourId,
    p_request_id: requestId,
  });

  if (error) throw error;
  if (!data) throw new Error("tour_member_travel_empty_response");

  return data as SyncTourMemberTravelResult;
};
