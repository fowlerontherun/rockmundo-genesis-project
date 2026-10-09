import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { GraduationCap, Music2, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { useCountryCharts } from "@/hooks/useCountryCharts";
import { TrackableSongPlayer } from "@/components/audio/TrackableSongPlayer";

export function LocalDailyBrief() {
  const { profileId } = useActiveProfile();
  const { data: location } = useQuery({
    queryKey: ["news-location", profileId],
    enabled: !!profileId,
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles")
        .select("current_city_id, cities(name, country)").eq("id", profileId!).maybeSingle();
      if (error) throw error;
      const city = (data as any)?.cities;
      return { city: city?.name as string | undefined, country: city?.country as string | undefined };
    },
  });

  const country = location?.country || "";
  const { data: charts = [], isLoading: chartsLoading } = useCountryCharts(
    country || "Global", "All", "combined", "single", "daily",
  );
  const { data: visits = [], isError: visitsError } = useQuery({
    queryKey: ["news-active-professors"],
    staleTime: 300_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("active_professor_residencies")
        .select("id, university_id, name, skill_family, ends_at")
        .order("ends_at", { ascending: true }).limit(10);
      if (error) throw error;
      const raw = (data ?? []) as Array<{
        id: string; university_id: string; name: string; skill_family: string;
        ends_at: string;
      }>;
      const ids = raw.map(v => v.university_id);
      if (!ids.length) return [];
      const { data: schools, error: schoolError } = await supabase.from("universities")
        .select("id, name, city").in("id", ids);
      if (schoolError) throw schoolError;
      const byId = new Map((schools ?? []).map(u => [u.id, u]));
      return raw.map(v => ({ ...v, universities: byId.get(v.university_id) ?? null }));
    },
  });
  const { data: newcomers = [] } = useQuery({
    queryKey: ["news-new-players"],
    queryFn: async () => {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase.from("profiles")
        .select("id, username, created_at, cities:current_city_id(name, country)")
        .gte("created_at", since).order("created_at", { ascending: false }).limit(8);
      if (error) throw error;
      return (data ?? []) as any[];
    },
    staleTime: 300_000,
  });

  const { data: newCompanies = [] } = useQuery({
    queryKey: ["news-new-companies"],
    queryFn: async () => {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase.from("companies")
        .select("id, name, company_type, created_at, headquarters_city:cities!headquarters_city_id(name, country)")
        .gte("created_at", since).eq("status", "active")
        .order("created_at", { ascending: false }).limit(8);
      if (error) throw error;
      return (data ?? []) as any[];
    },
    staleTime: 300_000,
  });

  const orderedVisits = [...visits].sort((a, b) => {
    const score = (v: typeof visits[number]) => {
      if (location?.city && v.universities?.city === location.city) return 2;
      return 0;
    };
    return score(b) - score(a);
  });

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <section className="border border-foreground/40 bg-card/60 p-4 lg:col-span-2">
        <h2 className="mb-2 flex items-center gap-2 font-serif text-xl font-black"><Music2 className="h-5 w-5" />
          Top 5 Songs — {country || "World"}
        </h2>
        {!country && <p className="text-xs text-muted-foreground mb-2">Travel to a city to see its national chart. Showing the global chart.</p>}
        {chartsLoading ? <p className="text-sm text-muted-foreground">Loading charts…</p> :
          charts.length ? (
            <ol className="divide-y divide-border/50">
              {charts.slice(0, 5).map((track, index) => (
                <li key={track.id} className="flex flex-wrap items-center gap-3 py-2 text-sm">
                  <strong className="w-7 font-mono">#{index + 1}</strong>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{track.title}</p>
                    <p className="text-xs text-muted-foreground">{track.artist} · {track.trend === "new" ? "New entry" : track.trend === "up" ? "▲" : track.trend === "down" ? "▼" : "—"} {track.trend_change || ""}</p>
                  </div>
                  {!track.is_fake && track.audio_url && <div className="w-full sm:w-60">
                    <TrackableSongPlayer songId={track.song_id} audioUrl={track.audio_url} title={track.title} artist={track.artist} generationStatus={track.audio_generation_status} compact source="country_charts" />
                  </div>}
                </li>
              ))}
            </ol>
          ) : <p className="text-sm text-muted-foreground">No chart entries available for this country yet.</p>}
        <Link className="mt-2 inline-block text-sm text-primary underline" to="/country-charts">View full country charts</Link>
      </section>
      <section className="border border-foreground/40 bg-card/60 p-4">
        <h2 className="mb-2 flex items-center gap-2 font-serif text-lg font-black"><GraduationCap className="h-5 w-5" /> Visiting Professors · +70% XP</h2>
        {visitsError ? <p className="text-sm text-muted-foreground">Professor information is temporarily unavailable.</p> :
          orderedVisits.length ? orderedVisits.map((v) => (
            <article key={v.id} className="border-b border-border/50 py-2 last:border-0">
              <p className="font-semibold">{v.name}</p>
              <p className="text-sm">{v.skill_family.replace(/_/g, " ")} · {v.universities?.name || "University"}, {v.universities?.city || "Unknown city"}</p>
              <p className="text-xs text-muted-foreground">+70% attendance XP · Until {new Date(v.ends_at).toLocaleDateString()}</p>
            </article>
          )) : <p className="text-sm text-muted-foreground">No visiting professors are active right now.</p>}
        <Link to="/career/education" className="mt-2 inline-block text-sm text-primary underline">Explore universities</Link>
      </section>
      <section className="border border-foreground/40 bg-card/60 p-4">
        <h2 className="mb-2 font-serif text-lg font-black">New Companies · Last 24 Hours</h2>
        {newCompanies.length ? newCompanies.map(company => (
          <article key={company.id} className="border-b border-border/50 py-2 text-sm last:border-0">
            <p className="font-semibold">{company.name}</p>
            <p className="text-xs text-muted-foreground">{company.company_type.replace(/_/g, " ")} · {company.headquarters_city?.name || "Location unlisted"}{company.headquarters_city?.country ? `, ${company.headquarters_city.country}` : ""}</p>
          </article>
        )) : <p className="text-sm text-muted-foreground">No new companies in the last 24 hours.</p>}
      </section>
      <section className="border border-foreground/40 bg-card/60 p-4">
        <h2 className="mb-2 flex items-center gap-2 font-serif text-lg font-black"><Users className="h-5 w-5" /> New Players · Last 24 Hours</h2>
        {newcomers.length ? newcomers.map((p) => (
          <article key={p.id} className="border-b border-border/50 py-2 text-sm last:border-0">
            <p className="font-semibold">{p.username || "New artist"}</p>
            <p className="text-xs text-muted-foreground">{p.cities?.name || "City not selected"}{p.cities?.country ? `, ${p.cities.country}` : ""}</p>
          </article>
        )) : <p className="text-sm text-muted-foreground">No new players in the last 24 hours.</p>}
      </section>
    </div>
  );
}
