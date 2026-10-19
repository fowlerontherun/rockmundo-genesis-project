import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarClock, Disc3, Megaphone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { OwnedNightclub } from "@/hooks/useNightclubOwnership";

type PaidPromotion = {
  booking_id: string;
  budget: number;
  attendance_boost_percent: number;
};
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;

type OwnedDjSlot = {
  booking_id: string;
  starts_at: string;
  ends_at: string;
  status: string;
  dj_name: string;
  set_name: string;
};

/**
 * Club roster is read-only except for an independently server-charged,
 * receipt-verified advertising action on a genuinely funded DJ booking.
 */
export function OwnedClubDjRoster({ club }: { club: OwnedNightclub }) {
  const verified = Boolean(club.verified_purchase_id);
  const client = useQueryClient();
  const retries = useRef(new Map<string, string>());
  const [budgets, setBudgets] = useState<Record<string, string>>({});
  const { data: slots = [], isLoading, isError } = useQuery<OwnedDjSlot[]>({
    queryKey: ["owned-club-dj-roster", club.id, club.verified_purchase_id],
    enabled: verified,
    queryFn: async () => {
      // The verified-owner roster was deployed directly; regenerate Supabase types later.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc("get_owned_nightclub_dj_roster", {
        p_owned_club_id: club.id,
      });
      if (error) throw error;
      return (data ?? []) as OwnedDjSlot[];
    },
    refetchInterval: 60_000,
  });

  const { data: promotions = [], isError: promotionsError } = useQuery<PaidPromotion[]>({
    queryKey: ["owned-club-dj-paid-promotions", club.id],
    enabled: verified,
    refetchInterval: 60_000,
    queryFn: async () => {
      // The finance-migration table is newer than the generated database typings.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).from("nightclub_dj_paid_promotions")
        .select("booking_id,budget,attendance_boost_percent")
        .eq("owned_club_id", club.id).order("created_at", { ascending: false }).limit(50);
      if (error) throw error;
      return (data ?? []) as PaidPromotion[];
    },
  });
  const eligibleBudgets = [100, 250, 500].filter(amount => amount <= club.quality_level * 100);
  const promote = useMutation({
    mutationFn: async ({ bookingId, budget }: { bookingId: string; budget: number }) => {
      if (!verified || !eligibleBudgets.includes(budget))
        throw new Error("Verified nightclub ownership and permitted advertising budget required");
      const key = `dj-advert:${club.id}:${bookingId}:${budget}`;
      let requestId = retries.current.get(key);
      if (!requestId) {
        try {
          const saved = sessionStorage.getItem(key);
          if (saved && uuid.test(saved)) requestId = saved;
        } catch { /* Local storage is optional. */ }
      }
      requestId ??= crypto.randomUUID();
      retries.current.set(key, requestId);
      try { sessionStorage.setItem(key, requestId); } catch { /* In-memory retry still works. */ }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc("purchase_nightclub_dj_promotion", {
        p_owned_club_id: club.id, p_booking_id: bookingId,
        p_budget: budget, p_request_id: requestId,
      });
      if (error) throw error;
      if (!data || !uuid.test(data.promotion_id ?? "") ||
          data.booking_id !== bookingId || data.budget !== budget)
        throw new Error("Advertising expense was not confirmed by the server");
      retries.current.delete(key);
      try { sessionStorage.removeItem(key); } catch { /* Best effort. */ }
      return data as { budget: number; boost_percent: number };
    },
    onSuccess: (result) => {
      toast.success(`Spent ${result.budget} advertising your booked DJ set (+${result.boost_percent}% crowd demand, capacity-capped)`);
      void client.invalidateQueries({ queryKey: ["owned-club-dj-paid-promotions", club.id] });
      void client.invalidateQueries({ queryKey: ["profile"] });
      void client.invalidateQueries({ queryKey: ["player-financial-accounts"] });
    },
    onError: (error: unknown) =>
      toast.error(error instanceof Error ? error.message : "Could not purchase DJ advertising"),
  });

  return (
    <Card data-testid="owned-club-dj-roster">
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2 text-lg">
          <Disc3 className="h-5 w-5 text-primary" /> Club DJ bookings
          <Badge variant="outline">Verified bookings</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {!verified ? (
          <p className="text-sm text-muted-foreground">
            This club was registered before verified purchase receipts. DJ owner
            controls require ownership verification before they can be unlocked.
          </p>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">
              Upcoming verified DJ bookings can be promoted using your character's real cash.
              Advertising is a non-refundable expense even if the gig is later cancelled.
              The boost affects verified crowd demand only and never exceeds the club's capacity.
            </p>
            {isLoading && <p className="text-sm text-muted-foreground">Loading scheduled sets…</p>}
            {(isError || promotionsError) && <p className="text-sm text-destructive" role="alert">
              Could not load DJ bookings or advertising records. No spending controls are available until these refresh.
            </p>}
            {!isLoading && !isError && slots.length === 0 && (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <CalendarClock className="h-4 w-4" /> No upcoming DJ bookings.
              </p>
            )}
            {slots.map((slot) => (
              <div key={slot.booking_id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{slot.dj_name}</p>
                  <p className="text-xs text-muted-foreground">{slot.set_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(slot.starts_at).toLocaleString()} – {new Date(slot.ends_at).toLocaleTimeString()}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">{slot.status}</Badge>
                  {promotions.find(ad => ad.booking_id === slot.booking_id) ? (
                    <Badge variant="outline">
                      Promoted: {"$"}{promotions.find(ad => ad.booking_id === slot.booking_id)?.budget}
                      {" · +"}{promotions.find(ad => ad.booking_id === slot.booking_id)?.attendance_boost_percent}% demand
                    </Badge>
                  ) : !isError && !promotionsError &&
                    (slot.status === "booked" || slot.status === "ready") &&
                    new Date(slot.starts_at).getTime() > Date.now() + 3 * 60 * 60_000 &&
                    eligibleBudgets.length > 0 && (
                      <div className="flex items-center gap-1.5">
                        <Select value={budgets[slot.booking_id] ?? "100"}
                          onValueChange={value => setBudgets(current => ({ ...current, [slot.booking_id]: value }))}>
                          <SelectTrigger aria-label="DJ advertising budget" className="w-32 h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {eligibleBudgets.map(amount => (
                              <SelectItem key={amount} value={String(amount)}>{"$"}{amount}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button size="sm" variant="outline" disabled={promote.isPending}
                          onClick={() => promote.mutate({
                            bookingId: slot.booking_id,
                            budget: Number(budgets[slot.booking_id] ?? "100"),
                          })}>
                          <Megaphone className="mr-1 h-3.5 w-3.5" /> Advertise
                        </Button>
                      </div>
                    )}
                </div>
              </div>
            ))}
          </>
        )}
      </CardContent>
    </Card>
  );
}
