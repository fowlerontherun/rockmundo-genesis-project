import { useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DollarSign } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type Offer = { id: string; application_id: string; fee: number; status: string; expires_at: string };
const isUuid = /^[a-f0-9-]{36}$/i;
const fundedBookingReleased = import.meta.env.VITE_DJ_SCHEDULED_BOOKINGS_ENABLED === "true" &&
  import.meta.env.VITE_DJ_FUNDED_OWNER_BOOKINGS_ENABLED === "true";

/** DJ can agree to a funded *proposal*. This does not confirm a booking or pay a DJ. */
export function DjFundedOffers({ clubId, profileId }: { clubId: string; profileId: string }) {
  const queryClient = useQueryClient();
  const retries = useRef(new Map<string, string>());
  const { data: applications = [] } = useQuery<{ id: string }[]>({
    queryKey: ["dj-offer-application-ids", clubId, profileId],
    enabled: Boolean(clubId && profileId),
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).from("dj_club_applications")
        .select("id").eq("club_id", clubId).eq("profile_id", profileId).limit(50);
      if (error) throw error;
      return (data ?? []) as { id: string }[];
    },
  });
  const { data: offers = [], isError } = useQuery<Offer[]>({
    queryKey: ["dj-funded-offers-for-club", clubId, profileId, applications.map(a => a.id).join(",")],
    enabled: applications.length > 0,
    refetchInterval: 60_000,
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).from("nightclub_dj_funded_offers")
        .select("id,application_id,fee,status,expires_at")
        .eq("dj_profile_id", profileId).in("application_id", applications.map(a => a.id))
        .order("created_at", { ascending: false }).limit(30);
      if (error) throw error;
      return (data ?? []) as Offer[];
    },
  });
  const decide = useMutation({
    mutationFn: async ({ offerId, action }: { offerId: string; action: "accept" | "decline" | "expire" }) => {
      const key = `dj-fee-decision:${profileId}:${offerId}:${action}`;
      let id = retries.current.get(key);
      if (!id) {
        try { const persisted = sessionStorage.getItem(key); if (persisted && isUuid.test(persisted)) id = persisted; }
        catch { /* Best effort. */ }
      }
      id ??= crypto.randomUUID();
      retries.current.set(key, id);
      try { sessionStorage.setItem(key, id); } catch { /* Best effort. */ }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc("decide_nightclub_dj_offer", {
        p_offer_id: offerId, p_action: action, p_request_id: id,
      });
      if (error) throw error;
      const expectedStatus = action === "accept" ? "accepted" : action === "decline" ? "declined" : "expired";
      if (!data || data.offer_id !== offerId || data.status !== expectedStatus) {
        throw new Error("DJ offer decision not confirmed by the server");
      }
      retries.current.delete(key);
      try { sessionStorage.removeItem(key); } catch { /* Best effort. */ }
    },
    onSuccess: (_, vars) => {
      toast.success(vars.action === "accept"
        ? "Offer terms acknowledged. No DJ gig or payment is scheduled yet."
        : "Offer closed; the owner's escrowed money is refunded");
      void queryClient.invalidateQueries({ queryKey: ["dj-funded-offers-for-club", clubId, profileId] });
    },
    onError: (error: unknown) =>
      toast.error(error instanceof Error ? error.message : "Could not respond to DJ offer"),
  });
  const confirm = useMutation({
    mutationFn: async (offerId: string) => {
      if (!fundedBookingReleased) throw new Error("Funded DJ booking release is not yet enabled");
      const key = `dj-funded-confirm:${profileId}:${offerId}`;
      let id = retries.current.get(key);
      if (!id) {
        try { const prior = sessionStorage.getItem(key); if (prior && isUuid.test(prior)) id = prior; }
        catch { /* Keep the request ID in memory if storage is unavailable. */ }
      }
      id ??= crypto.randomUUID();
      retries.current.set(key, id);
      try { sessionStorage.setItem(key, id); } catch { /* Best effort. */ }
      const { data, error } = await supabase.functions.invoke("dj-booking-action", {
        body: { action: "confirm_funded", offerId, requestId: id },
      });
      if (error || data?.error) {
        let detail = typeof data?.error === "string" ? data.error : error?.message ?? "Booking failed";
        const response = (error as { context?: Response } | undefined)?.context;
        if (response?.json) {
          try {
            const payload = await response.json() as { error?: string };
            detail = payload.error ?? detail;
          } catch { /* The SDK error still has the failure details. */ }
        }
        throw new Error(detail);
      }
      if (!isUuid.test(data?.id ?? "")) throw new Error("Funded DJ booking confirmation was not verified");
      retries.current.delete(key);
      try { sessionStorage.removeItem(key); } catch { /* Best effort. */ }
      return data.id as string;
    },
    onSuccess: () => {
      toast.success("Funded DJ gig confirmed. Check your Schedule.");
      void queryClient.invalidateQueries({ queryKey: ["dj-funded-offers-for-club", clubId, profileId] });
      void queryClient.invalidateQueries({ queryKey: ["dj-bookings", profileId] });
      void queryClient.invalidateQueries({ queryKey: ["scheduled-activities"] });
      void queryClient.invalidateQueries({ queryKey: ["player-schedule"] });
    },
    onError: (error: unknown) => toast.error(error instanceof Error ? error.message : "Could not confirm funded DJ set"),
  });

  if (applications.length === 0 || (offers.length === 0 && !isError)) return null;

  return <Card data-testid="dj-escrow-offers">
    <CardHeader><CardTitle className="flex items-center gap-2 text-lg">
      <DollarSign className="h-5 w-5 text-primary" /> Owner-funded DJ offers
    </CardTitle></CardHeader>
    <CardContent className="space-y-3">
      <p className="text-xs text-muted-foreground">
        The nightclub owner has set cash aside for your proposed set. Accepting means you agree to the
        proposed terms, <strong>not</strong> that a gig is booked, wages are paid, or an event is added
        to your schedule. Until confirmed as a booking, offers expire and return the fee to the owner. Funded gig confirmation is available only when both server release checks are enabled.
      </p>
      {isError && <p className="text-sm text-destructive" role="alert">Offer details could not be loaded.</p>}
      {offers.map(o => <div key={o.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3">
        <div>
          <p className="font-medium">{"$"}{o.fee} proposed DJ fee</p>
          <p className="text-xs text-muted-foreground">Offer expires {new Date(o.expires_at).toLocaleString()}</p>
          <Badge variant="outline">{o.status === "accepted" ? "Terms accepted · not booked" : o.status}</Badge>
        </div>
        {o.status === "accepted" && fundedBookingReleased &&
          new Date(o.expires_at).getTime() > Date.now() &&
          <Button size="sm" disabled={confirm.isPending}
            onClick={() => confirm.mutate(o.id)}>Confirm funded DJ gig</Button>}
        {o.status === "booked" && <p className="text-xs text-muted-foreground">
          Scheduled and funded. Start your set from the Scheduled DJ bookings panel when due.
        </p>}
        {o.status === "offered" && new Date(o.expires_at).getTime() > Date.now() &&
          <div className="flex gap-2">
            <Button size="sm" disabled={decide.isPending}
              onClick={() => decide.mutate({ offerId: o.id, action: "accept" })}>Accept terms</Button>
            <Button size="sm" variant="outline" disabled={decide.isPending}
              onClick={() => decide.mutate({ offerId: o.id, action: "decline" })}>Decline & refund</Button>
          </div>}
        {["offered", "accepted"].includes(o.status) &&
          new Date(o.expires_at).getTime() <= Date.now() &&
          <Button size="sm" variant="outline" disabled={decide.isPending}
            onClick={() => decide.mutate({ offerId: o.id, action: "expire" })}>
            Return expired fee
          </Button>}
      </div>)}
    </CardContent>
  </Card>;
}
