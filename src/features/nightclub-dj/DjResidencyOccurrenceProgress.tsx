import { useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";

export type ResidencyOccurrencePlan = {
  id: string;
  status: string;
  planned_starts_at: string[];
  venue_timezone: string;
  proposed_fee: number;
  dj_profile_id?: string;
};
type Occurrence = { residency_id: string; occurrence_number: number; application_id: string };
type HeldOffer = { id: string; application_id: string; fee: number; status: string; booking_id: string | null; expires_at: string };
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;

/** Each date needs its own prepared application, full owner escrow and canonical DJ booking. */
export function DjResidencyOccurrenceProgress({
  plan, role, ownedClubId,
}: {
  plan: ResidencyOccurrencePlan;
  role: "owner" | "dj";
  ownedClubId?: string;
}) {
  const cache = useQueryClient();
  const retryIds = useRef(new Map<string, string>());
  const { data: slots = [], isError: slotsError } = useQuery<Occurrence[]>({
    queryKey: ["dj-residency-prepared-slots", plan.id],
    queryFn: async () => {
      // Generated types lag behind live versioned Supabase migrations.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).from("nightclub_dj_residency_occurrences")
        .select("residency_id,occurrence_number,application_id").eq("residency_id", plan.id);
      if (error) throw error;
      return (data ?? []) as Occurrence[];
    },
  });
  const applicationIds = slots.map(slot => slot.application_id).join(",");
  const { data: offers = [], isError: offersError } = useQuery<HeldOffer[]>({
    queryKey: ["dj-residency-slot-offers", plan.id, applicationIds],
    enabled: slots.length > 0,
    refetchInterval: 60_000,
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).from("nightclub_dj_funded_offers")
        .select("id,application_id,fee,status,booking_id,expires_at")
        .in("application_id", slots.map(slot => slot.application_id));
      if (error) throw error;
      return (data ?? []) as HeldOffer[];
    },
  });
  function getRequestId(key: string) {
    let value = retryIds.current.get(key);
    if (!value) {
      try {
        const stored = sessionStorage.getItem(key);
        if (stored && uuid.test(stored)) value = stored;
      } catch { /* Storage is optional. */ }
    }
    value ??= crypto.randomUUID();
    retryIds.current.set(key, value);
    try { sessionStorage.setItem(key, value); } catch { /* In-memory fallback remains. */ }
    return value;
  }
  function clearRequest(key: string) {
    retryIds.current.delete(key);
    try { sessionStorage.removeItem(key); } catch { /* Best effort. */ }
  }
  function refresh() {
    void cache.invalidateQueries({ queryKey: ["dj-residency-prepared-slots", plan.id] });
    void cache.invalidateQueries({ queryKey: ["dj-residency-slot-offers", plan.id] });
    void cache.invalidateQueries({ queryKey: ["nightclub-dj-funded-offers"] });
    void cache.invalidateQueries({ queryKey: ["dj-funded-offers-for-club"] });
    void cache.invalidateQueries({ queryKey: ["player-financial-accounts"] });
    void cache.invalidateQueries({ queryKey: ["profile"] });
  }
  const prepare = useMutation({
    mutationFn: async (number: number) => {
      if (plan.status !== "agreed" || role !== "dj") throw new Error("Signed DJ residency required");
      const key = `dj-residency-prepare:${plan.id}:${number}`;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc("prepare_nightclub_dj_residency_occurrence", {
        p_residency_id: plan.id, p_occurrence_number: number, p_request_id: getRequestId(key),
      });
      if (error) throw error;
      if (typeof data !== "string" || !uuid.test(data)) throw new Error("Residency slot preparation was not confirmed");
      clearRequest(key);
    },
    onSuccess: () => {
      toast.success("Resident DJ date prepared. Owner funding is required before booking.");
      refresh();
    },
    onError: (error: unknown) => toast.error(error instanceof Error ? error.message : "Could not prepare resident DJ date"),
  });
  const fund = useMutation({
    mutationFn: async (applicationId: string) => {
      if (plan.status !== "agreed" || role !== "owner" || !ownedClubId)
        throw new Error("Current verified club owner required");
      const key = `dj-residency-fund:${plan.id}:${applicationId}`;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc("fund_nightclub_dj_offer", {
        p_owned_club_id: ownedClubId, p_application_id: applicationId,
        p_fee: plan.proposed_fee, p_request_id: getRequestId(key),
      });
      if (error) throw error;
      if (!data || typeof data.offer_id !== "string" || !uuid.test(data.offer_id) ||
          data.fee !== plan.proposed_fee) throw new Error("Per-set escrow was not confirmed");
      clearRequest(key);
    },
    onSuccess: () => {
      toast.success("One resident show funded. The DJ must accept and confirm its booking.");
      refresh();
    },
    onError: (error: unknown) => toast.error(error instanceof Error ? error.message : "Could not fund resident DJ date"),
  });
  if (!plan.planned_starts_at.length) return null;
  return <div className="space-y-2" data-testid="dj-residency-occurrences">
    <p className="text-xs font-medium">Individual show funding and booking</p>
    {(slotsError || offersError) && <p className="text-xs text-destructive" role="alert">
      Could not load current show funding. Refresh before making a payment.
    </p>}
    {plan.planned_starts_at.map((start, index) => {
      const number = index + 1;
      const found = slots.find(slot => slot.occurrence_number === number);
      const offer = offers.find(item => item.application_id === found?.application_id);
      const ms = Date.parse(start);
      const inPreparationWindow = Number.isFinite(ms) && ms > Date.now() + 90 * 60_000 &&
        ms <= Date.now() + 14 * 86400_000;
      const state = offer
        ? offer.status === "booked" ? "Booked in Schedule"
          : offer.status === "settled" ? "Completed and paid"
          : offer.status === "accepted" ? "Accepted · confirm in DJ offers"
          : offer.status === "offered" ? "Fee held · DJ response needed"
          : `Offer ${offer.status}`
        : found ? "Prepared · awaiting owner funding" : "Not prepared";
      return <div key={start} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2">
        <div className="space-y-0.5">
          <p className="text-xs font-medium">
            Set {number} · {new Intl.DateTimeFormat(undefined, {
              timeZone: plan.venue_timezone, dateStyle: "medium", timeStyle: "short",
            }).format(new Date(start))}
          </p>
          <Badge variant="outline">{state}</Badge>
          {offer && <p className="text-xs text-muted-foreground">{"$"}{offer.fee} · {offer.booking_id ? "Canonical booking linked" : "No confirmed booking"}</p>}
        </div>
        {!slotsError && !offersError && role === "dj" && plan.status === "agreed" && !found && inPreparationWindow &&
          <Button size="sm" variant="outline" disabled={prepare.isPending}
            onClick={() => prepare.mutate(number)}>
            {prepare.isPending && <Loader2 className="mr-1 h-3 w-3 animate-spin" />} Prepare date
          </Button>}
        {!slotsError && !offersError && role === "owner" && plan.status === "agreed" && found && !offer &&
          inPreparationWindow && <Button size="sm" disabled={fund.isPending}
          onClick={() => fund.mutate(found.application_id)}>
            {fund.isPending && <Loader2 className="mr-1 h-3 w-3 animate-spin" />} Hold {"$"}{plan.proposed_fee}
          </Button>}
      </div>;
    })}
    <p className="text-xs text-muted-foreground">
      Preparing a date does not reserve the stage. Every show needs its own held fee,
      DJ acceptance and dual-gated confirmed booking. Ending the residency does not cancel existing gigs.
    </p>
  </div>;
}
