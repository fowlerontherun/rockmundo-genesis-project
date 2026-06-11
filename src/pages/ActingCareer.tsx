import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth-context";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Film, Tv, Handshake, Star, DollarSign, Users, Trophy, TrendingUp, Calendar } from "lucide-react";
import { NegotiateOfferDialog } from "@/components/acting/NegotiateOfferDialog";
import { RenewalOfferCard } from "@/components/acting/RenewalOfferCard";
import { FilmBreakdownCard } from "@/components/acting/FilmBreakdownCard";
import { SeriesBreakdownCard } from "@/components/acting/SeriesBreakdownCard";
import { format, parseISO } from "date-fns";
import { FMPageScaffold } from "@/components/fm/FMPageScaffold";

export default function ActingCareer() {
  const { user } = useAuth();
  const userId = user?.id;
  const [neg, setNeg] = useState<{ offerId: string; baseCents: number; perEpisode: boolean; episodeCount: number; title: string } | null>(null);

  const { data: offers = [] } = useQuery({
    queryKey: ["acting-offers", userId],
    queryFn: async () => {
      const { data } = await supabase.from("pr_media_offers")
        .select("*").eq("user_id", userId)
        .in("media_type", ["film", "series"])
        .eq("status", "pending").order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!userId,
  });

  const { data: filmContracts = [] } = useQuery({
    queryKey: ["acting-contracts-films", userId],
    queryFn: async () => {
      const { data } = await supabase.from("player_film_contracts")
        .select("*").eq("user_id", userId).order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!userId,
  });

  const { data: seriesContracts = [] } = useQuery({
    queryKey: ["acting-contracts-series", userId],
    queryFn: async () => {
      const { data } = await supabase.from("player_series_contracts")
        .select("*, scripted_series(title, network_id), series_seasons(season_number, status, episodes_aired, episode_count, avg_viewers, critic_score, audience_score)")
        .eq("user_id", userId).order("joined_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!userId,
  });

  const { data: renewals = [] } = useQuery({
    queryKey: ["acting-renewals", userId],
    queryFn: async () => {
      const { data } = await supabase.from("series_renewal_offers")
        .select("*, scripted_series(title)")
        .eq("user_id", userId).eq("status", "pending");
      return data ?? [];
    },
    enabled: !!userId,
  });

  return (
    <FMPageScaffold
      title="Acting Career"
      subtitle="Films, scripted TV series, negotiations, sequel pipelines and weekly performance."
      icon={Film}
      backTo="/hub/career-business"
      backLabel="Back to Career & Business"
    >

      <Tabs defaultValue="offers" className="space-y-4">
        <TabsList className="flex flex-wrap">
          <TabsTrigger value="offers">
            Offers
            {(offers.length + renewals.length) > 0 && (
              <Badge variant="destructive" className="ml-2">{offers.length + renewals.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="films">My Films ({filmContracts.length})</TabsTrigger>
          <TabsTrigger value="series">My Series ({seriesContracts.length})</TabsTrigger>
        </TabsList>

        {/* ------- OFFERS TAB ------- */}
        <TabsContent value="offers" className="space-y-3">
          {renewals.map((r: any) => (
            <RenewalOfferCard key={r.id} renewal={r} />
          ))}
          {offers.length === 0 && renewals.length === 0 ? (
            <Card><CardContent className="p-8 text-center text-muted-foreground">
              No active acting offers. Build fame to attract more roles.
            </CardContent></Card>
          ) : null}
          {offers.map((o: any) => {
            const isSeries = o.media_type === "series";
            const baseCents = isSeries
              ? Number(o.pay_per_episode_cents ?? 0)
              : Number(o.base_pay_cents ?? Math.round((o.compensation ?? 0) * 100));
            const episodes = o.episode_count ?? 1;
            const title = o.outlet_name ?? o.show_name ?? (isSeries ? "TV Series" : "Film");
            return (
              <Card key={o.id} className="bg-gradient-to-r from-card to-primary/5">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div>
                      <CardTitle className="text-lg flex items-center gap-2">
                        {isSeries ? <Tv className="h-5 w-5" /> : <Film className="h-5 w-5" />}
                        {title}
                        {o.parent_film_id && <Badge variant="secondary">SEQUEL</Badge>}
                      </CardTitle>
                      <CardDescription className="capitalize">
                        {o.role_type ?? "cameo"} role · {isSeries ? `${episodes} episodes` : "Film"}
                      </CardDescription>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold">
                        ${(baseCents / 100).toLocaleString()}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {isSeries
                          ? `per ep · $${((baseCents * episodes) / 100).toLocaleString()} total`
                          : "base pay"}
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2 mb-3 text-xs">
                    {o.fame_boost ? (
                      <Badge variant="outline"><TrendingUp className="h-3 w-3 mr-1" />+{o.fame_boost} fame</Badge>
                    ) : null}
                    {o.fan_boost ? (
                      <Badge variant="outline"><Users className="h-3 w-3 mr-1" />+{o.fan_boost} fans</Badge>
                    ) : null}
                    {o.proposed_date ? (
                      <Badge variant="outline"><Calendar className="h-3 w-3 mr-1" />
                        {format(parseISO(o.proposed_date), "MMM d, yyyy")}
                      </Badge>
                    ) : null}
                  </div>
                  <Button onClick={() => setNeg({
                    offerId: o.id, baseCents, perEpisode: isSeries, episodeCount: episodes, title,
                  })}>
                    <Handshake className="h-4 w-4 mr-1" /> Negotiate / Accept
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>

        {/* ------- FILMS TAB ------- */}
        <TabsContent value="films" className="space-y-3">
          {filmContracts.length === 0 ? (
            <Card><CardContent className="p-8 text-center text-muted-foreground">No films yet.</CardContent></Card>
          ) : filmContracts.map((c: any) => <FilmBreakdownCard key={c.id} contract={c} />)}
        </TabsContent>

        {/* ------- SERIES TAB ------- */}
        <TabsContent value="series" className="space-y-3">
          {seriesContracts.length === 0 ? (
            <Card><CardContent className="p-8 text-center text-muted-foreground">No series contracts yet.</CardContent></Card>
          ) : seriesContracts.map((c: any) => <SeriesBreakdownCard key={c.id} contract={c} />)}
        </TabsContent>
      </Tabs>

      {neg && (
        <NegotiateOfferDialog
          open={!!neg} onOpenChange={(o) => !o && setNeg(null)}
          offerId={neg.offerId} baseCents={neg.baseCents}
          perEpisode={neg.perEpisode} episodeCount={neg.episodeCount} title={neg.title}
        />
      )}
    </div>
  );
}
