import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Compass, Filter, Save, Search, X } from "lucide-react";
import { FMPageScaffold } from "@/components/fm/FMPageScaffold";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { useGameData } from "@/hooks/useGameData";
import { PlayerDiscoveryCard } from "@/features/player-discovery/components/PlayerDiscoveryCard";
import { usePlayerDiscovery, useSavedPlayerSearches } from "@/features/player-discovery/hooks/usePlayerDiscovery";
import { DEFAULT_SORT_BY_MODE, DISCOVERY_MODES, DISCOVERY_SORTS, normalizeDiscoveryQuery, recordRecentPlayerSearch, trackPlayerDiscoveryEvent, type DiscoveryMode, type DiscoverySort, type PlayerDiscoveryFilters } from "@/features/player-discovery/services/playerDiscovery";

const modeLabels: Record<DiscoveryMode, string> = { all: "All players", musicians: "Musicians", "band-recruitment": "Band recruitment", collaboration: "Collaboration", "session-work": "Session work", employment: "Employment", teaching: "Teaching", social: "Social", nearby: "Nearby", recommended: "Recommended" };
const sortLabels: Record<DiscoverySort, string> = { "best-match": "Best match", "recently-active": "Recently active", "online-now": "Online now", "highest-fame": "Highest fame", "career-level": "Career level", newest: "Newest players", name: "Name", "closest-city": "Closest city", "relevant-skill": "Most relevant skill", availability: "Availability" };
const filterKeys = ["city", "region", "instrument", "role", "genre", "careerLevel", "bandStatus", "employmentStatus"] as const;

