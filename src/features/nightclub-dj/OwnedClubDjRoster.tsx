import { useQuery } from "@tanstack/react-query";
import { CalendarClock, Disc3 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { OwnedNightclub } from "@/hooks/useNightclubOwnership";

type OwnedDjSlot = {
  booking_id: string;
  starts_at: string;
  ends_at: string;
  status: string;
  dj_name: string;
  set_name: string;
};

/**
 * A read-only roster; approval decisions and payments must wait for
 * a server-owned booking offer/fee ledger. No browser authorization shortcuts.
 */
export function OwnedClubDjRoster({ club }: { club: OwnedNightclub }) {
  const verified = Boolean(club.verified_purchase_id);
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

  return (
    <Card data-testid="owned-club-dj-roster">
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2 text-lg">
          <Disc3 className="h-5 w-5 text-primary" /> Club DJ bookings
          <Badge variant="outline">Read-only preview</Badge>
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
              View the next scheduled DJ sets at this club. Approvals, residency
              offers and owner-funded fees are not enabled yet.
            </p>
            {isLoading && <p className="text-sm text-muted-foreground">Loading scheduled sets…</p>}
            {isError && <p className="text-sm text-destructive" role="alert">
              Could not load the verified DJ booking roster.
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
                <Badge variant="secondary">{slot.status}</Badge>
              </div>
            ))}
          </>
        )}
      </CardContent>
    </Card>
  );
}
