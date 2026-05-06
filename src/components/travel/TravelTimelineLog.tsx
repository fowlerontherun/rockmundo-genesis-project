import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  History, Plane, ArrowRight, Clock, MapPin, RefreshCw, XCircle, CheckCircle2, AlertCircle, CalendarClock,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

interface TravelTimelineLogProps {
  /** Filter by a specific tour. If omitted, shows the active player's full travel timeline. */
  tourId?: string;
  /** Filter to a single profile (band member). Defaults to the active player. */
  profileId?: string;
  /** When tourId is set, fetch events for ALL members of the tour (default true). */
  includeAllMembers?: boolean;
  /** Max number of events to display. */
  limit?: number;
  className?: string;
}

interface TimelineEvent {
  id: string;
  profile_id: string;
  user_id: string | null;
  band_id: string | null;
  tour_id: string | null;
  tour_leg_id: string | null;
  from_city_id: string | null;
  to_city_id: string | null;
  event_type: string;
  message: string;
  previous_eta: string | null;
  new_eta: string | null;
  occurred_at: string;
  metadata: Record<string, any>;
  from_city?: { name: string; country: string } | null;
  to_city?: { name: string; country: string } | null;
  profile?: { id: string; username: string | null; display_name: string | null } | null;
}

const EVENT_STYLE: Record<string, { icon: any; color: string; label: string }> = {
  booked: { icon: CalendarClock, color: "text-blue-500", label: "Booked" },
  departed: { icon: Plane, color: "text-primary", label: "Departed" },
  arrived: { icon: CheckCircle2, color: "text-green-500", label: "Arrived" },
  cancelled: { icon: XCircle, color: "text-destructive", label: "Cancelled" },
  rescheduled: { icon: RefreshCw, color: "text-amber-500", label: "Rescheduled" },
  eta_updated: { icon: Clock, color: "text-amber-500", label: "ETA updated" },
  rejoined: { icon: RefreshCw, color: "text-primary", label: "Rejoined" },
  status_changed: { icon: AlertCircle, color: "text-muted-foreground", label: "Status" },
  created: { icon: CalendarClock, color: "text-muted-foreground", label: "Created" },
};

const formatEta = (iso: string | null) => (iso ? format(new Date(iso), "MMM d, HH:mm") : "—");

export const TravelTimelineLog = ({
  tourId,
  profileId,
  includeAllMembers = true,
  limit = 100,
  className,
}: TravelTimelineLogProps) => {
  const { data: events, isLoading } = useQuery({
    queryKey: ["travel-timeline", { tourId, profileId, includeAllMembers, limit }],
    queryFn: async () => {
      let query = supabase
        .from("travel_timeline_events")
        .select(
          `id, profile_id, user_id, band_id, tour_id, tour_leg_id, from_city_id, to_city_id,
           event_type, message, previous_eta, new_eta, occurred_at, metadata,
           from_city:from_city_id(name, country),
           to_city:to_city_id(name, country),
           profile:profile_id(id, username, display_name)` as any,
        )
        .order("occurred_at", { ascending: false })
        .limit(limit);

      if (tourId) query = query.eq("tour_id", tourId);
      if (profileId && (!tourId || !includeAllMembers)) {
        query = query.eq("profile_id", profileId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as unknown as TimelineEvent[];
    },
    staleTime: 15 * 1000,
  });

  // Group by member when showing tour-wide timeline
  const grouped = (() => {
    if (!events) return [] as { profileId: string; name: string; events: TimelineEvent[] }[];
    if (!tourId || !includeAllMembers) {
      return [
        {
          profileId: profileId ?? "self",
          name: "Travel timeline",
          events,
        },
      ];
    }
    const map = new Map<string, { profileId: string; name: string; events: TimelineEvent[] }>();
    for (const e of events) {
      const key = e.profile_id;
      const name = e.profile?.display_name || e.profile?.username || "Member";
      if (!map.has(key)) map.set(key, { profileId: key, name, events: [] });
      map.get(key)!.events.push(e);
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  })();

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <History className="w-4 h-4" />
          Travel Timeline
        </CardTitle>
        <CardDescription className="text-xs">
          Every leg change, catch-up action and ETA update for {tourId ? "this tour" : "your travel"}.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        {isLoading ? (
          <div className="text-xs text-muted-foreground py-4 text-center">Loading timeline…</div>
        ) : grouped.length === 0 || grouped.every(g => g.events.length === 0) ? (
          <div className="text-xs text-muted-foreground py-4 text-center">
            No travel events recorded yet.
          </div>
        ) : (
          <ScrollArea className="max-h-[420px] pr-2">
            <div className="space-y-4">
              {grouped.map(group => (
                <div key={group.profileId}>
                  {tourId && includeAllMembers && (
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
                      {group.name}
                    </div>
                  )}
                  <ol className="relative border-l border-border ml-2 space-y-2">
                    {group.events.map(ev => {
                      const style = EVENT_STYLE[ev.event_type] ?? EVENT_STYLE.status_changed;
                      const Icon = style.icon;
                      const from = ev.from_city ? `${ev.from_city.name}` : null;
                      const to = ev.to_city ? `${ev.to_city.name}` : null;
                      const etaChanged =
                        ev.previous_eta && ev.new_eta && ev.previous_eta !== ev.new_eta;
                      return (
                        <li key={ev.id} className="ml-3 pl-2">
                          <span
                            className={`absolute -left-[7px] flex h-3 w-3 items-center justify-center rounded-full bg-background ring-2 ring-border`}
                          >
                            <Icon className={`w-2.5 h-2.5 ${style.color}`} />
                          </span>
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                              {style.label}
                            </Badge>
                            <span className="text-[11px] text-muted-foreground">
                              {format(new Date(ev.occurred_at), "MMM d, HH:mm")}{" "}
                              · {formatDistanceToNow(new Date(ev.occurred_at), { addSuffix: true })}
                            </span>
                          </div>
                          <div className="text-xs mt-0.5 text-foreground">{ev.message}</div>
                          {(from || to) && (
                            <div className="flex items-center gap-1 text-[11px] text-muted-foreground mt-0.5">
                              <MapPin className="w-3 h-3" />
                              <span>{from ?? "?"}</span>
                              <ArrowRight className="w-3 h-3" />
                              <span>{to ?? "?"}</span>
                              {ev.metadata?.transport_type && (
                                <span className="ml-1">· {String(ev.metadata.transport_type).replace(/_/g, " ")}</span>
                              )}
                            </div>
                          )}
                          {etaChanged && (
                            <div className="text-[11px] text-amber-600 dark:text-amber-400 mt-0.5">
                              ETA: {formatEta(ev.previous_eta)} → {formatEta(ev.new_eta)}
                            </div>
                          )}
                          {!etaChanged && ev.new_eta && ev.event_type !== "arrived" && (
                            <div className="text-[11px] text-muted-foreground mt-0.5">
                              ETA: {formatEta(ev.new_eta)}
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ol>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
};
