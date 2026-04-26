import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ScrollText, Flag, TrendingUp, Trophy, CheckCircle2, Filter, ChevronRight } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useCoopQuestEvents, type CoopQuestEvent } from "@/hooks/useCoopQuestEvents";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { cn } from "@/lib/utils";
import { CoopQuestDetailsDrawer } from "./CoopQuestDetailsDrawer";

interface CoopQuestActivityLogProps {
  /** If provided, scopes the log to a specific friend pair. Otherwise shows all pairs. */
  otherProfileId?: string | null;
  title?: string;
  description?: string;
  limit?: number;
}

type CadenceFilter = "all" | "daily" | "weekly";
type EventTypeFilter = "all" | CoopQuestEvent["event_type"];

const CADENCE_OPTIONS: { value: CadenceFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
];

const EVENT_OPTIONS: { value: EventTypeFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "started", label: "Started" },
  { value: "progress", label: "Progress" },
  { value: "completed", label: "Completed" },
  { value: "claimed", label: "Claimed" },
];

function eventIcon(type: CoopQuestEvent["event_type"]) {
  switch (type) {
    case "started":   return <Flag className="h-3.5 w-3.5 text-primary" />;
    case "progress":  return <TrendingUp className="h-3.5 w-3.5 text-blue-500" />;
    case "completed": return <Trophy className="h-3.5 w-3.5 text-amber-500" />;
    case "claimed":   return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />;
  }
}

function eventLabel(type: CoopQuestEvent["event_type"]) {
  switch (type) {
    case "started":   return "Started";
    case "progress":  return "Progress";
    case "completed": return "Completed";
    case "claimed":   return "Claimed";
  }
}

export function CoopQuestActivityLog({
  otherProfileId,
  title = "Co-op quest activity",
  description = "Live log of every quest start, progress tick, completion and reward claim.",
  limit = 25,
}: CoopQuestActivityLogProps) {
  const { profileId } = useActiveProfile();
  // Fetch a wider window so client-side filters still have plenty to show.
  const { data: events = [], isLoading } = useCoopQuestEvents(otherProfileId, Math.max(limit * 3, 60));

  const [cadence, setCadence] = useState<CadenceFilter>("all");
  const [eventType, setEventType] = useState<EventTypeFilter>("all");

  const filtered = useMemo(() => {
    return events
      .filter((e) => (cadence === "all" ? true : (e.quest_cadence ?? "").toLowerCase() === cadence))
      .filter((e) => (eventType === "all" ? true : e.event_type === eventType))
      .slice(0, limit);
  }, [events, cadence, eventType, limit]);

  const hasActiveFilter = cadence !== "all" || eventType !== "all";

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <ScrollText className="h-4 w-4 text-primary" />
          {title}
        </CardTitle>
        <CardDescription className="text-xs">{description}</CardDescription>

        <div className="mt-3 space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
              <Filter className="h-3 w-3" /> Cadence
            </span>
            {CADENCE_OPTIONS.map((opt) => (
              <Button
                key={opt.value}
                size="sm"
                variant={cadence === opt.value ? "default" : "outline"}
                className="h-6 px-2 text-[11px]"
                onClick={() => setCadence(opt.value)}
              >
                {opt.label}
              </Button>
            ))}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
              <Filter className="h-3 w-3" /> Event
            </span>
            {EVENT_OPTIONS.map((opt) => (
              <Button
                key={opt.value}
                size="sm"
                variant={eventType === opt.value ? "default" : "outline"}
                className="h-6 px-2 text-[11px]"
                onClick={() => setEventType(opt.value)}
              >
                {opt.label}
              </Button>
            ))}
            {hasActiveFilter && (
              <Button
                size="sm"
                variant="ghost"
                className="h-6 px-2 text-[11px]"
                onClick={() => {
                  setCadence("all");
                  setEventType("all");
                }}
              >
                Reset
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading && <p className="text-xs text-muted-foreground">Loading activity…</p>}
        {!isLoading && events.length === 0 && (
          <p className="text-xs text-muted-foreground">
            No co-op quest activity yet. Start a quest to see entries appear here.
          </p>
        )}
        {!isLoading && events.length > 0 && filtered.length === 0 && (
          <p className="text-xs text-muted-foreground">
            No events match the current filters.
          </p>
        )}
        {filtered.length > 0 && (
          <ScrollArea className="max-h-72 pr-2">
            <ul className="space-y-2">
              {filtered.map((e) => {
                const youActed = e.actor_profile_id === profileId;
                return (
                  <li
                    key={e.id}
                    className={cn(
                      "flex items-start gap-2 rounded-md border p-2 text-xs",
                      e.event_type === "claimed" && "border-emerald-500/30 bg-emerald-500/5",
                      e.event_type === "completed" && "border-amber-500/30 bg-amber-500/5",
                    )}
                  >
                    <div className="mt-0.5">{eventIcon(e.event_type)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                          {eventLabel(e.event_type)}
                        </Badge>
                        {e.quest_cadence && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                            {e.quest_cadence}
                          </Badge>
                        )}
                        {e.quest_title && (
                          <span className="font-medium truncate">{e.quest_title}</span>
                        )}
                      </div>
                      <p className="text-muted-foreground mt-0.5 break-words">
                        <span className="font-medium text-foreground">
                          {youActed ? "You" : e.actor_display_name ?? "Friend"}
                        </span>
                        {e.note ? ` — ${e.note}` : ""}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {formatDistanceToNow(new Date(e.created_at), { addSuffix: true })}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
