import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { asAny } from "@/lib/type-helpers";
import { useOptionalGameData } from "@/hooks/useGameData";
import { usePlayerChildren } from "@/hooks/useChildPlanning";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Baby, Heart, BookOpen, Utensils, Moon, Smile, FileText, Clock, ArrowLeft, Filter } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { useState } from "react";

type TimelineItem = {
  id: string;
  at: string;
  kind: "request" | "interaction";
  childId?: string;
  childName?: string;
  eventType: string;
  resultingStatus?: string | null;
  note?: string | null;
  pathway?: string;
};

const interactionIcon = (type: string) => {
  switch (type) {
    case "feed": return Utensils;
    case "play": return Smile;
    case "teach_skill":
    case "teach": return BookOpen;
    case "nap":
    case "sleep": return Moon;
    case "affection":
    case "hug": return Heart;
    default: return FileText;
  }
};

const requestColor = (type: string) => {
  if (type.includes("accepted") || type === "child_arrived") return "text-social-loyalty";
  if (type.includes("denied") || type.includes("rejected")) return "text-destructive";
  return "text-muted-foreground";
};

export default function FamilyTimeline() {
  const gameData = useOptionalGameData();
  const profileId = gameData?.profile?.id;
  const { data: children = [] } = usePlayerChildren(profileId);

  const childIds = useMemo(() => children.map(c => c.id), [children]);
  const childRequestIds = useMemo(
    () => children.map(c => c.child_request_id).filter((x): x is string => !!x),
    [children],
  );

  // Pull all child_request_events for any request connected to this player
  const { data: requestEvents = [] } = useQuery({
    queryKey: ["family-timeline-requests", profileId],
    enabled: !!profileId,
    queryFn: async () => {
      if (!profileId) return [];
      // Get every request the player is a parent of
      const { data: requests } = await supabase
        .from(asAny("child_requests"))
        .select("id, pathway")
        .or(`parent_a_id.eq.${profileId},parent_b_id.eq.${profileId}`);
      const reqRows = (requests ?? []) as any[];
      if (reqRows.length === 0) return [];
      const ids = reqRows.map(r => r.id);
      const pathwayById = new Map(reqRows.map(r => [r.id, r.pathway]));

      const { data: events } = await supabase
        .from(asAny("child_request_events"))
        .select("*")
        .in("request_id", ids)
        .order("created_at", { ascending: false });

      return ((events ?? []) as any[]).map(ev => ({ ...ev, pathway: pathwayById.get(ev.request_id) }));
    },
  });

  const { data: interactions = [] } = useQuery({
    queryKey: ["family-timeline-interactions", childIds.join(",")],
    enabled: childIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from(asAny("child_interactions"))
        .select("*")
        .in("child_id", childIds)
        .order("created_at", { ascending: false })
        .limit(500);
      return (data ?? []) as any[];
    },
  });

  const childById = useMemo(() => {
    const m = new Map<string, { name: string; surname: string }>();
    for (const c of children) m.set(c.id, { name: c.name, surname: c.surname });
    return m;
  }, [children]);

  const [filter, setFilter] = useState<"all" | "adoption" | "interactions" | "milestones">("all");

  const items: TimelineItem[] = useMemo(() => {
    const reqItems: TimelineItem[] = requestEvents.map((ev: any) => ({
      id: `req-${ev.id}`,
      at: ev.created_at,
      kind: "request",
      eventType: ev.event_type,
      resultingStatus: ev.resulting_status,
      note: ev.note,
      pathway: ev.pathway,
    }));
    const intItems: TimelineItem[] = interactions.map((ev: any) => {
      const child = childById.get(ev.child_id);
      return {
        id: `int-${ev.id}`,
        at: ev.created_at,
        kind: "interaction",
        childId: ev.child_id,
        childName: child ? `${child.name} ${child.surname}` : "Child",
        eventType: ev.interaction_type ?? ev.type ?? "interaction",
        note: ev.note ?? ev.summary ?? null,
      };
    });
    let merged = [...reqItems, ...intItems].sort((a, b) => b.at.localeCompare(a.at));
    if (filter === "adoption") merged = merged.filter(i => i.kind === "request" && i.pathway === "adoption");
    if (filter === "milestones") merged = merged.filter(i => i.kind === "request");
    if (filter === "interactions") merged = merged.filter(i => i.kind === "interaction");
    return merged;
  }, [requestEvents, interactions, childById, filter]);

  // Group items by day for nicer headings
  const grouped = useMemo(() => {
    const map = new Map<string, TimelineItem[]>();
    for (const it of items) {
      const key = format(new Date(it.at), "yyyy-MM-dd");
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(it);
    }
    return Array.from(map.entries());
  }, [items]);

  return (
    <div className="container mx-auto max-w-3xl p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Button asChild size="sm" variant="ghost">
          <Link to="/dashboard"><ArrowLeft className="h-4 w-4 mr-1" /> Back</Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Clock className="h-5 w-5 text-social-loyalty" /> Family Timeline
          </h1>
          <p className="text-xs text-muted-foreground">Adoption milestones and parenting interactions in chronological order.</p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Filter className="h-3.5 w-3.5" /> Filter
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-1.5">
          {(["all", "milestones", "adoption", "interactions"] as const).map(f => (
            <Button
              key={f}
              size="sm"
              variant={filter === f ? "default" : "outline"}
              className="h-7 text-[11px] capitalize"
              onClick={() => setFilter(f)}
            >
              {f}
            </Button>
          ))}
        </CardContent>
      </Card>

      {grouped.length === 0 && (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            <Clock className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No events yet</p>
            <p className="text-xs mt-1">Adoption milestones and child care actions will appear here.</p>
          </CardContent>
        </Card>
      )}

      {grouped.map(([day, dayItems]) => (
        <div key={day} className="space-y-2">
          <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm py-1">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {format(new Date(day), "EEEE, MMM d, yyyy")}
            </p>
          </div>
          <div className="relative space-y-2 border-l-2 border-border/50 ml-2 pl-4">
            {dayItems.map(item => {
              const Icon = item.kind === "interaction" ? interactionIcon(item.eventType) : Baby;
              const colorClass = item.kind === "request"
                ? requestColor(item.eventType)
                : "text-social-chemistry";
              return (
                <div key={item.id} className="relative">
                  <div className="absolute -left-[22px] top-1 h-3 w-3 rounded-full bg-background border-2 border-border" />
                  <Card className="border-border/50">
                    <CardContent className="p-3">
                      <div className="flex items-start gap-2">
                        <Icon className={`h-4 w-4 mt-0.5 ${colorClass}`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="text-xs font-semibold capitalize">
                              {item.eventType.replace(/_/g, " ")}
                            </p>
                            {item.kind === "request" && item.pathway && (
                              <Badge variant="outline" className="text-[9px] h-4 px-1 capitalize">
                                {item.pathway}
                              </Badge>
                            )}
                            {item.kind === "interaction" && item.childName && (
                              <Badge variant="secondary" className="text-[9px] h-4 px-1">
                                {item.childName}
                              </Badge>
                            )}
                            {item.resultingStatus && (
                              <span className="text-[10px] text-muted-foreground">→ {item.resultingStatus}</span>
                            )}
                          </div>
                          {item.note && (
                            <p className="text-[11px] text-muted-foreground italic mt-1">{item.note}</p>
                          )}
                          <p className="text-[10px] text-muted-foreground/70 mt-1">
                            {format(new Date(item.at), "h:mm a")} · {formatDistanceToNow(new Date(item.at), { addSuffix: true })}
                          </p>
                        </div>
                        {item.childId && (
                          <Button asChild size="sm" variant="ghost" className="h-6 text-[10px] px-2">
                            <Link to={`/family/child/${item.childId}`}>View</Link>
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
