import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth-context";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Film, Tv, Handshake, Users, TrendingUp, Calendar } from "lucide-react";
import { NegotiateOfferDialog } from "@/components/acting/NegotiateOfferDialog";
import { RenewalOfferCard } from "@/components/acting/RenewalOfferCard";
import { FilmBreakdownCard } from "@/components/acting/FilmBreakdownCard";
import { SeriesBreakdownCard } from "@/components/acting/SeriesBreakdownCard";
import { format, parseISO } from "date-fns";
import { FMPageScaffold } from "@/components/fm/FMPageScaffold";

type QueryNoticeProps = {
  label: string;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  retry: () => void;
};

function QueryNotice({ label, isLoading, isError, error, retry }: QueryNoticeProps) {
  if (isError) {
    return (
      <Card role="alert" className="border-destructive/50">
        <CardContent className="p-4 space-y-2">
          <p className="font-medium">Couldn't load {label}.</p>
          <p className="text-sm text-muted-foreground">
            {error instanceof Error ? error.message : "The server did not return a valid response."}
          </p>
          <Button variant="outline" size="sm" onClick={retry}>Retry {label}</Button>
        </CardContent>
      </Card>
    );
  }
  if (isLoading) {
    return (
      <Card aria-busy="true">
        <CardContent className="p-5 text-sm text-muted-foreground">Loading {label}...</CardContent>
      </Card>
    );
  }
  return null;
}

export default function ActingCareer() {
  const { user } = useAuth();
  const userId = user?.id;
  const { profileId, isLoading: profileLoading } = useActiveProfile();
  const canLoad = !!userId && !!profileId;
  const [neg, setNeg] = useState<{ offerId: string; baseCents: number; perEpisode: boolean; episodeCount: number; title: string } | null>(null);

  // Never keep an open negotiation dialog across a character/account change.
  useEffect(() => setNeg(null), [userId, profileId]);

  const offersQuery = useQuery({
    queryKey: ["acting-offers", userId, profileId],
    queryFn: async () => {
      const { data, error } = await supabase.from("pr_media_offers")
        .select("*").eq("user_id", userId)
        .in("media_type", ["film", "series"])
        .eq("status", "pending").order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: canLoad,
  });

  const filmContractsQuery = useQuery({
    queryKey: ["acting-contracts-films", userId, profileId],
    queryFn: async () => {
      const { data, error } = await supabase.from("player_film_contracts")
        .select("*").eq("user_id", userId).order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: canLoad,
  });

  const seriesContractsQuery = useQuery({
    queryKey: ["acting-contracts-series", userId, profileId],
    queryFn: async () => {
      const { data, error } = await supabase.from("player_series_contracts")
        .select("*, scripted_series(title, network_id), series_seasons(season_number, status, episodes_aired, episode_count, avg_viewers, critic_score, audience_score)")
        .eq("user_id", userId).order("joined_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: canLoad,
  });

  const renewalsQuery = useQuery({
    queryKey: ["acting-renewals", userId, profileId],
    queryFn: async () => {
      const { data, error } = await supabase.from("series_renewal_offers")
        .select("*, scripted_series(title)")
        .eq("user_id", userId).eq("status", "pending");
      if (error) throw error;
      return data ?? [];
    },
    enabled: canLoad,
  });

  const offers = offersQuery.data ?? [];
  const filmContracts = filmContractsQuery.data ?? [];
  const seriesContracts = seriesContractsQuery.data ?? [];
  const renewals = renewalsQuery.data ?? [];

  if (!userId || (!profileLoading && !profileId)) {
    return (
      <FMPageScaffold title="Acting Career" subtitle="Film and TV opportunities" icon={Film} backTo="/hub/career-business">
        <p className="text-sm text-muted-foreground">Select an active character to see acting opportunities.</p>
      </FMPageScaffold>
    );
  }

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
          <QueryNotice label="acting offers" isLoading={offersQuery.isLoading || !canLoad} isError={offersQuery.isError}
            error={offersQuery.error} retry={() => { void offersQuery.refetch(); }} />
          <QueryNotice label="renewal offers" isLoading={renewalsQuery.isLoading || !canLoad} isError={renewalsQuery.isError}
            error={renewalsQuery.error} retry={() => { void renewalsQuery.refetch(); }} />
          {renewals.map((r: any) => (
            <RenewalOfferCard key={r.id} renewal={r} />
          ))}
          {offersQuery.isSuccess && renewalsQuery.isSuccess && offers.length === 0 && renewals.length === 0 ? (
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
                  <Button disabled={!offersQuery.isSuccess || !renewalsQuery.isSuccess || !profileId} onClick={() => setNeg({
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
          <QueryNotice label="film contracts" isLoading={filmContractsQuery.isLoading || !canLoad} isError={filmContractsQuery.isError}
            error={filmContractsQuery.error} retry={() => { void filmContractsQuery.refetch(); }} />
          {filmContractsQuery.isSuccess && filmContracts.length === 0 ? (
            <Card><CardContent className="p-8 text-center text-muted-foreground">No films yet.</CardContent></Card>
          ) : filmContractsQuery.isSuccess && filmContracts.map((c: any) => <FilmBreakdownCard key={c.id} contract={c} />)}
        </TabsContent>

        {/* ------- SERIES TAB ------- */}
        <TabsContent value="series" className="space-y-3">
          <QueryNotice label="series contracts" isLoading={seriesContractsQuery.isLoading || !canLoad} isError={seriesContractsQuery.isError}
            error={seriesContractsQuery.error} retry={() => { void seriesContractsQuery.refetch(); }} />
          {seriesContractsQuery.isSuccess && seriesContracts.length === 0 ? (
            <Card><CardContent className="p-8 text-center text-muted-foreground">No series contracts yet.</CardContent></Card>
          ) : seriesContractsQuery.isSuccess && seriesContracts.map((c: any) => <SeriesBreakdownCard key={c.id} contract={c} />)}
        </TabsContent>
      </Tabs>

      {neg && profileId && offersQuery.isSuccess && renewalsQuery.isSuccess && (
        <NegotiateOfferDialog
          open={!!neg} onOpenChange={(o) => !o && setNeg(null)}
          offerId={neg.offerId} baseCents={neg.baseCents}
          perEpisode={neg.perEpisode} episodeCount={neg.episodeCount} title={neg.title}
        />
      )}
    </FMPageScaffold>
  );
}
