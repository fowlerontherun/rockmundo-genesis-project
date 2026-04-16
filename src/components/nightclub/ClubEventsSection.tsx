import { Calendar, Music, Star, Sparkles, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useClubEvents, getTonightsEvent, getDayName, getEventTypeLabel, type NightclubEvent } from "@/hooks/useNightclubEvents";

interface ClubEventsSectionProps {
  clubId: string;
}

export const ClubEventsSection = ({ clubId }: ClubEventsSectionProps) => {
  const { data: events = [], isLoading } = useClubEvents(clubId);

  if (isLoading || events.length === 0) return null;

  const tonightsEvent = getTonightsEvent(events);
  const upcomingEvents = events.filter((e) => e !== tonightsEvent);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Calendar className="h-5 w-5 text-primary" /> Club Events
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Tonight's Event */}
        {tonightsEvent && (
          <div className="rounded-lg border-2 border-primary/50 bg-primary/5 p-4 space-y-2">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary animate-pulse" />
              <span className="text-xs font-bold uppercase text-primary tracking-wider">Tonight</span>
            </div>
            <EventCard event={tonightsEvent} highlight />
          </div>
        )}

        {/* Upcoming Schedule */}
        {upcomingEvents.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-muted-foreground">Weekly Schedule</h4>
            {upcomingEvents.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

const EventCard = ({ event, highlight = false }: { event: NightclubEvent; highlight?: boolean }) => (
  <div className={`rounded-lg border p-3 space-y-2 ${highlight ? "border-primary/30" : "border-border/60"}`}>
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2 min-w-0">
        <span className={`font-medium text-sm truncate ${highlight ? "text-primary" : ""}`}>
          {event.event_name}
        </span>
        <Badge variant="outline" className="text-[10px] shrink-0">
          {getEventTypeLabel(event.event_type)}
        </Badge>
      </div>
      {event.is_recurring && event.day_of_week !== null && (
        <span className="text-xs text-muted-foreground shrink-0 flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {getDayName(event.day_of_week)}s
        </span>
      )}
    </div>

    {event.description && (
      <p className="text-xs text-muted-foreground line-clamp-2">{event.description}</p>
    )}

    <div className="flex flex-wrap gap-1.5">
      {event.genre_focus && (
        <Badge variant="secondary" className="text-[10px]">
          <Music className="h-2.5 w-2.5 mr-0.5" />
          {event.genre_focus}
        </Badge>
      )}
      {event.fame_multiplier > 1 && (
        <Badge variant="secondary" className="text-[10px] text-yellow-400">
          <Star className="h-2.5 w-2.5 mr-0.5" />
          {event.fame_multiplier}x Fame
        </Badge>
      )}
      {event.xp_multiplier > 1 && (
        <Badge variant="secondary" className="text-[10px] text-purple-400">
          {event.xp_multiplier}x XP
        </Badge>
      )}
      {event.special_guest_name && (
        <Badge variant="outline" className="text-[10px]">
          🌟 {event.special_guest_name}
        </Badge>
      )}
      {event.cover_charge_override !== null && (
        <Badge variant="outline" className="text-[10px]">
          Cover: ${event.cover_charge_override}
        </Badge>
      )}
    </div>
  </div>
);
