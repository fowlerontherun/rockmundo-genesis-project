import { supabase } from "@/integrations/supabase/client";
import type { Database, Tables } from "@/integrations/supabase/types";

export type Friendship = Tables<"friendships">;
export type FriendshipStatus = Database["public"]["Enums"]["friendship_status"];

export class FriendshipsClientError extends Error {
  status?: number;
  details?: unknown;

  constructor(message: string, options?: { status?: number; details?: unknown }) {
    super(message);
    this.name = "FriendshipsClientError";
    this.status = options?.status;
    this.details = options?.details;
  }
}

const ensureProfileIdsAreDistinct = (requesterId: string, addresseeId: string) => {
  if (requesterId === addresseeId) {
    throw new FriendshipsClientError("Requester and addressee must be different profiles");
  }
};

const handleSingleRow = <Row>(result: {
  data: Row | null;
  error: { message: string; details?: unknown; code?: string; hint?: string } | null;
  status?: number;
}): Row => {
  if (result.error) {
    throw new FriendshipsClientError(result.error.message ?? "Friendship operation failed", {
      status: result.status,
      details: result.error.details ?? result.error,
    });
  }

  if (!result.data) {
    throw new FriendshipsClientError("No friendship record was returned from Supabase", {
      status: result.status,
    });
  }

  return result.data;
};

export const friendshipsClient = {
  async createRequest(params: { requesterId: string; addresseeId: string }): Promise<Friendship> {
    ensureProfileIdsAreDistinct(params.requesterId, params.addresseeId);

    const result = await supabase
      .from("friendships")
      .insert({
        requester_id: params.requesterId,
        addressee_id: params.addresseeId,
      })
      .select()
      .single();

    return handleSingleRow(result);
  },

  async updateStatus(friendshipId: string, status: FriendshipStatus): Promise<Friendship> {
    const result = await supabase
      .from("friendships")
      .update({ status })
      .eq("id", friendshipId)
      .select()
      .single();

    return handleSingleRow(result);
  },

  accept(friendshipId: string) {
    return this.updateStatus(friendshipId, "accepted");
  },

  decline(friendshipId: string) {
    return this.updateStatus(friendshipId, "declined");
  },

  block(friendshipId: string) {
    return this.updateStatus(friendshipId, "blocked");
  },
};
