import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Package, Music, Guitar, Sparkles, Search, ArrowLeft, Play, Pause, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { FMPageScaffold } from "@/components/fm/FMPageScaffold";

type Opening = {
  id: string;
  box_id: string;
  tier: string;
  rolled_at: string;
  xp_awarded: number;
  ap_awarded: number;
  instrument_id: string | null;
  song_id: string | null;
  reward_summary: { quality?: number; song?: string; instrument?: string } | null;
};
type Box = { id: string; name: string; theme_genre: string };
type Gear = { id: string; gear_name: string; gear_type: string; quality_rating: number; condition_rating: number | null; stat_boosts: any };
type Song = { id: string; title: string; genre: string; quality_score: number | null; audio_url: string | null };

const TIERS = ["common", "rare", "epic", "legendary"] as const;
const TIER_BADGE: Record<string, string> = {
  common: "bg-slate-500/20 text-slate-300 border-slate-500/40",
  rare: "bg-blue-500/20 text-blue-300 border-blue-500/40",
  epic: "bg-purple-500/20 text-purple-300 border-purple-500/40",
  legendary: "bg-amber-500/20 text-amber-300 border-amber-500/40",
};

export default function BlindBoxInventory() {
  const { profileId } = useActiveProfile();
  const [tierFilter, setTierFilter] = useState<string[]>([]);
  const [boxFilter, setBoxFilter] = useState("all");
  const [quality, setQuality] = useState<[number, number]>([0, 100]);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"new" | "old" | "quality" | "tier">("new");
  const [playing, setPlaying] = useState<string | null>(null);

  const { data: boxes = [] } = useQuery({
    queryKey: ["blind-boxes-meta-inv"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("blind_boxes" as any)
        .select("id, name, theme_genre");
      if (error) throw error;
      return (data ?? []) as unknown as Box[];
    },
  });

  const { data: openings = [], isLoading } = useQuery({
    queryKey: ["blind-box-inventory", profileId],
    enabled: !!profileId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("blind_box_openings" as any)
        .select("id, box_id, tier, rolled_at, xp_awarded, ap_awarded, instrument_id, song_id, reward_summary")
        .eq("profile_id", profileId!)
        .order("rolled_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return (data ?? []) as unknown as Opening[];
    },
  });

  const instrumentIds = openings.map((o) => o.instrument_id).filter(Boolean) as string[];
  const songIds = openings.map((o) => o.song_id).filter(Boolean) as string[];

  const { data: gear = [] } = useQuery({
    queryKey: ["blind-box-gear", instrumentIds],
    enabled: instrumentIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("player_personal_gear" as any)
        .select("id, gear_name, gear_type, quality_rating, condition_rating, stat_boosts")
        .in("id", instrumentIds);
      if (error) throw error;
      return (data ?? []) as unknown as Gear[];
    },
  });

  const { data: songs = [] } = useQuery({
    queryKey: ["blind-box-songs", songIds],
    enabled: songIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("songs")
        .select("id, title, genre, quality_score, audio_url")
        .in("id", songIds);
      if (error) throw error;
      return (data ?? []) as unknown as Song[];
    },
  });

  const gearMap = new Map(gear.map((g) => [g.id, g]));
  const songMap = new Map(songs.map((s) => [s.id, s]));
  const boxMap = new Map(boxes.map((b) => [b.id, b]));

  const enriched = useMemo(() => {
    return openings.map((o) => {
      const g = o.instrument_id ? gearMap.get(o.instrument_id) : undefined;
      const s = o.song_id ? songMap.get(o.song_id) : undefined;
      const b = boxMap.get(o.box_id);
      const q = Number(o.reward_summary?.quality ?? s?.quality_score ?? g?.quality_rating ?? 0);
      return { o, g, s, b, q };
    });
  }, [openings, gear, songs, boxes]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let arr = enriched.filter((e) => {
      if (tierFilter.length > 0 && !tierFilter.includes(e.o.tier)) return false;
      if (boxFilter !== "all" && e.o.box_id !== boxFilter) return false;
      if (e.q < quality[0] || e.q > quality[1]) return false;
      if (q) {
        const hay = `${e.s?.title ?? ""} ${e.g?.gear_name ?? ""} ${e.b?.name ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    const tierRank: Record<string, number> = { legendary: 3, epic: 2, rare: 1, common: 0 };
    arr.sort((a, b) => {
      switch (sort) {
        case "old": return +new Date(a.o.rolled_at) - +new Date(b.o.rolled_at);
        case "quality": return b.q - a.q;
        case "tier": return (tierRank[b.o.tier] ?? 0) - (tierRank[a.o.tier] ?? 0);
        default: return +new Date(b.o.rolled_at) - +new Date(a.o.rolled_at);
      }
    });
    return arr;
  }, [enriched, tierFilter, boxFilter, quality, search, sort]);

  const togglePlay = (id: string) => {
    const audio = document.getElementById(`audio-${id}`) as HTMLAudioElement | null;
    if (!audio) return;
    if (playing === id) { audio.pause(); setPlaying(null); }
    else {
      document.querySelectorAll<HTMLAudioElement>("audio[id^='audio-']").forEach((a) => a.pause());
      audio.play().catch(() => {});
      setPlaying(id);
    }
  };

  const counts = TIERS.reduce<Record<string, number>>((acc, t) => {
    acc[t] = enriched.filter((e) => e.o.tier === t).length;
    return acc;
  }, {});

  return (
    <FMPageScaffold
      title="Loot Inventory"
      subtitle="Every instrument and song you've unboxed — filter by tier and quality."
      icon={Package}
      backTo="/blind-boxes"
      backLabel="Back to Store"
      headerActions={
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to="/blind-boxes/analytics"><BarChart3 className="h-4 w-4 mr-1" /> Analytics</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link to="/blind-boxes"><ArrowLeft className="h-4 w-4 mr-1" /> Store</Link>
          </Button>
        </div>
      }
    >


      <Card>
        <CardContent className="p-3 space-y-3">
          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search loot…"
                className="h-8 pl-7 text-xs"
              />
            </div>
            <Select value={boxFilter} onValueChange={setBoxFilter}>
              <SelectTrigger className="h-8 w-[150px] text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All boxes</SelectItem>
                {boxes.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={sort} onValueChange={(v) => setSort(v as any)}>
              <SelectTrigger className="h-8 w-[130px] text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="new">Newest</SelectItem>
                <SelectItem value="old">Oldest</SelectItem>
                <SelectItem value="quality">Quality</SelectItem>
                <SelectItem value="tier">Tier</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <ToggleGroup
              type="multiple"
              value={tierFilter}
              onValueChange={setTierFilter}
              className="flex-wrap"
            >
              {TIERS.map((t) => (
                <ToggleGroupItem key={t} value={t} className="h-7 text-[10px] capitalize">
                  {t} <span className="ml-1 opacity-60">{counts[t]}</span>
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            <div className="flex items-center gap-2 min-w-[220px] flex-1">
              <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                Quality {quality[0]}–{quality[1]}
              </span>
              <Slider
                min={0}
                max={100}
                step={5}
                value={quality}
                onValueChange={(v) => setQuality([v[0], v[1]] as [number, number])}
                className="flex-1"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">All ({filtered.length})</TabsTrigger>
          <TabsTrigger value="instruments">
            <Guitar className="h-3.5 w-3.5 mr-1" /> Instruments
          </TabsTrigger>
          <TabsTrigger value="songs">
            <Music className="h-3.5 w-3.5 mr-1" /> Songs
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all">
          <Grid items={filtered} playing={playing} onPlay={togglePlay} loading={isLoading} mode="all" />
        </TabsContent>
        <TabsContent value="instruments">
          <Grid items={filtered.filter((e) => e.g)} playing={playing} onPlay={togglePlay} loading={isLoading} mode="instruments" />
        </TabsContent>
        <TabsContent value="songs">
          <Grid items={filtered.filter((e) => e.s)} playing={playing} onPlay={togglePlay} loading={isLoading} mode="songs" />
        </TabsContent>
      </Tabs>
    </FMPageScaffold>
  );
}

function Grid({
  items, playing, onPlay, loading, mode,
}: {
  items: Array<{ o: Opening; g?: Gear; s?: Song; b?: Box; q: number }>;
  playing: string | null;
  onPlay: (id: string) => void;
  loading: boolean;
  mode: "all" | "instruments" | "songs";
}) {
  if (loading) return <p className="text-sm text-muted-foreground py-6 text-center">Loading…</p>;
  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          <Package className="mx-auto h-8 w-8 mb-2 opacity-60" />
          No loot matches these filters.
        </CardContent>
      </Card>
    );
  }
  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((e) => (
        <Card key={e.o.id} className="overflow-hidden">
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between gap-2">
              <CardTitle className="text-sm leading-tight">
                {mode === "songs" ? e.s?.title : mode === "instruments" ? e.g?.gear_name : (e.s?.title ?? e.g?.gear_name ?? "Loot")}
              </CardTitle>
              <Badge className={cn("text-[10px] capitalize border", TIER_BADGE[e.o.tier])} variant="outline">
                {e.o.tier}
              </Badge>
            </div>
            <div className="text-[10px] text-muted-foreground flex flex-wrap gap-x-2">
              <span>{e.b?.name ?? "—"}</span>
              <span>·</span>
              <span>{new Date(e.o.rolled_at).toLocaleDateString()}</span>
            </div>
          </CardHeader>
          <CardContent className="pt-0 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1 text-amber-300">
                <Sparkles className="h-3 w-3" /> Q{e.q}
              </span>
              <span className="text-[10px] text-muted-foreground">
                +{e.o.xp_awarded} XP · +{e.o.ap_awarded} AP
              </span>
            </div>

            {mode !== "songs" && e.g && (
              <div className="rounded-md border bg-muted/30 p-2 text-xs">
                <div className="flex items-center gap-1 font-medium">
                  <Guitar className="h-3 w-3" /> {e.g.gear_name}
                </div>
                <div className="text-[10px] text-muted-foreground capitalize">
                  {e.g.gear_type} · Cond {e.g.condition_rating ?? 100}
                </div>
              </div>
            )}

            {mode !== "instruments" && e.s && (
              <div className="rounded-md border bg-muted/30 p-2 text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1 font-medium">
                    <Music className="h-3 w-3" /> {e.s.title}
                  </div>
                  {e.s.audio_url && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
                      onClick={() => onPlay(e.o.id)}
                    >
                      {playing === e.o.id ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                    </Button>
                  )}
                </div>
                <div className="text-[10px] text-muted-foreground capitalize">{e.s.genre}</div>
                {e.s.audio_url && (
                  <audio
                    id={`audio-${e.o.id}`}
                    src={e.s.audio_url}
                    preload="none"
                    className="w-full h-6"
                    controls={false}
                  />
                )}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