export default function PlayerDiscovery() {
  const [params, setParams] = useSearchParams();
  const { profile } = useGameData();
  const initialMode = (params.get("mode") as DiscoveryMode) || "all";
  const [mode, setMode] = useState<DiscoveryMode>(DISCOVERY_MODES.includes(initialMode) ? initialMode : "all");
  const [search, setSearch] = useState(params.get("q") ?? "");
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  const [filters, setFilters] = useState<PlayerDiscoveryFilters>({ city: params.get("city") ?? undefined, instrument: params.get("instrument") ?? undefined, genre: params.get("genre") ?? undefined, role: params.get("role") ?? undefined });
  const [sort, setSort] = useState<DiscoverySort>((params.get("sort") as DiscoverySort) || DEFAULT_SORT_BY_MODE[mode]);
  const [view, setView] = useState<"grid" | "list">(() => (localStorage.getItem("rockmundo:player-discovery-view") as "grid" | "list") || "grid");
  const [page, setPage] = useState(1);
  const query = useMemo(() => normalizeDiscoveryQuery({ mode, search: debouncedSearch, filters, sort, page }), [mode, debouncedSearch, filters, sort, page]);
  const discovery = usePlayerDiscovery(query, profile?.id);
  const saved = useSavedPlayerSearches(profile?.id);

  useEffect(() => { const id = window.setTimeout(() => setDebouncedSearch(search), 350); return () => window.clearTimeout(id); }, [search]);
  useEffect(() => { localStorage.setItem("rockmundo:player-discovery-view", view); }, [view]);
  useEffect(() => { const next = new URLSearchParams(); if (mode !== "all") next.set("mode", mode); if (debouncedSearch) next.set("q", debouncedSearch); if (sort !== DEFAULT_SORT_BY_MODE[mode]) next.set("sort", sort); filterKeys.forEach((k) => { const v = filters[k]; if (v) next.set(k, String(v)); }); setParams(next, { replace: true }); recordRecentPlayerSearch({ mode, search: debouncedSearch, filters, sort, at: new Date().toISOString() }); trackPlayerDiscoveryEvent("search_completed", { mode, hasSearch: Boolean(debouncedSearch), filterCount: Object.values(filters).filter(Boolean).length }); }, [mode, debouncedSearch, filters, sort, setParams]);

  const setFilter = (key: keyof PlayerDiscoveryFilters, value: string) => { setPage(1); setFilters((f) => ({ ...f, [key]: value === "any" ? undefined : value })); };
  const clearAll = () => { setSearch(""); setFilters({}); setSort(DEFAULT_SORT_BY_MODE[mode]); setPage(1); };
  const activeFilters = Object.entries(filters).filter(([, v]) => v !== undefined && v !== false && v !== "");
  const filterPanel = <div className="space-y-3">
    {["city", "instrument", "role", "genre", "region", "careerLevel"].map((key) => <div key={key} className="space-y-1"><Label htmlFor={`filter-${key}`}>{key.replace(/([A-Z])/g, " $1")}</Label><Input id={`filter-${key}`} value={String(filters[key as keyof PlayerDiscoveryFilters] ?? "")} onChange={(e) => setFilter(key as keyof PlayerDiscoveryFilters, e.target.value)} placeholder="Any" /></div>)}
    <div className="space-y-1"><Label>Availability</Label><Select onValueChange={(v) => setFilter(v as keyof PlayerDiscoveryFilters, "true")}><SelectTrigger><SelectValue placeholder="Choose availability" /></SelectTrigger><SelectContent>{["lookingForBand", "lookingForMembers", "sessionAvailable", "collaborationAvailable", "employmentAvailable", "teachingAvailable", "socialAvailable", "onlineNow"].map((k) => <SelectItem key={k} value={k}>{k.replace(/([A-Z])/g, " $1")}</SelectItem>)}</SelectContent></Select></div>
    <Button variant="outline" className="w-full" onClick={clearAll}><X className="mr-2 h-4 w-4" />Clear all</Button>
  </div>;

  return <FMPageScaffold title="Player Discovery" subtitle="Search public-safe profiles for musicians, collaborators, employees, teachers and social contacts." icon={Compass} backTo="/social" backLabel="Back to Social">
    <div className="space-y-4">
      <div className="sticky top-0 z-10 rounded-lg border bg-background/95 p-3 backdrop-blur"><Label htmlFor="player-discovery-search" className="sr-only">Search players</Label><div className="flex gap-2"><Input id="player-discovery-search" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search name, band, instrument, genre, city, company or status…" /><Button aria-label="Search"><Search className="h-4 w-4" /></Button><Sheet><SheetTrigger asChild><Button variant="outline" className="lg:hidden"><Filter className="h-4 w-4" /></Button></SheetTrigger><SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto"><SheetHeader><SheetTitle>Discovery filters</SheetTitle></SheetHeader>{filterPanel}</SheetContent></Sheet></div></div>
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Discovery modes">{DISCOVERY_MODES.map((m) => <Button key={m} role="tab" variant={mode === m ? "default" : "outline"} size="sm" onClick={() => { setMode(m); setSort(DEFAULT_SORT_BY_MODE[m]); setPage(1); }}>{modeLabels[m]}</Button>)}</div>
      <div className="grid gap-4 lg:grid-cols-[280px_1fr]"><aside className="hidden lg:block"><Card><CardHeader><CardTitle>Filters</CardTitle></CardHeader><CardContent>{filterPanel}</CardContent></Card></aside><main className="space-y-3"><div className="flex flex-wrap items-center justify-between gap-2"><div className="flex flex-wrap gap-1" aria-live="polite"><Badge variant="secondary">{discovery.data?.approximateTotal == null ? "Privacy-safe results" : `About ${discovery.data.approximateTotal} results`}</Badge>{activeFilters.map(([k, v]) => <Badge key={k} variant="outline">{k}: {String(v)}</Badge>)}</div><div className="flex gap-2"><Select value={sort} onValueChange={(v) => setSort(v as DiscoverySort)}><SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger><SelectContent>{DISCOVERY_SORTS.map((s) => <SelectItem key={s} value={s}>{sortLabels[s]}</SelectItem>)}</SelectContent></Select><Button variant="outline" onClick={() => setView(view === "grid" ? "list" : "grid")}>{view === "grid" ? "List" : "Grid"}</Button><Button variant="outline" onClick={() => saved.saveSearch.mutate({ name: debouncedSearch || `${modeLabels[mode]} search`, discoveryMode: mode, searchQuery: debouncedSearch, filters, sortOrder: sort, alertsEnabled: false })}><Save className="mr-2 h-4 w-4" />Save</Button></div></div>
        {discovery.isLoading && <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3" aria-live="polite">{Array.from({ length: 6 }).map((_, i) => <Card key={i}><CardContent className="h-48 animate-pulse bg-muted/40" /></Card>)}</div>}
        {discovery.isError && <Card role="alert"><CardContent className="p-6 text-center text-destructive">Search unavailable. Please try again or clear restrictive filters.</CardContent></Card>}
        {!discovery.isLoading && !discovery.isError && discovery.data?.results.length === 0 && <Card><CardContent className="space-y-3 p-6 text-center"><p className="font-medium">No players matching all filters.</p><p className="text-sm text-muted-foreground">Try removing a restrictive filter, searching all cities, broadening the skill range or viewing all musicians.</p><Button onClick={clearAll}>Clear search</Button></CardContent></Card>}
        <div className={view === "grid" ? "grid gap-3 md:grid-cols-2 xl:grid-cols-3" : "space-y-3"}>{discovery.data?.results.map((p) => <PlayerDiscoveryCard key={p.id} player={p} view={view} onOpen={() => trackPlayerDiscoveryEvent(mode === "recommended" ? "recommendation_opened" : "result_profile_opened", { mode })} />)}</div>
        {discovery.data?.hasMore && <div className="text-center"><Button variant="outline" onClick={() => setPage((p) => p + 1)}>Next page</Button></div>}
      </main></div>
    </div>
  </FMPageScaffold>;
}
