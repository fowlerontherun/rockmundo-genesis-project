import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format, formatDistanceToNow } from "date-fns";
import {
  MapPin, Plane, Train, Bus, Ship, CheckCircle2, AlertTriangle,
  Clock, HelpCircle, Loader2, Crown,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  tourId: string;
  bandId: string;
}

type SyncHealth = "in_sync" | "in_transit" | "late" | "desynced" | "no_assignment" | "completed";

interface MemberRow {
  profileId: string;
  displayName: string;
  role: string | null;
  isLeader: boolean;
  currentCity: { name: string; country: string } | null;
  assignedLeg: {
    id: string;
    departure: string;
    arrival: string;
    mode: string | null;
    status: string;
    from: string;
    to: string;
  } | null;
  travelStatus: string | null;
  travelEta: string | null;
  syncHealth: SyncHealth;
  syncReason: string;
}

const transportIcon = (mode: string | null | undefined) => {
  switch (mode) {
    case "plane":
    case "private_jet": return <Plane className="h-3 w-3" />;
    case "train": return <Train className="h-3 w-3" />;
    case "ship": return <Ship className="h-3 w-3" />;
    default: return <Bus className="h-3 w-3" />;
  }
};

const HEALTH_META: Record<SyncHealth, { label: string; cls: string; icon: any }> = {
  in_sync:        { label: "In sync",        cls: "bg-green-500/15 text-green-600 border-green-500/30",   icon: CheckCircle2 },
  in_transit:     { label: "In transit",     cls: "bg-blue-500/15 text-blue-600 border-blue-500/30",      icon: Clock },
  late:           { label: "Running late",   cls: "bg-amber-500/15 text-amber-600 border-amber-500/30",   icon: AlertTriangle },
  desynced:       { label: "Desynced",       cls: "bg-destructive/15 text-destructive border-destructive/30", icon: AlertTriangle },
  no_assignment:  { label: "No leg assigned", cls: "bg-muted text-muted-foreground border-border",        icon: HelpCircle },
  completed:      { label: "Tour complete",  cls: "bg-muted text-muted-foreground border-border",         icon: CheckCircle2 },
};

