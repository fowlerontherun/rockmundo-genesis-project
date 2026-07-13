import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Globe2, MapPin, Plane, Radio, Search, Star } from "lucide-react";

import HubLayout from "@/components/hub/HubLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageErrorState, PageLoadingState } from "@/components/ui/page-state";
import { PresenceDirectoryPanel } from "@/components/presence/PresenceDirectoryPanel";
import { worldHubNavigation } from "@/config/hubNavigation";
import { useGameData } from "@/hooks/useGameData";
import { useTravelStatus } from "@/hooks/useTravelStatus";
import { supabase } from "@/integrations/supabase/client";

const fmtDate = (value?: string | null) => (value ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : null);

export default function WorldOverview() {
  const { currentCity, loading: gameDataLoading } = useGameData();
  const { travelStatus, isLoading: travelLoading } = useTravelStatus();
  const currentCityId = currentCity?.id ?? travelStatus?.current_city_id ?? null;

  const localQuery = useQuery({
    queryKey: ["world-overview-local", currentCityId],
    enabled: !!currentCityId,
    queryFn: async () => {
      const [venues, studios, companies, festivals, gigs] = await Promise.all([
        supabase.from("venues").select("id,name,capacity,reputation").eq("city_id", currentCityId).order("reputation", { ascending: false }).limit(4),
        (supabase as any).from("city_studios").select("id,name,quality_rating,cost_per_day").eq("city_id", currentCityId).order("quality_rating", { ascending: false }).limit(4),
        (supabase as any).from("companies").select("id,name,company_type,reputation_score").eq("headquarters_city_id", currentCityId).order("reputation_score", { ascending: false }).limit(4),
        (supabase as any).from("festivals").select("id,name,start_date,status").eq("city_id", currentCityId).gte("start_date", new Date().toISOString()).order("start_date", { ascending: true }).limit(4),
        (supabase as any).from("gigs").select("id,venue_name,scheduled_date,status,bands(name)").eq("city_id", currentCityId).gte("scheduled_date", new Date().toISOString()).order("scheduled_date", { ascending: true }).limit(4),
      ]);
      const firstError = venues.error || studios.error || companies.error || festivals.error || gigs.error;
      if (firstError) throw firstError;
      return { venues: venues.data ?? [], studios: studios.data ?? [], companies: companies.data ?? [], festivals: festivals.data ?? [], gigs: gigs.data ?? [] };
    },
  });

  const citiesQuery = useQuery({
    queryKey: ["world-overview-featured-cities"],
    queryFn: async () => {
      const { data, error } = await supabase.from("cities").select("id,name,country,music_scene,population").order("music_scene", { ascending: false }).limit(4);
      if (error) throw error;
      return data ?? [];
    },
  });

  const actions = [
    { label: "Travel", path: "/world/travel", icon: Plane },
    { label: "Browse cities", path: "/world/cities", icon: Search, variant: "secondary" as const },
    { label: "World Pulse", path: "/world/pulse", icon: Radio, variant: "outline" as const },
  ];
  const isLoading = gameDataLoading || travelLoading || (!!currentCityId && localQuery.isLoading) || citiesQuery.isLoading;
  const error = localQuery.error || citiesQuery.error;
  const cityName = currentCity?.name ?? travelStatus?.current_city_name ?? null;

  return (
    <HubLayout title="World" description="Understand where you are, what is nearby, where you can travel, and what is happening across RockMundo." icon={Globe2} overviewPath="/world" navigation={worldHubNavigation} actions={actions}>
      {isLoading ? <PageLoadingState title="Loading World" description="Checking your location, travel status and local discovery." /> : null}
      {error ? <PageErrorState title="World data could not be loaded" description="The hub is still available; retry to reload local discovery cards." onRetry={() => { void localQuery.refetch(); void citiesQuery.refetch(); }} /> : null}
      {!isLoading && !error ? (
        <div className="space-y-4">
          <PresenceDirectoryPanel cityId={currentCityId} title={cityName ? `${cityName} live population` : "Live population"} />
          <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><MapPin className="h-5 w-5" /> Current location</CardTitle><CardDescription>Authoritative profile location and current travel state.</CardDescription></CardHeader>
              <CardContent className="space-y-3">
                {cityName ? <><div className="text-2xl font-bold">{cityName}</div><p className="text-sm text-muted-foreground">{currentCity?.country ?? "Current city"}</p></> : <p className="text-sm text-muted-foreground">No valid current city is available. Open Travel or Cities to recover using existing location flows.</p>}
                {travelStatus?.is_traveling ? <div className="rounded-lg border p-3" role="status"><Badge>Travelling</Badge><p className="mt-2 font-medium">Destination: {travelStatus.destination_city_name ?? "Unknown destination"}</p><p className="text-sm text-muted-foreground">Arrives {fmtDate(travelStatus.travel_arrives_at) ?? "at the scheduled arrival time"}{travelStatus.transport_type ? ` · ${travelStatus.transport_type}` : ""}</p></div> : <Badge variant="secondary">Not travelling</Badge>}
                <div className="flex flex-wrap gap-2"><Button asChild size="sm"><Link to={currentCityId ? `/world/cities/${currentCityId}` : "/world/cities"}>View current city</Link></Button><Button asChild size="sm" variant="outline"><Link to="/world/travel">Plan travel</Link></Button></div>
              </CardContent>
            </Card>
            <Card><CardHeader><CardTitle>Quick actions</CardTitle><CardDescription>Safe links into existing world systems.</CardDescription></CardHeader><CardContent className="grid gap-2 sm:grid-cols-2">{worldHubNavigation.filter(i => i.id !== "overview").slice(0,8).map(i => <Button key={i.id} asChild variant="outline" className="justify-start"><Link to={i.path}>{i.label}</Link></Button>)}</CardContent></Card>
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            <ListCard title="Nearby venues" items={localQuery.data?.venues} href="/world/venues" render={(v:any)=><><span>{v.name}</span><Badge variant="outline">{v.capacity ?? "—"} cap</Badge></>} />
            <ListCard title="Nearby studios" items={localQuery.data?.studios} href="/world/studios" render={(s:any)=><><span>{s.name}</span><Badge variant="outline">Q{s.quality_rating ?? "—"}</Badge></>} />
            <ListCard title="Local companies" items={localQuery.data?.companies} href="/world/companies" render={(c:any)=><><span>{c.name}</span><Badge variant="outline">{String(c.company_type ?? "company").replace(/_/g," ")}</Badge></>} />
            <ListCard title="Upcoming local gigs" items={localQuery.data?.gigs} href="/world/events" render={(g:any)=><><span>{g.bands?.name ?? g.venue_name ?? "Gig"}</span><Badge variant="outline">{fmtDate(g.scheduled_date) ?? g.status}</Badge></>} />
            <ListCard title="Upcoming festivals" items={localQuery.data?.festivals} href="/world/festivals" render={(f:any)=><><span>{f.name}</span><Badge variant="outline">{fmtDate(f.start_date) ?? f.status}</Badge></>} />
            <ListCard title="Featured cities" items={citiesQuery.data} href="/world/cities" render={(c:any)=><><span>{c.name}, {c.country}</span><Badge variant="outline"><Star className="mr-1 h-3 w-3" />{c.music_scene}</Badge></>} />
          </div>
        </div>
      ) : null}
    </HubLayout>
  );
}

function ListCard({ title, items, href, render }: { title: string; items?: any[]; href: string; render: (item: any) => ReactNode }) {
  return <Card><CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader><CardContent className="space-y-3"><ul className="space-y-2">{items?.length ? items.map((item) => <li key={item.id} className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm">{render(item)}</li>) : <li className="text-sm text-muted-foreground">Nothing nearby to show yet.</li>}</ul><Button asChild size="sm" variant="secondary"><Link to={href}>Open {title}</Link></Button></CardContent></Card>;
}
