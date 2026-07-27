import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { useGameData } from "@/hooks/useGameData";
import { usePrimaryBand } from "@/hooks/usePrimaryBand";
import {
  useBotbUpcoming,
  useBotbHistory,
  useMyBandBotbEntries,
  useBotbEventEntries,
  useEnterBotb,
  useWithdrawBotbEntry,
  type BotbEvent,
} from "@/hooks/useBattleOfTheBands";
import { OpenMicSongSelector } from "@/components/open-mic/OpenMicSongSelector";
import { FMPageScaffold } from "@/components/fm/FMPageScaffold";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Swords, MapPin, Calendar, Users, Trophy, Info, Music, X } from "lucide-react";
import { format } from "date-fns";

export default function BattleOfTheBands() {
  const { profileId } = useActiveProfile();
  const { currentCity } = useGameData();
  const { data: primaryBand } = usePrimaryBand();
  const bandId: string | null = primaryBand?.band_id ?? null;
  const bandName: string | undefined = (primaryBand as any)?.bands?.name;

  const [selectedCityId, setSelectedCityId] = useState<string>(currentCity?.id || "all");
  const [entryEventId, setEntryEventId] = useState<string | null>(null);
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [detailEvent, setDetailEvent] = useState<BotbEvent | null>(null);

  const cityFilter = selectedCityId === "all" ? undefined : selectedCityId;
  const { data: upcoming = [], isLoading } = useBotbUpcoming(cityFilter);
  const { data: history = [] } = useBotbHistory(cityFilter);
  const { data: myEntries = [] } = useMyBandBotbEntries(bandId);
  const { data: detailEntries = [] } = useBotbEventEntries(detailEvent?.id ?? null);
  const enter = useEnterBotb();
  const withdraw = useWithdrawBotbEntry();

  const { data: cities = [] } = useQuery({
    queryKey: ["cities-for-botb"],
    queryFn: async () => {
      const { data, error } = await supabase.from("cities").select("id, name, country").order("name");
      if (error) throw error;
      return data;
    },
  });

  const enteredEventIds = new Set(myEntries.map((e) => e.event_id));

  const handleEnter = (eventId: string) => {
    setEntryEventId(eventId);
    setSelectorOpen(true);
  };

  const handleSongSelection = (song1Id: string, song2Id: string) => {
    if (!entryEventId || !bandId) return;
    enter.mutate({ eventId: entryEventId, bandId, song1Id, song2Id });
  };

  return (
    <FMPageScaffold
      title="Battle of the Bands"
      subtitle="Every city, every two weeks — 20 bands, 2 songs each, one winner"
      icon={Swords}
      backTo="/hub/live"
    >
      <Alert className="border-primary/30 bg-primary/5">
        <Info className="h-4 w-4" />
        <AlertDescription>
          <strong>How it works:</strong> Up to 20 bands enter each battle with 2 written songs. Your band must not have
          released an album. The best performance wins <strong>6 AP</strong> and <strong>1,000 XP</strong> for every
          member, plus <strong>$5,000</strong>, fans and fame for the band. Champions must sit out the next battle in
          that city.
        </AlertDescription>
      </Alert>

      {!bandId && (
        <Alert variant="destructive">
          <Info className="h-4 w-4" />
          <AlertDescription>You need to be in a band to enter a Battle of the Bands.</AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="upcoming" className="space-y-4">
        <TabsList>
          <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
          <TabsTrigger value="mine">My Battles ({myEntries.length})</TabsTrigger>
          <TabsTrigger value="history">Past Winners</TabsTrigger>
        </TabsList>

        <div className="flex items-center gap-4">
          <Select value={selectedCityId} onValueChange={setSelectedCityId}>
            <SelectTrigger className="w-[250px]">
              <SelectValue placeholder="Filter by city" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Cities</SelectItem>
              {cities.map((city: any) => (
                <SelectItem key={city.id} value={city.id}>
                  {city.name}, {city.country}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Upcoming */}
        <TabsContent value="upcoming" className="space-y-4">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading battles…</p>
          ) : upcoming.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <Swords className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No upcoming battles scheduled</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {upcoming.map((event) => {
                const isCurrentCity = event.city_id === currentCity?.id;
                const entered = enteredEventIds.has(event.id);
                const full = (event.entry_count ?? 0) >= event.max_entries;

                return (
                  <Card key={event.id} className={isCurrentCity ? "border-primary/50" : ""}>
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-lg">{event.city?.name}</CardTitle>
                          <CardDescription className="flex items-center gap-1 mt-1">
                            <MapPin className="h-3 w-3" />
                            {event.city?.country}
                          </CardDescription>
                        </div>
                        {isCurrentCity && (
                          <Badge variant="secondary" className="text-xs">
                            Your City
                          </Badge>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          {format(new Date(event.scheduled_date), "MMM d, yyyy")}
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="h-4 w-4" />
                          {event.entry_count ?? 0}/{event.max_entries}
                        </span>
                      </div>

                      <div className="pt-2 border-t space-y-2">
                        {entered ? (
                          <Badge variant="outline" className="w-full justify-center py-1">
                            Entered
                          </Badge>
                        ) : (
                          <Button
                            className="w-full"
                            size="sm"
                            disabled={!bandId || !profileId || full || enter.isPending}
                            onClick={() => handleEnter(event.id)}
                          >
                            <Music className="h-4 w-4 mr-2" />
                            {full ? "Battle Full" : "Enter Battle"}
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full"
                          onClick={() => setDetailEvent(event)}
                        >
                          View line-up
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* My battles */}
        <TabsContent value="mine" className="space-y-4">
          {myEntries.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <Trophy className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>{bandName ? `${bandName} hasn't entered a battle yet` : "No entries yet"}</p>
              </CardContent>
            </Card>
          ) : (
            myEntries.map((entry) => {
              const ev = entry.event as BotbEvent | null;
              const done = ev?.status === "completed";
              return (
                <Card key={entry.id}>
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">{ev?.city?.name ?? "Battle"}</h3>
                          <Badge variant={entry.is_winner ? "default" : done ? "secondary" : "outline"}>
                            {entry.is_winner ? "Winner" : done ? `Placed #${entry.placement ?? "-"}` : "Scheduled"}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {ev?.scheduled_date ? format(new Date(ev.scheduled_date), "EEEE, MMM d yyyy") : ""}
                        </p>
                        <div className="flex items-center gap-2 text-sm">
                          <Music className="h-4 w-4" />
                          <span>{entry.song_1?.title}</span>
                          <span>•</span>
                          <span>{entry.song_2?.title}</span>
                        </div>
                      </div>

                      {done ? (
                        <div className="text-right">
                          <div className="text-2xl font-bold text-primary">
                            {entry.overall_rating?.toFixed(0) ?? "-"}%
                          </div>
                          {entry.is_winner && (
                            <div className="text-xs text-muted-foreground">
                              +${entry.cash_awarded.toLocaleString()} • +{entry.fame_gained} Fame • +
                              {entry.fans_gained} Fans
                            </div>
                          )}
                        </div>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => withdraw.mutate(entry.id)}
                          disabled={withdraw.isPending}
                        >
                          <X className="h-4 w-4 mr-1" />
                          Withdraw
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>

        {/* History */}
        <TabsContent value="history" className="space-y-4">
          {history.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <Trophy className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No battles have been fought yet</p>
              </CardContent>
            </Card>
          ) : (
            history.map((event) => (
              <Card key={event.id} className="cursor-pointer" onClick={() => setDetailEvent(event)}>
                <CardContent className="py-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Trophy className="h-4 w-4 text-primary" />
                        <h3 className="font-semibold">{event.winner_band?.name ?? "No winner"}</h3>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {event.city?.name} • {format(new Date(event.scheduled_date), "MMM d, yyyy")} •{" "}
                        {event.entry_count ?? 0} bands
                      </p>
                    </div>
                    <div className="text-2xl font-bold text-primary">
                      {event.winner_rating ? `${Number(event.winner_rating).toFixed(0)}%` : "—"}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>

      {/* Line-up / results dialog */}
      <Dialog open={!!detailEvent} onOpenChange={(open) => !open && setDetailEvent(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Swords className="h-5 w-5 text-primary" />
              {detailEvent?.city?.name} —{" "}
              {detailEvent ? format(new Date(detailEvent.scheduled_date), "MMM d, yyyy") : ""}
            </DialogTitle>
            <DialogDescription>
              {detailEvent?.status === "completed" ? "Final results" : "Bands entered so far"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-[380px] overflow-y-auto">
            {detailEntries.length === 0 ? (
              <p className="text-sm text-muted-foreground">No bands entered.</p>
            ) : (
              detailEntries.map((entry, index) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between rounded-lg border p-2 text-sm"
                >
                  <span className="flex items-center gap-2">
                    <span className="text-muted-foreground w-5">{entry.placement ?? index + 1}</span>
                    <span className="font-medium">{entry.band?.name}</span>
                    {entry.is_winner && <Trophy className="h-3.5 w-3.5 text-primary" />}
                  </span>
                  <span className="text-muted-foreground">
                    {entry.overall_rating ? `${Number(entry.overall_rating).toFixed(0)}%` : "—"}
                  </span>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      <OpenMicSongSelector
        open={selectorOpen}
        onOpenChange={setSelectorOpen}
        bandId={bandId}
        profileId={profileId}
        onConfirm={handleSongSelection}
      />
    </FMPageScaffold>
  );
}
