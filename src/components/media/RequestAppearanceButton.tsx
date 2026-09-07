import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNowStrict } from "date-fns";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Megaphone, Loader2, Clock3, CheckCircle2 } from "lucide-react";
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

interface AppearanceRequestState {
  openOffer: { id: string; status: string; proposed_date: string | null } | null;
  cooldownExpiresAt: string | null;
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

  const requestStateQueryKey = ["media-appearance-request-state", band?.id, mediaType, outletId, showId ?? null];
  const { data: requestState } = useQuery<AppearanceRequestState>({
    queryKey: requestStateQueryKey,
    queryFn: async () => {
      if (!band?.id) return { openOffer: null, cooldownExpiresAt: null };

      let offerQuery = (supabase as any)
        .from("pr_media_offers")
        .select("id, status, proposed_date")
        .eq("band_id", band.id)
        .eq("media_type", mediaType)
        .eq("media_outlet_id", outletId)
        .in("status", ["pending", "accepted"])
        .order("created_at", { ascending: false })
        .limit(1);

      if (showId) offerQuery = offerQuery.eq("show_id", showId);

      const [offerResult, cooldownResult] = await Promise.all([
        offerQuery.maybeSingle(),
        (supabase as any)
          .from("band_media_cooldowns")
          .select("cooldown_expires_at")
          .eq("band_id", band.id)
          .eq("media_type", mediaType)
          .eq("outlet_id", outletId)
          .gt("cooldown_expires_at", new Date().toISOString())
          .order("cooldown_expires_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      if (offerResult.error) throw offerResult.error;
      if (cooldownResult.error) throw cooldownResult.error;

      return {
        openOffer: offerResult.data ?? null,
        cooldownExpiresAt: cooldownResult.data?.cooldown_expires_at ?? null,
      };
    },
    enabled: !!band?.id && !!outletId,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
  });

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

      // Immediately confirm the booking using the same band-wide conflict checks as inbound PR offers.
      const { data: result, error: fnError } = await supabase.functions.invoke("respond-pr-offer", {
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
      queryClient.invalidateQueries({ queryKey: ["media-appearance-request-state"] });
      toast.success("Appearance booked", {
        description: result?.scheduledFor
          ? `${outletName} — ${new Date(result.scheduledFor).toLocaleString()}`
          : `${outletName} confirmed your slot.`,
      });
    },
    onError: (error: Error) => {
      queryClient.invalidateQueries({ queryKey: ["media-appearance-request-state"] });
      toast.error("Request declined", { description: error.message });
    },
    onSettled: () => setBooking(false),
  });

  const fameShort = !!band && (band.fame ?? 0) < (minFameRequired ?? 0);
  const openOffer = requestState?.openOffer ?? null;
  const cooldownExpiresAt = requestState?.cooldownExpiresAt
    ? new Date(requestState.cooldownExpiresAt)
    : null;
  const onCooldown = !!cooldownExpiresAt && cooldownExpiresAt.getTime() > Date.now();
  const disabled = !band || fameShort || !!openOffer || onCooldown || booking || requestMutation.isPending;

  const buttonText = fameShort
    ? "Fame too low"
    : openOffer?.status === "accepted"
      ? "Appearance booked"
      : openOffer?.status === "pending"
        ? "Request pending"
        : onCooldown && cooldownExpiresAt
          ? `Cooldown ${formatDistanceToNowStrict(cooldownExpiresAt)}`
          : label;

  const title = !band
    ? "Only band leaders can request media appearances"
    : fameShort
      ? `Requires ${minFameRequired?.toLocaleString()} band fame`
      : openOffer?.status === "accepted"
        ? "You already have an appearance booked with this outlet"
        : openOffer?.status === "pending"
          ? "You already have a request pending with this outlet"
          : onCooldown && cooldownExpiresAt
            ? `You can request this outlet again ${formatDistanceToNowStrict(cooldownExpiresAt, { addSuffix: true })}`
            : undefined;

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
      title={title}
    >
      {requestMutation.isPending ? (
        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
      ) : openOffer?.status === "accepted" ? (
        <CheckCircle2 className="mr-1 h-3 w-3" />
      ) : onCooldown || openOffer?.status === "pending" ? (
        <Clock3 className="mr-1 h-3 w-3" />
      ) : (
        <Megaphone className="mr-1 h-3 w-3" />
      )}
      {buttonText}
    </Button>
  );
}
