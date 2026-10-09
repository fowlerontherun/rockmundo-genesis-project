import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { GraduationCap, Music2, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveProfile } from "@/hooks/useActiveProfile";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TrackableSongPlayer } from "@/components/audio/TrackableSongPlayer";
import { LocalMayorColumn } from "@/components/news/LocalMayorColumn";

export function LocalDailyBrief() {
  const { profile, profileId } = useActiveProfile();
  const activeCityId = profile?.current_city_id ?? null;
  const [selectedCityId, setSelectedCityId] = useState<string | null>(null);
  const { data: location } = useQuery({
    queryKey: ["news-location", profileId, activeCityId],
    enabled: !!profileId,
    queryFn: async () => {
      const cityId = activeCityId;
      if (!cityId) return { cityId: undefined, city: undefined, country: undefined };
      const { data: city, error: cityError } = await supabase.from("cities")
        .select("id, name, country").eq("id", cityId).maybeSingle();
      if (cityError) throw cityError;
      return { cityId, city: city?.name, country: city?.country };
    },
  });

  const { data: cities = [] } = useQuery({
    queryKey: ["news-available-cities"],
    staleTime: 15 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.from("cities")
        .select("id, name, country").order("name").limit(2000);
      if (error) throw error;
      return data ?? [];
    },
  });
  const selectedCity = selectedCityId ? cities.find(city => city.id === selectedCityId) : undefined;
  const country = selectedCityId ? (selectedCity?.country ?? "") : (location?.country ?? "");
  const { data: charts = [], isLoading: chartsLoading, isError: chartsError } = useQuery({
    queryKey: ["news-country-top5", country],
    enabled: !!country,
    staleTime: 300_000,
    queryFn: async () => {
      const base = supabase.from("chart_entries");
      // Resolve the latest edition for this country, never a different country's chart.
      const { data: latest, error: latestError } = await base
        .select("chart_date")
        .eq("country", country)
        .in("chart_type", ["combined_single", "combined"])
        .order("chart_date", { ascending: false })
        .limit(1).maybeSingle();
      if (latestError) throw latestError;
      if (!latest?.chart_date) return [];
      const { data, error } = await supabase.from("chart_entries")
        .select("id, rank, song_id, chart_type, trend, trend_change, songs(title, audio_url, audio_generation_status, bands(name, artist_name))")
        .eq("country", country)
        .eq("chart_date", latest.chart_date)
        .in("chart_type", ["combined_single", "combined"])
        .order("rank", { ascending: true }).limit(60);
      if (error) throw error;
      const seen = new Set<string>();
      return (data ?? []).filter((row: any) => {
        if (!row.song_id || seen.has(row.song_id)) return false;
        seen.add(row.song_id);
        return true;
      }).slice(0, 5).map((row: any) => ({
        id: row.id, song_id: row.song_id, title: row.songs?.title || "Untitled",
        artist: row.songs?.bands?.artist_name || row.songs?.bands?.name || "Independent",
        audio_url: row.songs?.audio_url, audio_generation_status: row.songs?.audio_generation_status,
        trend: row.trend, trend_change: row.trend_change,
      }));
    },
  });
  const { data: visits = [], isError: visitsError } = useQuery({
    queryKey: ["news-active-professors"],
    staleTime: 300_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("active_professor_residencies")
        .select("id, university_id, name, skill_family, starts_at, ends_at")
        .order("ends_at", { ascending: true }).limit(10);
      if (error) throw error;
      const raw = (data ?? []) as Array<{
        id: string; university_id: string; name: string; skill_family: string;
        starts_at: string; ends_at: string;
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
        .select("id, display_name, created_at, current_city_id")
        .gte("created_at", since).order("created_at", { ascending: false }).limit(10);
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

  const { data: cityProjects = [] } = useQuery({
    queryKey: ["news-city-projects", location?.cityId],
    enabled: !!location?.cityId,
    staleTime: 300_000,
    queryFn: async () => {
      const since = new Date(Date.now() - 7 * 86400000).toISOString();
      const { data, error } = await supabase.from("city_projects")
        .select("id, name, status, completed_at, project_type:city_project_types(name, category)")
        .eq("city_id", location!.cityId!).eq("status", "completed")
        .gte("completed_at", since).order("completed_at", { ascending: false }).limit(6);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const { data: festivalUpgrades = [] } = useQuery({
    queryKey: ["news-festival-upgrades"],
    staleTime: 300_000,
    queryFn: async () => {
      const since = new Date(Date.now() - 7 * 86400000).toISOString();
      const { data, error } = await (supabase as any).from("festival_company_upgrades")
        .select("id, category_key, active_level, activated_at, festival_company_id")
        .eq("status", "active").gte("activated_at", since)
        .order("activated_at", { ascending: false }).limit(8);
      if (error) throw error;
      const upgrades = (data ?? []) as Array<{id:string;category_key:string;active_level:number;activated_at:string;festival_company_id:string}>;
      const ids = [...new Set(upgrades.map(row => row.festival_company_id))];
      if (!ids.length) return [];
      const { data: companies, error: companyError } = await (supabase as any)
        .from("festival_companies").select("id, name").in("id", ids);
      if (companyError) throw companyError;
      const names = new Map<string, string>((companies ?? []).map((row: any) => [row.id, row.name]));
      return upgrades.map(row => ({ ...row, companyName: names.get(row.festival_company_id) || "Festival company" }));
    },
  });

  const orderedVisits = [...visits].sort((a, b) => {
    const score = (v: typeof visits[number]) => {
      if (location?.city && v.universities?.city === location.city) return 2;
      return 0;
    };
    return score(b) - score(a) || new Date(a.ends_at).getTime() - new Date(b.ends_at).getTime();
  });

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <div className="lg:col-span-2"><LocalMayorColumn cityId={location?.cityId} cityName={location?.city} /></div>
      <details className="group border border-foreground/40 bg-card/60 p-4 lg:col-span-2">
        <summary className="mb-2 flex cursor-pointer items-center gap-2 font-serif text-xl font-black"><Music2 className="h-5 w-5" />
          Top 5 Songs — {country || "Choose a city"}
        </summary>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Chart city:</span>
          <Select value={selectedCityId || location?.cityId || ""} onValueChange={setSelectedCityId}>
            <SelectTrigger className="w-64" aria-label="Choose a city for the Top 5 chart">
              <SelectValue placeholder="Choose a city" />
            </SelectTrigger>
            <SelectContent>
              {location?.cityId && !cities.some(city => city.id === location.cityId) && location.city &&
                <SelectItem value={location.cityId}>{location.city} ({location.country})</SelectItem>}
              {cities.map(city => <SelectItem key={city.id} value={city.id}>{city.name} ({city.country})</SelectItem>)}
            </SelectContent>
          </Select>
          {selectedCityId && <button type="button" className="text-xs text-primary underline" onClick={() => setSelectedCityId(null)}>Use character's city</button>}
        </div>
        {!country && <p className="text-xs text-muted-foreground mb-2">{activeCityId ? "Loading your character’s city, or choose another city above." : "Your character has no current city. Choose one above to view its national chart."}</p>}
        {chartsError ? <p className="text-sm text-muted-foreground">National charts are temporarily unavailable.</p> : chartsLoading && country ? <p className="text-sm text-muted-foreground">Loading charts…</p> :
          charts.length ? (
            <ol className="divide-y divide-border/50">
              {charts.slice(0, 5).map((track, index) => (
                <li key={track.id} className="flex flex-wrap items-center gap-3 py-2 text-sm">
                  <strong className="w-7 font-mono">#{index + 1}</strong>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{track.title}</p>
                    <p className="text-xs text-muted-foreground">{track.artist} · {track.trend === "new" ? "New entry" : track.trend === "up" ? "▲" : track.trend === "down" ? "▼" : "—"} {track.trend_change || ""}</p>
                  </div>
                  {track.audio_url && <div className="w-full sm:w-60">
                    <TrackableSongPlayer songId={track.song_id} audioUrl={track.audio_url} title={track.title} artist={track.artist} generationStatus={track.audio_generation_status} compact source="country_charts" />
                  </div>}
                </li>
              ))}
            </ol>
          ) : <p className="text-sm text-muted-foreground">No chart entries available for this country yet.</p>}
        <Link className="mt-2 inline-block text-sm text-primary underline" to="/country-charts">View full country charts</Link>
      </details>
      {(orderedVisits.length > 0 || visitsError) && <details className="group border border-foreground/40 bg-card/60 p-4">
        <summary className="mb-2 flex cursor-pointer items-center gap-2 font-serif text-lg font-black"><GraduationCap className="h-5 w-5" /> Visiting Professors · +70% XP</summary>
        {visitsError ? <p className="text-sm text-muted-foreground">Professor information is temporarily unavailable.</p> :
          orderedVisits.length ? orderedVisits.map((v) => (
            <article key={v.id} className="border-b border-border/50 py-2 last:border-0">
              <p className="font-semibold">{v.name}{location?.city && v.universities?.city === location.city ? <span className="ml-2 text-xs font-semibold text-primary">In your city</span> : null}</p>
              <p className="text-sm">{v.skill_family.replace(/_/g, " ")} · {v.universities?.name || "University"}, {v.universities?.city || "Unknown city"}</p>
              <p className="text-xs text-muted-foreground">+70% attendance XP · Visiting {new Date(v.starts_at).toLocaleDateString()}–{new Date(v.ends_at).toLocaleDateString()}</p>
            </article>
          )) : <p className="text-sm text-muted-foreground">No visiting professors are active right now.</p>}
        <Link to="/career/education" className="mt-2 inline-block text-sm text-primary underline">Find professor courses at universities</Link>
      </details>}
      {festivalUpgrades.length > 0 && (
        <details className="group border border-foreground/40 bg-card/60 p-4">
          <summary className="mb-2 cursor-pointer font-serif text-lg font-black">Festival Business Improvements</summary>
          {festivalUpgrades.map(upgrade => (
            <article key={upgrade.id} className="border-b border-border/50 py-2 text-sm last:border-0">
              <p className="font-semibold">{upgrade.companyName}: {upgrade.category_key.replace(/_/g, " ")} upgraded to level {upgrade.active_level}</p>
              <p className="text-xs text-muted-foreground">Festival company improvement · {new Date(upgrade.activated_at).toLocaleDateString()}</p>
            </article>
          ))}
        </details>
      )}
      {cityProjects.length > 0 && (
        <details className="group border border-foreground/40 bg-card/60 p-4">
          <summary className="mb-2 cursor-pointer font-serif text-lg font-black">City Improvements — {location?.city}</summary>
          {cityProjects.map(project => (
            <article key={project.id} className="border-b border-border/50 py-2 text-sm last:border-0">
              <p className="font-semibold">{project.name} completed</p>
              <p className="text-xs text-muted-foreground">{project.project_type?.category?.replace(/_/g, " ") || "City development"} · {new Date(project.completed_at).toLocaleDateString()}</p>
            </article>
          ))}
        </details>
      )}
      {newCompanies.length > 0 && <details className="group border border-foreground/40 bg-card/60 p-4">
        <summary className="mb-2 cursor-pointer font-serif text-lg font-black">New Companies · Last 24 Hours</summary>
        {newCompanies.length ? newCompanies.map(company => (
          <article key={company.id} className="border-b border-border/50 py-2 text-sm last:border-0">
            <p className="font-semibold">{company.name}</p>
            <p className="text-xs text-muted-foreground">{company.company_type.replace(/_/g, " ")} · {company.headquarters_city?.name || "Location unlisted"}{company.headquarters_city?.country ? `, ${company.headquarters_city.country}` : ""}</p>
          </article>
        )) : null}
      </details>}
      {newcomers.length > 0 && <details className="group border border-foreground/40 bg-card/60 p-4">
        <summary className="mb-2 flex cursor-pointer items-center gap-2 font-serif text-lg font-black"><Users className="h-5 w-5" /> New Players · Last 24 Hours</summary>
        {newcomers.length ? newcomers.map((p) => (
          <article key={p.id} className="border-b border-border/50 py-2 text-sm last:border-0">
            <p className="font-semibold">{p.display_name || "New artist"}</p>
            <Link className="text-xs font-semibold text-primary underline" to={`/player/${p.id}`}>Say hi · View player</Link>
          </article>
        )) : null}
      </details>}
    </div>
  );
}
