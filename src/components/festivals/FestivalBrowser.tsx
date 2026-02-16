import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Calendar, MapPin, Music, Ticket, Users, Star, ChevronRight, Clock } from "lucide-react";
import { useFestivalTickets } from "@/hooks/useFestivalTickets";
import { useFestivalStages, useFestivalStageSlots } from "@/hooks/useFestivalStages";
import { useFestivalQuality } from "@/hooks/useFestivalFinances";
import { useAuth } from "@/hooks/use-auth-context";
import { format } from "date-fns";

interface Festival {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  start_date: string;
  end_date: string | null;
  duration_days: number | null;
  ticket_price: number | null;
  max_stages: number | null;
  status: string;
}

export const FestivalBrowser = ({ onSelectLive }: { onSelectLive: (id: string) => void }) => {
  const [selectedFestivalId, setSelectedFestivalId] = useState<string | null>(null);

  const { data: festivals = [], isLoading } = useQuery<Festival[]>({
    queryKey: ["browse-festivals"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("game_events")
        .select("*")
        .eq("event_type", "festival")
        .order("start_date", { ascending: true });
      if (error) throw error;
      return (data || []) as Festival[];
    },
  });

  if (isLoading) {
    return <div className="text-center text-muted-foreground py-12">Loading festivals...</div>;
  }

  if (festivals.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <Music className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p className="text-lg font-medium">No festivals scheduled</p>
          <p className="text-sm">Check back later for upcoming festival events!</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
      {/* Festival list */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold">Upcoming Festivals</h3>
        <ScrollArea className="h-[600px]">
          <div className="space-y-3 pr-4">
            {festivals.map((festival) => (
              <FestivalCard
                key={festival.id}
                festival={festival}
                isSelected={selectedFestivalId === festival.id}
                onSelect={() => setSelectedFestivalId(festival.id)}
                onGoLive={() => onSelectLive(festival.id)}
              />
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Detail panel */}
      <div>
        {selectedFestivalId ? (
          <FestivalDetailPanel festivalId={selectedFestivalId} onGoLive={() => onSelectLive(selectedFestivalId)} />
        ) : (
          <Card className="h-full flex items-center justify-center">
            <CardContent className="text-center text-muted-foreground py-12">
              <ChevronRight className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>Select a festival to see details & lineup</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

const FestivalCard = ({
  festival,
  isSelected,
  onSelect,
  onGoLive,
}: {
  festival: Festival;
  isSelected: boolean;
  onSelect: () => void;
  onGoLive: () => void;
}) => {
  const isActive = festival.status === "in_progress" || festival.status === "active";
  return (
    <Card
      className={`cursor-pointer transition-all ${isSelected ? "ring-2 ring-primary" : "hover:border-primary/40"}`}
      onClick={onSelect}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2">
              <h4 className="font-semibold truncate">{festival.title}</h4>
              {isActive && (
                <Badge variant="default" className="animate-pulse text-xs">🔴 LIVE</Badge>
              )}
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              {festival.location && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> {festival.location}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" /> {format(new Date(festival.start_date), "MMM d")}
              </span>
              {festival.duration_days && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" /> {festival.duration_days} days
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-1">
              {festival.max_stages && (
                <Badge variant="outline" className="text-xs">{festival.max_stages} stages</Badge>
              )}
              {festival.ticket_price != null && (
                <Badge variant="secondary" className="text-xs">
                  <Ticket className="h-3 w-3 mr-1" /> £{festival.ticket_price}
                </Badge>
              )}
            </div>
          </div>
          {isActive && (
            <Button size="sm" variant="default" onClick={(e) => { e.stopPropagation(); onGoLive(); }}>
              Enter
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

const FestivalDetailPanel = ({ festivalId, onGoLive }: { festivalId: string; onGoLive: () => void }) => {
  const { user } = useAuth();
  const { data: stages = [] } = useFestivalStages(festivalId);
  const { data: slots = [] } = useFestivalStageSlots(festivalId);
  const { tickets, hasTicket, hasWeekendPass, purchaseTicket } = useFestivalTickets(festivalId);
  const { data: quality } = useFestivalQuality(festivalId);

  const { data: festival } = useQuery<Festival | null>({
    queryKey: ["festival-detail", festivalId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("game_events")
        .select("*")
        .eq("id", festivalId)
        .single();
      if (error) throw error;
      return data as Festival;
    },
  });

  if (!festival) return null;

  const isActive = festival.status === "in_progress" || festival.status === "active";
  const durationDays = festival.duration_days || 2;
  const ticketPrice = festival.ticket_price || 50;
  const weekendPrice = ticketPrice * durationDays * 0.8;

  const handlePurchase = (type: "day" | "weekend", dayNumber?: number) => {
    const price = type === "weekend" ? weekendPrice : ticketPrice;
    purchaseTicket.mutate({
      festivalId,
      ticketType: type,
      price,
      dayNumber,
      festivalTitle: festival.title,
      festivalStart: festival.start_date,
      festivalEnd: festival.end_date || festival.start_date,
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-xl">{festival.title}</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {festival.location} • {format(new Date(festival.start_date), "MMM d, yyyy")} • {durationDays} days
            </p>
          </div>
          {isActive && (
            <Button onClick={onGoLive} className="gap-2">
              <Music className="h-4 w-4" />
              Enter Festival
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Quality ratings */}
        {quality && (
          <div className="grid grid-cols-5 gap-2 text-center">
            {[
              { label: "Comfort", val: quality.comfort_rating },
              { label: "Food", val: quality.food_rating },
              { label: "Safety", val: quality.safety_rating },
              { label: "Lineup", val: quality.lineup_rating },
              { label: "Overall", val: quality.overall_rating },
            ].map((q) => (
              <div key={q.label} className="space-y-1">
                <div className="flex justify-center gap-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className={`h-3 w-3 ${i < Math.round(q.val) ? "text-yellow-500 fill-yellow-500" : "text-muted-foreground/30"}`}
                    />
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">{q.label}</p>
              </div>
            ))}
          </div>
        )}

        <Separator />

        {/* Ticket purchase */}
        <div className="space-y-3">
          <h4 className="font-semibold flex items-center gap-2">
            <Ticket className="h-4 w-4" /> Tickets
          </h4>
          {hasTicket ? (
            <div className="p-3 rounded-lg bg-primary/10 border border-primary/30 text-sm">
              ✅ You have a {hasWeekendPass ? "weekend pass" : "day ticket"} for this festival!
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <Card className="border-dashed">
                <CardContent className="p-3 text-center space-y-2">
                  <p className="font-medium text-sm">Weekend Pass</p>
                  <p className="text-2xl font-bold">£{weekendPrice.toFixed(0)}</p>
                  <p className="text-xs text-muted-foreground">All {durationDays} days</p>
                  <Button
                    size="sm"
                    className="w-full"
                    disabled={purchaseTicket.isPending}
                    onClick={() => handlePurchase("weekend")}
                  >
                    Buy Pass
                  </Button>
                </CardContent>
              </Card>
              {Array.from({ length: durationDays }).map((_, i) => (
                <Card key={i} className="border-dashed">
                  <CardContent className="p-3 text-center space-y-2">
                    <p className="font-medium text-sm">Day {i + 1}</p>
                    <p className="text-2xl font-bold">£{ticketPrice}</p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full"
                      disabled={purchaseTicket.isPending}
                      onClick={() => handlePurchase("day", i + 1)}
                    >
                      Buy
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        <Separator />

        {/* Lineup by stage */}
        <div className="space-y-3">
          <h4 className="font-semibold flex items-center gap-2">
            <Users className="h-4 w-4" /> Lineup
          </h4>
          {stages.length === 0 ? (
            <p className="text-sm text-muted-foreground">Lineup not yet announced</p>
          ) : (
            <div className="space-y-4">
              {stages.map((stage) => {
                const stageSlots = slots.filter((s) => s.stage_id === stage.id);
                return (
                  <div key={stage.id} className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{stage.stage_name}</Badge>
                      {stage.genre_focus && (
                        <span className="text-xs text-muted-foreground">{stage.genre_focus}</span>
                      )}
                    </div>
                    <div className="grid gap-1 pl-4">
                      {stageSlots.map((slot) => (
                        <div key={slot.id} className="flex items-center gap-2 text-sm">
                          <Badge
                            variant={slot.slot_type === "headliner" ? "default" : "secondary"}
                            className="text-xs capitalize w-20 justify-center"
                          >
                            {slot.slot_type === "dj_session" ? "DJ" : slot.slot_type}
                          </Badge>
                          <span className="text-xs text-muted-foreground">Day {slot.day_number}</span>
                          <span className="font-medium">
                            {slot.is_npc_dj
                              ? slot.npc_dj_name || "NPC DJ"
                              : slot.band?.name || "TBA"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
