import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Calendar, MapPin, Swords, Trophy, Users } from "lucide-react";
import { Link } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { getBattleNewsDateRanges } from "./battleNewsDates";

const db = supabase;

export function BattleOfTheBandsNews() {
  const ranges = getBattleNewsDateRanges(new Date());
  const { data, isLoading } = useQuery({
    queryKey: ["battle-of-the-bands-news", ranges.today],
    queryFn: async () => {
      const [todayResult, yesterdayResult] = await Promise.all([
        db.from("botb_events")
          .select("id, scheduled_date, max_entries, city:cities(name, country), botb_entries(id)")
          .eq("status", "upcoming").gte("scheduled_date", ranges.todayStart)
          .lte("scheduled_date", ranges.todayEnd).order("scheduled_date", { ascending: true }),
        db.from("botb_events")
          .select("id, scheduled_date, winner_rating, city:cities(name, country), winner_band:bands!botb_events_winner_band_id_fkey(name), botb_entries(id)")
          .eq("status", "completed").gte("scheduled_date", ranges.yesterdayStart)
          .lte("scheduled_date", ranges.yesterdayEnd).order("winner_rating", { ascending: false }),
      ]);
      if (todayResult.error) throw todayResult.error;
      if (yesterdayResult.error) throw yesterdayResult.error;
      return { upcoming: todayResult.data ?? [], results: yesterdayResult.data ?? [] };
    },
    staleTime: 5 * 60 * 1000,
  });

  if (!isLoading && !data?.upcoming.length && !data?.results.length) return null;

  return (
    <Card className="border-primary/30">
      <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-lg font-serif">
        <Swords className="h-5 w-5 text-primary" />Battle of the Bands
      </CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? <p className="text-sm text-muted-foreground">Loading battle news…</p> : <>
          {data?.upcoming.map((event) => <article key={event.id} className="rounded-lg border bg-muted/30 p-3">
            <div className="mb-2 flex items-center justify-between gap-2"><h4 className="font-semibold font-serif">Battle today in {event.city?.name}</h4><Badge>Today</Badge></div>
            <p className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{format(new Date(event.scheduled_date), "p")}</span>
              <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{event.city?.country}</span>
              <span className="flex items-center gap-1"><Users className="h-3 w-3" />{event.botb_entries?.length ?? 0}/{event.max_entries} bands</span>
            </p>
          </article>)}
          {data?.results.map((event) => <article key={event.id} className="rounded-lg border bg-muted/30 p-3">
            <div className="mb-2 flex items-center justify-between gap-2"><h4 className="flex items-center gap-1.5 font-semibold font-serif"><Trophy className="h-4 w-4 text-primary" />{event.winner_band?.name} wins in {event.city?.name}</h4><Badge variant="secondary">Yesterday</Badge></div>
            <p className="text-xs text-muted-foreground">{event.botb_entries?.length ?? 0} bands competed{event.winner_rating != null ? ` · Winning score ${Number(event.winner_rating).toFixed(0)}%` : ""}</p>
          </article>)}
        </>}
        <Button asChild variant="outline" size="sm" className="w-full"><Link to="/battle-of-the-bands">View battles and enter</Link></Button>
      </CardContent>
    </Card>
  );
}
