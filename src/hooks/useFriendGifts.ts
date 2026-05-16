import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { asAny } from "@/lib/type-helpers";
import { toast } from "sonner";

export const GIFT_CATALOG = [
  { value: "flowers", label: "Flowers", costCents: 5_000, affection: 2 },
  { value: "concert_ticket", label: "Concert Ticket", costCents: 25_000, affection: 5 },
  { value: "merch", label: "Custom Merch", costCents: 50_000, affection: 7 },
  { value: "vinyl", label: "Rare Vinyl", costCents: 100_000, affection: 10 },
  { value: "jewelry", label: "Jewelry", costCents: 500_000, affection: 20 },
  { value: "vacation", label: "Surprise Vacation", costCents: 2_000_000, affection: 40 },
] as const;

export interface FriendGift {
  id: string;
  sender_profile_id: string;
  recipient_profile_id: string;
  gift_type: string;
  gift_name: string;
  cost_cents: number;
  message: string | null;
  affection_bonus: number;
  created_at: string;
}

export function useFriendGiftHistory(profileId: string | undefined) {
  return useQuery({
    queryKey: ["friend-gifts", profileId],
    enabled: !!profileId,
    queryFn: async (): Promise<FriendGift[]> => {
      if (!profileId) return [];
      const { data, error } = await supabase
        .from(asAny("friend_gifts"))
        .select("*")
        .or(`sender_profile_id.eq.${profileId},recipient_profile_id.eq.${profileId}`)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as unknown as FriendGift[];
    },
  });
}

export function useSendFriendGift() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      senderProfileId: string;
      recipientProfileId: string;
      giftType: string;
      message?: string;
    }) => {
      const cfg = GIFT_CATALOG.find((g) => g.value === params.giftType);
      if (!cfg) throw new Error("Unknown gift");
      const { data, error } = await supabase
        .from(asAny("friend_gifts"))
        .insert(asAny({
          sender_profile_id: params.senderProfileId,
          recipient_profile_id: params.recipientProfileId,
          gift_type: params.giftType,
          gift_name: cfg.label,
          cost_cents: cfg.costCents,
          affection_bonus: cfg.affection,
          message: params.message ?? null,
        }))
        .select().single();
      if (error) throw error;
      // Best-effort affection bump via RPC if available
      try {
        await (supabase as any).rpc('increment_relationship_score', {
          p_entity_a_id: params.senderProfileId,
          p_entity_b_id: params.recipientProfileId,
          p_field: 'affection_score',
          p_delta: cfg.affection,
        });
      } catch { /* RPC may not exist */ }
      return data;
    },
    onSuccess: () => {
      toast.success("Gift sent! 🎁");
      qc.invalidateQueries({ queryKey: ["friend-gifts"] });
      qc.invalidateQueries({ queryKey: ["character-relationships"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
