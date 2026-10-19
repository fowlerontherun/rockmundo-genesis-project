import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatBotbCityDate } from "@/lib/botbDates";
import { toast } from "sonner";
import { CalendarDays, Ticket, Trophy, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useBotbHistory, useBotbUpcoming } from "@/hooks/useBattleOfTheBands";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const db = supabase as any;
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const money = (amount: number) => `$${amount.toLocaleString()}`;

type CityBattleSettings = {
  weekday: number;
  frequency_weeks: number;
  prize_money: number;
};

export function MayorBattleOfBandsTab({ cityId }: { cityId: string }) {
  const queryClient = useQueryClient();
  const [weekday, setWeekday] = useState(5);
  const [frequency, setFrequency] = useState(2);
  const [prize, setPrize] = useState(5000);

  const settings = useQuery({
    queryKey: ["botb-city-settings", cityId],
    queryFn: async (): Promise<CityBattleSettings> => {
      const { data, error } = await db.from("botb_city_settings")
        .select("weekday,frequency_weeks,prize_money")
        .eq("city_id", cityId).maybeSingle();
      if (error) throw error;
      return data ?? { weekday: 5, frequency_weeks: 2, prize_money: 5000 };
    },
  });
  const { data: upcoming = [], isLoading: loadingUpcoming } = useBotbUpcoming(cityId);
  const { data: history = [] } = useBotbHistory(cityId);

  useEffect(() => {
    if (!settings.data) return;
    setWeekday(settings.data.weekday);
    setFrequency(settings.data.frequency_weeks);
    setPrize(settings.data.prize_money);
  }, [settings.data]);

  const update = useMutation({
    mutationFn: async () => {
      const { data, error } = await db.rpc("configure_city_botb", {
        p_city_id: cityId,
        p_weekday: weekday,
        p_frequency_weeks: frequency,
        p_prize_money: prize,
      });
      if (error) throw error;
      if (!data?.success) throw new Error("The battle schedule was not saved");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["botb-city-settings", cityId] });
      queryClient.invalidateQueries({ queryKey: ["botb-upcoming"] });
      queryClient.invalidateQueries({ queryKey: ["mayor-actions-log"] });
      toast.success("Battle schedule and prize updated");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const valid = Number.isInteger(weekday) && weekday >= 0 && weekday <= 6
    && [1, 2, 4].includes(frequency)
    && Number.isInteger(prize) && prize >= 1000 && prize <= 50000;

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Trophy className="h-5 w-5" /> Battle of the Bands</CardTitle>
          <CardDescription>
            Decide which day your city hosts battles, how frequently they run and the winner's cash prize.
            Battles start at 7pm local city time. Existing entries keep their dates and advertised prizes.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {settings.isLoading && <p className="text-sm text-muted-foreground">Loading city settings…</p>}
          {settings.isError && (
            <div role="alert" className="text-sm text-destructive">
              Settings unavailable. <Button variant="outline" size="sm" onClick={() => void settings.refetch()}>Retry</Button>
            </div>
          )}
          {!settings.isError && !settings.isLoading && (
            <>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>Event day</Label>
                  <Select value={String(weekday)} onValueChange={(value) => setWeekday(Number(value))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {DAYS.map((day, dayNumber) => (
                        <SelectItem key={day} value={String(dayNumber)}>{day}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>How often</Label>
                  <Select value={String(frequency)} onValueChange={(value) => setFrequency(Number(value))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Every week</SelectItem>
                      <SelectItem value="2">Every 2 weeks</SelectItem>
                      <SelectItem value="4">Every 4 weeks</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="botb-prize">Winner's prize ($1,000–$50,000)</Label>
                  <Input id="botb-prize" type="number" min={1000} max={50000} step={500}
                    value={Number.isFinite(prize) ? prize : ""}
                    onChange={(event) => setPrize(Number(event.target.value))} />
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Attendance depends on entered bands, their local fans and fame, and the prize.
                Ticket receipts and event sponsorship cover the prize and production costs.
                The city always earns at least $0 net.
              </p>
              <Button disabled={!valid || update.isPending} onClick={() => update.mutate()}>
                {update.isPending ? "Updating…" : "Save battle settings"}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><CalendarDays className="h-5 w-5" /> Upcoming battles</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {loadingUpcoming ? "Loading upcoming battles…" : upcoming.length === 0 ? "No battles scheduled." :
            upcoming.slice(0, 8).map((event) => (
              <div key={event.id} className="flex items-center justify-between gap-3 border-b pb-2 text-sm">
                <span>{formatBotbCityDate(event.scheduled_date, event.city?.timezone)}</span>
                <span className="flex items-center gap-1 text-muted-foreground"><Users className="h-4 w-4" />{event.entry_count ?? 0}/{event.max_entries}</span>
                <strong>{money(event.prize_money)}</strong>
              </div>
            ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Ticket className="h-5 w-5" /> Event finances</CardTitle>
          <CardDescription>After each battle, the city receives any net proceeds; it never pays a deficit.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {history.length === 0 ? <p className="text-sm text-muted-foreground">No completed battles yet.</p> :
            history.slice(0, 8).map((event) => (
              <div key={event.id} className="border-b pb-3 text-sm space-y-1">
                <div className="flex justify-between font-medium">
                  <span>{formatBotbCityDate(event.scheduled_date, event.city?.timezone)}</span>
                  <span>Prize {money(event.prize_money)}</span>
                </div>
                {event.resolved_at && event.attendance > 0 ? (
                  <p className="text-muted-foreground">
                    {event.attendance.toLocaleString()} attending · Tickets {money(event.ticket_revenue)}
                    {" · "}Sponsorship {money(event.sponsorship_revenue)}
                    {" · "}Costs {money(event.production_cost)}
                    {" · "}City net +{money(event.city_profit)}
                  </p>
                ) : <p className="text-muted-foreground">Historic battle — attendance and proceeds not recorded.</p>}
              </div>
            ))}
        </CardContent>
      </Card>
    </div>
  );
}
