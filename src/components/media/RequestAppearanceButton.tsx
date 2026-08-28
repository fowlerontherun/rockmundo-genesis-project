import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Megaphone, Loader2 } from "lucide-react";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { getEdgeFunctionErrorMessage } from "@/lib/edgeFunctionErrors";

export type RequestableMediaType =
  | "radio"
  | "tv"
  | "podcast"
  | "newspaper"
  | "magazine"
  | "youtube"
  | "website";

interface RequestAppearanceButtonProps {
  mediaType: RequestableMediaType;
  outletId: string;
  outletName: string;
  showId?: string | null;
  showName?: string | null;
  minFameRequired?: number | null;
  label?: string;
  className?: string;
  size?: "sm" | "default";
  variant?: "default" | "outline" | "secondary" | "ghost";
}

/** Band leader's active band — needed because only leaders can request appearances. */
export function useLeaderBand() {
  const { profileId } = useActiveProfile();
  return useQuery({
    queryKey: ["leader-band", profileId],
    queryFn: async () => {
      if (!profileId) return null;
      const { data, error } = await supabase
        .from("bands")
        .select("id, name, fame")
        .eq("leader_id", profileId)
        .eq("status", "active")
        .order("fame", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!profileId,
    staleTime: 60 * 1000,
  });
}

export function RequestAppearanceButton({
  mediaType,
  outletId,
  outletName,
  showId = null,
  showName = null,
  minFameRequired = 0,
  label = "Request Appearance",
  className,
  size = "sm",
  variant = "outline",
}: RequestAppearanceButtonProps) {
  const queryClient = useQueryClient();
  const { data: band } = useLeaderBand();
  const [booking, setBooking] = useState(false);

  const requestMutation = useMutation({
    mutationFn: async () => {
      if (!band?.id) throw new Error("You must lead an active band to request media appearances.");

      const proposedDate = new Date();
      proposedDate.setDate(proposedDate.getDate() + 2);

      const { data: offerId, error } = await (supabase as any).rpc("request_media_appearance", {
        p_band_id: band.id,
        p_media_type: mediaType,
        p_media_outlet_id: outletId,
        p_outlet_name: outletName,
        p_show_id: showId,
        p_show_name: showName,
        p_proposed_date: proposedDate.toISOString().split("T")[0],
        p_offer_type: "general_promo",
      });
      if (error) throw error;

      // Immediately confirm the booking so the slot is scheduled and blocks the diary.
      const { data: result, error: fnError } = await supabase.functions.invoke("process-pr-activity", {
        body: { offerId, action: "accept" },
      });
      if (fnError) {
        throw new Error(
          await getEdgeFunctionErrorMessage(fnError, "This appearance could not be booked."),
        );
      }
      if (result && result.success === false) {
        throw new Error(result.message || "Could not book this appearance.");
      }
      return result;
    },
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: ["pr-offers"] });
      queryClient.invalidateQueries({ queryKey: ["pr-appearances"] });
      queryClient.invalidateQueries({ queryKey: ["scheduled-activities"] });
      toast.success("Appearance booked", {
        description: result?.scheduledFor
          ? `${outletName} — ${result.scheduledFor}`
          : `${outletName} confirmed your slot.`,
      });
    },
    onError: (error: Error) => {
      toast.error("Request declined", { description: error.message });
    },
    onSettled: () => setBooking(false),
  });

  const fameShort = !!band && (band.fame ?? 0) < (minFameRequired ?? 0);
  const disabled = !band || fameShort || booking || requestMutation.isPending;

  return (
    <Button
      size={size}
      variant={variant}
      className={className}
      disabled={disabled}
      onClick={() => {
        setBooking(true);
        requestMutation.mutate();
      }}
      title={
        !band
          ? "Only band leaders can request media appearances"
          : fameShort
            ? `Requires ${minFameRequired?.toLocaleString()} band fame`
            : undefined
      }
    >
      {requestMutation.isPending ? (
        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
      ) : (
        <Megaphone className="mr-1 h-3 w-3" />
      )}
      {fameShort ? "Fame too low" : label}
    </Button>
  );
}
