import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Sparkles,
  Star,
  DollarSign,
  Heart,
  Shield,
  Mic2,
  Users,
  Zap,
  ChevronRight,
} from "lucide-react";
import { useFestivalBackstageEvents, type BackstageEvent } from "@/hooks/useFestivalBackstageEvents";
import { cn } from "@/lib/utils";

interface FestivalBackstageEventsProps {
  festivalId: string;
  bandId: string;
}

const EVENT_ICONS: Record<string, any> = {
  media_interview: Mic2,
  rival_encounter: Zap,
  fan_encounter: Heart,
  sponsor_deal: DollarSign,
  equipment_crisis: Shield,
  band_argument: Users,
  celeb_meeting: Star,
  food_drama: Sparkles,
};

export function FestivalBackstageEvents({ festivalId, bandId }: FestivalBackstageEventsProps) {
  const { events, isLoading, triggerEvent, isTriggering, resolveEvent, isResolving } =
    useFestivalBackstageEvents(festivalId, bandId);

  const [activeEvent, setActiveEvent] = useState<BackstageEvent | null>(null);

  const unresolvedEvents = events?.filter((e) => e.chosen_option === null || e.chosen_option === undefined) || [];
  const resolvedEvents = events?.filter((e) => e.chosen_option !== null && e.chosen_option !== undefined) || [];

  const handleTrigger = () => {
    triggerEvent();
  };

  const handleChoice = (eventId: string, choiceIndex: number) => {
    resolveEvent({ eventId, choiceIndex });
    setActiveEvent(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          Backstage Events
        </h3>
        <Button
          size="sm"
          onClick={handleTrigger}
          disabled={isTriggering || unresolvedEvents.length >= 2}
          className="gap-2"
        >
          <Zap className="h-4 w-4" />
          {isTriggering ? "..." : "Explore Backstage"}
        </Button>
      </div>

      {/* Unresolved events */}
      {unresolvedEvents.map((event) => {
        const Icon = EVENT_ICONS[event.event_type] || Sparkles;
        return (
          <Card
            key={event.id}
            className="border-primary/50 cursor-pointer hover:bg-muted/30 transition-colors"
            onClick={() => setActiveEvent(event)}
          >
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold">{event.title}</p>
                    <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/30 text-xs">
                      New!
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                    {event.description}
                  </p>
                  <Button variant="link" size="sm" className="p-0 h-auto mt-1 text-primary">
                    Make your choice <ChevronRight className="h-3 w-3 ml-1" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}

      {/* Resolved events */}
      {resolvedEvents.length > 0 && (
        <>
          <p className="text-sm text-muted-foreground font-medium">Past Events</p>
          {resolvedEvents.slice(0, 5).map((event) => {
            const Icon = EVENT_ICONS[event.event_type] || Sparkles;
            const choices = (event.choices as any[]) || [];
            const chosenChoice = event.chosen_option !== undefined ? choices[event.chosen_option] : null;

            return (
              <Card key={event.id} className="opacity-75">
                <CardContent className="p-3">
                  <div className="flex items-center gap-3">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{event.title}</p>
                      {event.outcome_text && (
                        <p className="text-xs text-muted-foreground italic">{event.outcome_text}</p>
                      )}
                    </div>
                    <div className="flex gap-1 shrink-0">
                      {event.fame_impact !== 0 && (
                        <Badge variant="secondary" className="text-xs">
                          <Star className="h-3 w-3 mr-0.5" />
                          {event.fame_impact > 0 ? "+" : ""}{event.fame_impact}
                        </Badge>
                      )}
                      {event.money_impact !== 0 && (
                        <Badge variant="secondary" className="text-xs">
                          <DollarSign className="h-3 w-3 mr-0.5" />
                          {event.money_impact > 0 ? "+" : ""}{event.money_impact}
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </>
      )}

      {!isLoading && (!events || events.length === 0) && (
        <Card>
          <CardContent className="py-6 text-center text-muted-foreground">
            <Sparkles className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No backstage events yet</p>
            <p className="text-xs mt-1">Tap "Explore Backstage" to see what's happening behind the scenes!</p>
          </CardContent>
        </Card>
      )}

      {/* Event Choice Dialog */}
      <Dialog open={!!activeEvent} onOpenChange={(open) => !open && setActiveEvent(null)}>
        <DialogContent className="max-w-md">
          {activeEvent && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {(() => {
                    const Icon = EVENT_ICONS[activeEvent.event_type] || Sparkles;
                    return <Icon className="h-5 w-5 text-primary" />;
                  })()}
                  {activeEvent.title}
                </DialogTitle>
                <DialogDescription>{activeEvent.description}</DialogDescription>
              </DialogHeader>

              <div className="space-y-2 mt-4">
                {((activeEvent.choices as any[]) || []).map((choice: any, idx: number) => (
                  <Button
                    key={idx}
                    variant="outline"
                    className="w-full h-auto py-3 px-4 justify-start text-left"
                    onClick={() => handleChoice(activeEvent.id, idx)}
                    disabled={isResolving}
                  >
                    <div className="flex-1">
                      <p className="font-medium text-sm">{choice.label}</p>
                      <div className="flex gap-2 mt-1 flex-wrap">
                        {choice.fameImpact !== 0 && (
                          <span className={cn("text-xs", choice.fameImpact > 0 ? "text-green-500" : "text-red-500")}>
                            Fame {choice.fameImpact > 0 ? "+" : ""}{choice.fameImpact}
                          </span>
                        )}
                        {choice.moneyImpact !== 0 && (
                          <span className={cn("text-xs", choice.moneyImpact > 0 ? "text-green-500" : "text-red-500")}>
                            ${choice.moneyImpact > 0 ? "+" : ""}{choice.moneyImpact}
                          </span>
                        )}
                        {choice.chemistryImpact !== 0 && (
                          <span className={cn("text-xs", choice.chemistryImpact > 0 ? "text-green-500" : "text-red-500")}>
                            Chemistry {choice.chemistryImpact > 0 ? "+" : ""}{choice.chemistryImpact}
                          </span>
                        )}
                      </div>
                    </div>
                  </Button>
                ))}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
