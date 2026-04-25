import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ScrollText, Flag, TrendingUp, Trophy, CheckCircle2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useCoopQuestEvents, type CoopQuestEvent } from "@/hooks/useCoopQuestEvents";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { cn } from "@/lib/utils";

interface CoopQuestActivityLogProps {
  /** If provided, scopes the log to a specific friend pair. Otherwise shows all pairs. */
  otherProfileId?: string | null;
  title?: string;
  description?: string;
  limit?: number;
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
  const { data: events = [], isLoading } = useCoopQuestEvents(otherProfileId, limit);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <ScrollText className="h-4 w-4 text-primary" />
          {title}
        </CardTitle>
        <CardDescription className="text-xs">{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading && <p className="text-xs text-muted-foreground">Loading activity…</p>}
        {!isLoading && events.length === 0 && (
          <p className="text-xs text-muted-foreground">
            No co-op quest activity yet. Start a quest to see entries appear here.
          </p>
        )}
        {events.length > 0 && (
          <ScrollArea className="max-h-72 pr-2">
            <ul className="space-y-2">
              {events.map((e) => {
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