export const TourMemberSyncStatus = ({ tourId, bandId }: Props) => {
  const { data: rows, isLoading } = useQuery({
    queryKey: ["tour-member-sync", tourId, bandId],
    queryFn: async (): Promise<MemberRow[]> => {
      // 1) Active band members (and their profiles)
      const { data: members } = await supabase
        .from("band_members")
        .select("profile_id, role, can_be_leader, instrument_role")
        .eq("band_id", bandId)
        .eq("member_status", "active");
      const profileIds = (members || []).map((m: any) => m.profile_id).filter(Boolean);
      if (profileIds.length === 0) return [];

      const [profilesRes, legsRes, historyRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, display_name, username, current_city_id, is_traveling, travel_arrives_at")
          .in("id", profileIds),
        (supabase as any)
          .from("tour_travel_legs")
          .select("id, from_city_id, to_city_id, travel_mode, departure_date, arrival_date, status")
          .eq("tour_id", tourId)
          .neq("status", "cancelled")
          .order("departure_date", { ascending: true }),
        supabase
          .from("player_travel_history")
          .select("profile_id, tour_leg_id, status, arrival_time, departure_time")
          .in("profile_id", profileIds),
      ]);

      const profiles = profilesRes.data || [];
      const legs = (legsRes.data as any[]) || [];
      const history = historyRes.data || [];

      // Collect city IDs we need to resolve (current cities + leg endpoints)
      const cityIds = new Set<string>();
      profiles.forEach((p: any) => p.current_city_id && cityIds.add(p.current_city_id));
      legs.forEach((l: any) => {
        if (l.from_city_id) cityIds.add(l.from_city_id);
        if (l.to_city_id) cityIds.add(l.to_city_id);
      });
      const { data: cities } = cityIds.size
        ? await supabase.from("cities").select("id, name, country").in("id", Array.from(cityIds))
        : { data: [] as any[] };
      const cityById = new Map((cities || []).map((c: any) => [c.id, c]));

      const now = Date.now();

      return (members || []).map((m: any) => {
        const profile = profiles.find((p: any) => p.id === m.profile_id);
        const displayName = profile?.display_name || profile?.username || "Unknown";
        const currentCityRow = profile?.current_city_id ? cityById.get(profile.current_city_id) : null;

        // Pick the most relevant leg: in-transit window, else next upcoming, else last
        const inTransitLeg = legs.find((l: any) =>
          new Date(l.departure_date).getTime() <= now &&
          new Date(l.arrival_date).getTime() >= now,
        );
        const upcomingLeg = legs.find((l: any) => new Date(l.departure_date).getTime() > now);
        const lastLeg = legs.length ? legs[legs.length - 1] : null;
        const leg = inTransitLeg || upcomingLeg || lastLeg;

        const fromCity = leg ? cityById.get(leg.from_city_id) : null;
        const toCity = leg ? cityById.get(leg.to_city_id) : null;

        // Player history for this leg (if any)
        const historyForLeg = leg
          ? history.find((h: any) => h.profile_id === m.profile_id && h.tour_leg_id === leg.id)
          : null;

        // Compute sync health
        let syncHealth: SyncHealth = "no_assignment";
        let syncReason = "No travel leg currently assigned to this member.";
        if (!leg) {
          syncHealth = "no_assignment";
        } else if (leg === lastLeg && new Date(leg.arrival_date).getTime() < now && !inTransitLeg && !upcomingLeg) {
          syncHealth = "completed";
          syncReason = "Tour travel finished.";
        } else if (inTransitLeg) {
          if (historyForLeg && (historyForLeg.status === "in_progress" || historyForLeg.status === "completed")) {
            syncHealth = "in_transit";
            syncReason = `Aboard ${leg.travel_mode || "transport"} until ${format(new Date(leg.arrival_date), "MMM d, h:mm a")}.`;
          } else {
            syncHealth = "desynced";
            syncReason = "Pickup missed — not on the tour transport. Auto-rejoin should kick in shortly.";
          }
        } else if (upcomingLeg) {
          // upcoming: check if their current city matches the leg's origin
          if (profile?.current_city_id && profile.current_city_id !== leg.from_city_id) {
            const departsIn = new Date(leg.departure_date).getTime() - now;
            if (departsIn < 6 * 3600 * 1000) {
              syncHealth = "late";
              syncReason = `In ${currentCityRow?.name || "another city"} but pickup is in ${fromCity?.name || "?"} — needs to catch up.`;
            } else {
              syncHealth = "in_sync";
              syncReason = `Heads up: pickup is in ${fromCity?.name || "?"}, currently in ${currentCityRow?.name || "another city"}.`;
            }
          } else {
            syncHealth = "in_sync";
            syncReason = `Ready for pickup in ${fromCity?.name || "?"} at ${format(new Date(leg.departure_date), "MMM d, h:mm a")}.`;
          }
        }

        return {
          profileId: m.profile_id,
          displayName,
          role: m.instrument_role || m.role,
          isLeader: !!m.can_be_leader,
          currentCity: currentCityRow ? { name: (currentCityRow as any).name, country: (currentCityRow as any).country } : null,
          assignedLeg: leg ? {
            id: leg.id,
            departure: leg.departure_date,
            arrival: leg.arrival_date,
            mode: leg.travel_mode,
            status: leg.status,
            from: fromCity ? `${(fromCity as any).name}` : "—",
            to: toCity ? `${(toCity as any).name}` : "—",
          } : null,
          travelStatus: profile?.is_traveling ? "traveling" : null,
          travelEta: profile?.travel_arrives_at ?? null,
          syncHealth,
          syncReason,
        };
      });
    },
    enabled: !!tourId && !!bandId,
    refetchInterval: 60_000,
  });

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <MapPin className="h-4 w-4" /> Member Sync Status
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 ml-auto">live</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" /> Loading member status…
          </div>
        ) : !rows || rows.length === 0 ? (
          <p className="text-xs text-muted-foreground">No active band members on this tour.</p>
        ) : (
          rows.map((r) => {
            const meta = HEALTH_META[r.syncHealth];
            const Icon = meta.icon;
            return (
              <div
                key={r.profileId}
                className="rounded-lg border border-border bg-card/40 p-2.5 space-y-1.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    {r.isLeader && <Crown className="h-3 w-3 text-yellow-500 shrink-0" />}
                    <span className="font-medium text-sm truncate">{r.displayName}</span>
                    {r.role && (
                      <span className="text-[10px] text-muted-foreground capitalize truncate">
                        · {r.role}
                      </span>
                    )}
                  </div>
                  <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 gap-1", meta.cls)}>
                    <Icon className="h-3 w-3" />
                    {meta.label}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <p className="text-muted-foreground">Current location</p>
                    <p className="font-medium truncate">
                      {r.currentCity ? `${r.currentCity.name}, ${r.currentCity.country}` : "Unknown"}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Assigned leg</p>
                    {r.assignedLeg ? (
                      <p className="font-medium flex items-center gap-1 truncate">
                        {transportIcon(r.assignedLeg.mode)}
                        <span className="truncate">{r.assignedLeg.from} → {r.assignedLeg.to}</span>
                      </p>
                    ) : (
                      <p className="font-medium text-muted-foreground">—</p>
                    )}
                  </div>
                  <div>
                    <p className="text-muted-foreground">ETA</p>
                    <p className="font-medium tabular-nums">
                      {r.assignedLeg
                        ? `${format(new Date(r.assignedLeg.arrival), "MMM d, HH:mm")} · ${formatDistanceToNow(new Date(r.assignedLeg.arrival), { addSuffix: true })}`
                        : r.travelEta
                          ? formatDistanceToNow(new Date(r.travelEta), { addSuffix: true })
                          : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Departure</p>
                    <p className="font-medium tabular-nums">
                      {r.assignedLeg
                        ? format(new Date(r.assignedLeg.departure), "MMM d, HH:mm")
                        : "—"}
                    </p>
                  </div>
                </div>

                <p className="text-[11px] text-muted-foreground italic">{r.syncReason}</p>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
};
