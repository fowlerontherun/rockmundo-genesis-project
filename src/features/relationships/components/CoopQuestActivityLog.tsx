import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollText, Flag, TrendingUp, Trophy, CheckCircle2, Filter, ChevronRight, Search, X, Users, CalendarRange } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useCoopQuestEvents, type CoopQuestEvent } from "@/hooks/useCoopQuestEvents";
import { useCoopQuestRealtime } from "@/hooks/useCoopQuestRealtime";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { cn } from "@/lib/utils";
import { CoopQuestDetailsDrawer } from "./CoopQuestDetailsDrawer";

const FRIEND_FILTER_ALL = "__all__";

interface CoopQuestActivityLogProps {
  /** If provided, scopes the log to a specific friend pair. Otherwise shows all pairs. */
  otherProfileId?: string | null;
  title?: string;
  description?: string;
  limit?: number;
}

type CadenceFilter = "all" | "daily" | "weekly";
type EventTypeFilter = "all" | CoopQuestEvent["event_type"];
type RangeFilter = "all" | "today" | "7d" | "30d";

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

const RANGE_OPTIONS: { value: RangeFilter; label: string }[] = [
  { value: "all", label: "All time" },
  { value: "today", label: "Today" },
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
];

function rangeCutoffMs(range: RangeFilter): number | null {
  if (range === "all") return null;
  const now = Date.now();
  if (range === "today") {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }
  if (range === "7d") return now - 7 * 24 * 60 * 60 * 1000;
  if (range === "30d") return now - 30 * 24 * 60 * 60 * 1000;
  return null;
}

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
  // Subscribe to realtime quest + event changes so the feed updates live.
  useCoopQuestRealtime();
  // Fetch a wider window so client-side filters still have plenty to show.
  const { data: events = [], isLoading } = useCoopQuestEvents(otherProfileId, Math.max(limit * 3, 60));

  const [cadence, setCadence] = useState<CadenceFilter>("all");
  const [eventType, setEventType] = useState<EventTypeFilter>("all");
  const [search, setSearch] = useState("");
  const [friendId, setFriendId] = useState<string>(FRIEND_FILTER_ALL);
  const [range, setRange] = useState<RangeFilter>("all");
  const [openQuestId, setOpenQuestId] = useState<string | null>(null);

  // Friend dropdown is only meaningful in the global feed (no otherProfileId scoping).
  const showFriendFilter = !otherProfileId;

  // Build a unique friend list from the loaded events so the dropdown reflects
  // exactly the friendships the player has any quest history with.
  const friendOptions = useMemo(() => {
    if (!showFriendFilter) return [] as { id: string; name: string }[];
    const map = new Map<string, string>();
    for (const e of events) {
      if (e.friend_profile_id) {
        const existing = map.get(e.friend_profile_id);
        if (!existing && e.friend_display_name) {
          map.set(e.friend_profile_id, e.friend_display_name);
        } else if (!existing) {
          map.set(e.friend_profile_id, "Unknown friend");
        }
      }
    }
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [events, showFriendFilter]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return events
      .filter((e) => (cadence === "all" ? true : (e.quest_cadence ?? "").toLowerCase() === cadence))
      .filter((e) => (eventType === "all" ? true : e.event_type === eventType))
      .filter((e) => (friendId === FRIEND_FILTER_ALL ? true : e.friend_profile_id === friendId))
      .filter((e) => {
        if (!q) return true;
        const youActed = e.actor_profile_id === profileId;
        const haystack = [
          youActed ? "you" : null,
          e.actor_display_name,
          e.friend_display_name,
          e.friend_profile_id,
          e.quest_title,
          e.note,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return haystack.includes(q);
      })
      .slice(0, limit);
  }, [events, cadence, eventType, friendId, search, limit, profileId]);

  const hasActiveFilter =
    cadence !== "all" ||
    eventType !== "all" ||
    search.trim().length > 0 ||
    friendId !== FRIEND_FILTER_ALL;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <ScrollText className="h-4 w-4 text-primary" />
          {title}
        </CardTitle>
        <CardDescription className="text-xs">{description}</CardDescription>

        <div className="mt-3 space-y-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by friend, quest, or note… (try 'you' for your own actions)"
              className="h-7 pl-7 pr-7 text-xs"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {showFriendFilter && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                <Users className="h-3 w-3" /> Friend
              </span>
              <Select value={friendId} onValueChange={setFriendId}>
                <SelectTrigger className="h-7 w-[200px] text-xs">
                  <SelectValue placeholder="All friends" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={FRIEND_FILTER_ALL} className="text-xs">
                    All friends ({friendOptions.length})
                  </SelectItem>
                  {friendOptions.map((f) => (
                    <SelectItem key={f.id} value={f.id} className="text-xs">
                      {f.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {friendOptions.length === 0 && (
                <span className="text-[10px] text-muted-foreground">
                  No friend quests in current window
                </span>
              )}
            </div>
          )}

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
                  setSearch("");
                  setFriendId(FRIEND_FILTER_ALL);
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
                  <li key={e.id}>
                    <button
                      type="button"
                      onClick={() => setOpenQuestId(e.quest_id)}
                      className={cn(
                        "w-full text-left flex items-start gap-2 rounded-md border p-2 text-xs",
                        "hover:bg-accent/40 hover:border-accent transition-colors cursor-pointer",
                        e.event_type === "claimed" && "border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/10",
                        e.event_type === "completed" && "border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10",
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
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                    </button>
                  </li>
                );
              })}
            </ul>
          </ScrollArea>
        )}
      </CardContent>

      <CoopQuestDetailsDrawer
        questId={openQuestId}
        open={!!openQuestId}
        onOpenChange={(open) => {
          if (!open) setOpenQuestId(null);
        }}
      />
    </Card>
  );
}
