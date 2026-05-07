import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageLayout } from "@/components/ui/PageLayout";
import { PageHeader } from "@/components/ui/PageHeader";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { MapPin, Music2, Coins, Sparkles, Disc3, Beer, GraduationCap, Trees, Building2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Landmark {
  id: string;
  city_id: string;
  slug: string;
  name: string;
  kind: "record_store" | "dive_bar" | "rehearsal_space" | "park" | "recording_school";
  description: string;
  map_x: number;
  map_y: number;
  base_fame_reward: number;
  base_cash_reward: number;
}
interface Visit {
  id: string;
  landmark_id: string;
  event_kind: string;
  event_summary: string;
  cash_delta: number;
  fame_delta: number;
  visited_at: string;
}
interface BuskingSession {
  id: string;
  landmark_id: string | null;
  city_id: string;
  duration_minutes: number;
  crowd_size: number;
  tips_earned: number;
  fame_gained: number;
  vibe: string;
  played_at: string;
}

const KIND_META: Record<Landmark["kind"], { icon: typeof Disc3; color: string; label: string }> = {
  record_store:    { icon: Disc3,         color: "text-pink-400",   label: "Record Store" },
  dive_bar:        { icon: Beer,          color: "text-amber-400",  label: "Dive Bar" },
  rehearsal_space: { icon: Building2,     color: "text-blue-400",   label: "Rehearsal" },
  park:            { icon: Trees,         color: "text-green-400",  label: "Park" },
  recording_school:{ icon: GraduationCap, color: "text-purple-400", label: "School" },
};

const EVENT_POOLS: Record<Landmark["kind"], { kind: string; summary: string; cashMul: number; fameMul: number }[]> = {
  record_store: [
    { kind: "rare_find",    summary: "You unearthed a sealed first pressing in the bargain bin.", cashMul: 1.5, fameMul: 1.0 },
    { kind: "clerk_chat",   summary: "The clerk recognized your name and slipped you a free 7-inch.", cashMul: 0.6, fameMul: 1.4 },
    { kind: "dud",          summary: "Just dust and Christmas albums today.", cashMul: 0, fameMul: 0 },
  ],
  dive_bar: [
    { kind: "open_mic",     summary: "You jumped on the open mic and the regulars actually listened.", cashMul: 1.2, fameMul: 1.6 },
    { kind: "drink_offer",  summary: "Someone bought you a round and a name-drop.", cashMul: 0.8, fameMul: 1.2 },
    { kind: "fight",        summary: "A scuffle broke out — you ducked out before it got messy.", cashMul: 0, fameMul: 0 },
  ],
  rehearsal_space: [
    { kind: "free_room",    summary: "A cancellation freed up the live room for an hour.", cashMul: 0.4, fameMul: 0.8 },
    { kind: "loud_neighbor",summary: "The metalheads next door drowned out your session.", cashMul: 0, fameMul: 0 },
    { kind: "tone_unlock",  summary: "You finally dialed in that tone you've been chasing.", cashMul: 0.2, fameMul: 1.4 },
  ],
  park: [
    { kind: "tourist_crowd",summary: "Tour buses unloaded right as you started playing.", cashMul: 1.8, fameMul: 1.4 },
    { kind: "rain",         summary: "Rain rolled in and the crowd vanished.", cashMul: 0, fameMul: 0 },
    { kind: "dog_walker",   summary: "A friendly dog walker stopped to listen and tipped well.", cashMul: 1.2, fameMul: 0.8 },
  ],
  recording_school: [
    { kind: "guest_lecture",summary: "A professor invited you to demo for the songwriting class.", cashMul: 0.6, fameMul: 1.8 },
    { kind: "studio_slot",  summary: "You snagged a discounted student studio slot.", cashMul: 0.8, fameMul: 1.0 },
    { kind: "intern",       summary: "An eager intern asked to assist on your next session.", cashMul: 0.2, fameMul: 1.2 },
  ],
};

function rollEvent(landmark: Landmark) {
  const pool = EVENT_POOLS[landmark.kind];
  const ev = pool[Math.floor(Math.random() * pool.length)];
  return {
    event_kind: ev.kind,
    event_summary: ev.summary,
    cash_delta: Math.round(landmark.base_cash_reward * ev.cashMul),
    fame_delta: Math.round(landmark.base_fame_reward * ev.fameMul),
  };
}

const BUSKING_DURATIONS = [
  { mins: 15, label: "Quick set (15m)" },
  { mins: 30, label: "Standard set (30m)" },
  { mins: 60, label: "Long set (1h)" },
] as const;

function rollBusking(landmark: Landmark, duration: number) {
  // Crowd 0-50 with park/dive_bar bias
  const base = landmark.kind === "park" ? 25 : landmark.kind === "dive_bar" ? 18 : 8;
  const crowd = Math.max(0, Math.round(base + (Math.random() - 0.3) * 20));
  const minutesFactor = duration / 30;
  const tips = Math.round(crowd * (5 + Math.random() * 10) * minutesFactor);
  const fame = Math.max(1, Math.round((crowd / 6) * minutesFactor));
  const vibe = crowd >= 30 ? "great" : crowd >= 15 ? "okay" : crowd > 0 ? "thin" : "empty";
  return { crowd_size: crowd, tips_earned: tips, fame_gained: fame, vibe };
}

export default function CityLandmarks() {
  const { profileId } = useActiveProfile();
  const queryClient = useQueryClient();
  const [cityId, setCityId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Landmark | null>(null);
  const [busking, setBusking] = useState<{ landmark: Landmark; duration: number } | null>(null);

  const { data: cities = [] } = useQuery({
    queryKey: ["tier1-cities"],
    queryFn: async () => {
      const { data } = await supabase
        .from("cities")
        .select("id, name, country, population")
        .order("population", { ascending: false })
        .limit(20);
      return data ?? [];
    },
  });

  useEffect(() => {
    if (!cityId && cities.length) setCityId(cities[0].id);
  }, [cities, cityId]);

  const { data: landmarks = [], isLoading: loadingLandmarks } = useQuery({
    queryKey: ["landmarks", cityId],
    queryFn: async () => {
      if (!cityId) return [];
      const { data } = await (supabase as any)
        .from("city_landmarks")
        .select("*")
        .eq("city_id", cityId);
      return (data ?? []) as Landmark[];
    },
    enabled: !!cityId,
  });

  const { data: recentVisits = [] } = useQuery({
    queryKey: ["landmark-visits", profileId],
    queryFn: async () => {
      if (!profileId) return [];
      const { data } = await (supabase as any)
        .from("landmark_visits")
        .select("*")
        .eq("profile_id", profileId)
        .order("visited_at", { ascending: false })
        .limit(20);
      return (data ?? []) as Visit[];
    },
    enabled: !!profileId,
  });

  const { data: recentBusking = [] } = useQuery({
    queryKey: ["busking-sessions", profileId],
    queryFn: async () => {
      if (!profileId) return [];
      const { data } = await (supabase as any)
        .from("busking_sessions")
        .select("*")
        .eq("profile_id", profileId)
        .order("played_at", { ascending: false })
        .limit(15);
      return (data ?? []) as BuskingSession[];
    },
    enabled: !!profileId,
  });

  const visitMutation = useMutation({
    mutationFn: async (landmark: Landmark) => {
      if (!profileId) throw new Error("No active character");
      const ev = rollEvent(landmark);
      const { data, error } = await (supabase as any)
        .from("landmark_visits")
        .insert({ profile_id: profileId, landmark_id: landmark.id, ...ev })
        .select()
        .single();
      if (error) throw error;
      // apply cash/fame to profile
      if (ev.cash_delta || ev.fame_delta) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("cash, fame")
          .eq("id", profileId)
          .single();
        if (prof) {
          await supabase
            .from("profiles")
            .update({
              cash: Math.max(0, (prof.cash ?? 0) + ev.cash_delta),
              fame: Math.max(0, (prof.fame ?? 0) + ev.fame_delta),
            })
            .eq("id", profileId);
        }
      }
      return data as Visit;
    },
    onSuccess: (visit) => {
      queryClient.invalidateQueries({ queryKey: ["landmark-visits", profileId] });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast.success(visit.event_summary, {
        description: `${visit.cash_delta >= 0 ? "+" : ""}$${visit.cash_delta} • ${visit.fame_delta >= 0 ? "+" : ""}${visit.fame_delta} fame`,
      });
    },
    onError: (err: any) => toast.error(err.message),
  });

  const buskingMutation = useMutation({
    mutationFn: async ({ landmark, duration }: { landmark: Landmark; duration: number }) => {
      if (!profileId) throw new Error("No active character");
      const result = rollBusking(landmark, duration);
      const { data, error } = await (supabase as any)
        .from("busking_sessions")
        .insert({
          profile_id: profileId,
          landmark_id: landmark.id,
          city_id: landmark.city_id,
          duration_minutes: duration,
          ...result,
        })
        .select()
        .single();
      if (error) throw error;
      if (result.tips_earned || result.fame_gained) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("cash, fame")
          .eq("id", profileId)
          .single();
        if (prof) {
          await supabase
            .from("profiles")
            .update({
              cash: (prof.cash ?? 0) + result.tips_earned,
              fame: (prof.fame ?? 0) + result.fame_gained,
            })
            .eq("id", profileId);
        }
      }
      return data as BuskingSession;
    },
    onSuccess: (s) => {
      queryClient.invalidateQueries({ queryKey: ["busking-sessions", profileId] });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast.success(`Crowd: ${s.crowd_size} • Vibe: ${s.vibe}`, {
        description: `+$${s.tips_earned} tips • +${s.fame_gained} fame`,
      });
      setBusking(null);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const visitsByLandmark = useMemo(() => {
    const map: Record<string, number> = {};
    recentVisits.forEach((v) => { map[v.landmark_id] = (map[v.landmark_id] ?? 0) + 1; });
    return map;
  }, [recentVisits]);

  const selectedCity = cities.find((c: any) => c.id === cityId);

  return (
    <PageLayout>
      <PageHeader
        icon={MapPin}
        title="City Landmarks"
        subtitle="Tier-1 cities, hand-curated. Click a pin to visit, or busk for tips."
        actions={
          <Select value={cityId ?? ""} onValueChange={setCityId}>
            <SelectTrigger className="h-8 w-[200px] text-xs">
              <SelectValue placeholder="Pick a city" />
            </SelectTrigger>
            <SelectContent>
              {cities.map((c: any) => (
                <SelectItem key={c.id} value={c.id} className="text-xs">
                  {c.name}, {c.country}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />

      <div className="grid lg:grid-cols-[1fr_320px] gap-3">
        {/* MAP */}
        <Card>
          <CardHeader className="p-3 pb-2">
            <CardTitle className="text-sm flex items-center justify-between">
              <span className="flex items-center gap-2">
                <MapPin className="h-4 w-4" /> {selectedCity?.name ?? "—"}
              </span>
              <Badge variant="secondary" className="text-[10px]">{landmarks.length} landmarks</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3">
            <div className="relative w-full aspect-[4/3] rounded-md border bg-gradient-to-br from-muted/40 via-card to-muted/20 overflow-hidden">
              {/* faux streets */}
              <div className="absolute inset-0 opacity-30 pointer-events-none">
                <div className="absolute top-1/3 left-0 right-0 h-px bg-foreground/20" />
                <div className="absolute top-2/3 left-0 right-0 h-px bg-foreground/20" />
                <div className="absolute left-1/4 top-0 bottom-0 w-px bg-foreground/20" />
                <div className="absolute left-3/4 top-0 bottom-0 w-px bg-foreground/20" />
              </div>
              {loadingLandmarks && (
                <div className="absolute inset-0 grid place-items-center">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              )}
              {landmarks.map((l) => {
                const meta = KIND_META[l.kind];
                const Icon = meta.icon;
                const visited = visitsByLandmark[l.id] ?? 0;
                return (
                  <button
                    key={l.id}
                    onClick={() => setSelected(l)}
                    className={cn(
                      "absolute -translate-x-1/2 -translate-y-1/2 group flex flex-col items-center gap-1",
                      "hover:scale-110 transition-transform"
                    )}
                    style={{ left: `${l.map_x}%`, top: `${l.map_y}%` }}
                  >
                    <div className={cn(
                      "h-9 w-9 rounded-full border-2 border-background bg-card shadow-md grid place-items-center",
                      visited > 0 && "ring-2 ring-primary/60"
                    )}>
                      <Icon className={cn("h-4 w-4", meta.color)} />
                    </div>
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-background/80 backdrop-blur whitespace-nowrap max-w-[100px] truncate">
                      {l.name.replace(`${selectedCity?.name ?? ""} `, "")}
                    </span>
                  </button>
                );
              })}
              {!loadingLandmarks && landmarks.length === 0 && (
                <div className="absolute inset-0 grid place-items-center text-xs text-muted-foreground">
                  No landmarks for this city yet.
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* RECENT FEED */}
        <Card>
          <CardHeader className="p-3 pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Sparkles className="h-4 w-4" /> Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Tabs defaultValue="visits">
              <TabsList className="grid grid-cols-2 mx-3 h-8">
                <TabsTrigger value="visits" className="text-[10px]">Visits</TabsTrigger>
                <TabsTrigger value="busking" className="text-[10px]">Busking</TabsTrigger>
              </TabsList>
              <ScrollArea className="h-[360px] mt-2 px-3 pb-3">
                <TabsContent value="visits" className="m-0 space-y-2">
                  {recentVisits.length === 0 && (
                    <p className="text-xs text-muted-foreground py-4 text-center">No visits yet.</p>
                  )}
                  {recentVisits.map((v) => (
                    <div key={v.id} className="rounded border p-2 text-[11px] space-y-1">
                      <p className="leading-snug">{v.event_summary}</p>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <span className={v.cash_delta >= 0 ? "text-success" : "text-destructive"}>
                          {v.cash_delta >= 0 ? "+" : ""}${v.cash_delta}
                        </span>
                        <span>•</span>
                        <span className={v.fame_delta >= 0 ? "text-success" : "text-destructive"}>
                          {v.fame_delta >= 0 ? "+" : ""}{v.fame_delta} fame
                        </span>
                      </div>
                    </div>
                  ))}
                </TabsContent>
                <TabsContent value="busking" className="m-0 space-y-2">
                  {recentBusking.length === 0 && (
                    <p className="text-xs text-muted-foreground py-4 text-center">No busking sessions yet.</p>
                  )}
                  {recentBusking.map((s) => (
                    <div key={s.id} className="rounded border p-2 text-[11px] space-y-1">
                      <div className="flex items-center justify-between">
                        <Badge variant="outline" className="text-[10px]">{s.duration_minutes}m • {s.vibe}</Badge>
                        <span className="text-muted-foreground">crowd {s.crowd_size}</span>
                      </div>
                      <div className="flex items-center gap-3 text-muted-foreground">
                        <span className="text-success">+${s.tips_earned}</span>
                        <span className="text-success">+{s.fame_gained} fame</span>
                      </div>
                    </div>
                  ))}
                </TabsContent>
              </ScrollArea>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      {/* Landmark detail dialog */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-md">
          {selected && (() => {
            const meta = KIND_META[selected.kind];
            const Icon = meta.icon;
            const canBusk = selected.kind === "park" || selected.kind === "dive_bar";
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Icon className={cn("h-5 w-5", meta.color)} />
                    {selected.name}
                  </DialogTitle>
                  <DialogDescription>
                    <Badge variant="outline" className="text-[10px] mr-1">{meta.label}</Badge>
                    {selected.description}
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-2 text-xs">
                  <div className="flex items-center justify-between rounded border p-2">
                    <span className="text-muted-foreground">Base reward</span>
                    <span>~${selected.base_cash_reward} • {selected.base_fame_reward} fame</span>
                  </div>
                  <Button
                    onClick={() => visitMutation.mutate(selected)}
                    disabled={visitMutation.isPending}
                    size="sm"
                  >
                    {visitMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Sparkles className="h-3.5 w-3.5 mr-1" />}
                    Visit & Roll Event
                  </Button>
                  {canBusk && (
                    <Button
                      onClick={() => { setBusking({ landmark: selected, duration: 30 }); setSelected(null); }}
                      size="sm"
                      variant="outline"
                    >
                      <Music2 className="h-3.5 w-3.5 mr-1" /> Busk Here
                    </Button>
                  )}
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Busking dialog */}
      <Dialog open={!!busking} onOpenChange={(o) => !o && setBusking(null)}>
        <DialogContent className="max-w-md">
          {busking && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Music2 className="h-5 w-5 text-primary" />
                  Busk at {busking.landmark.name}
                </DialogTitle>
                <DialogDescription>
                  Crowd size depends on the spot, time of day, and luck. Longer sets earn more but tire you out.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  {BUSKING_DURATIONS.map((d) => (
                    <Button
                      key={d.mins}
                      size="sm"
                      variant={busking.duration === d.mins ? "default" : "outline"}
                      onClick={() => setBusking({ ...busking, duration: d.mins })}
                      className="text-[10px] h-auto py-2"
                    >
                      {d.label}
                    </Button>
                  ))}
                </div>
                <Button
                  className="w-full"
                  onClick={() => buskingMutation.mutate(busking)}
                  disabled={buskingMutation.isPending}
                >
                  {buskingMutation.isPending ? (
                    <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> Playing…</>
                  ) : (
                    <><Coins className="h-3.5 w-3.5 mr-1" /> Start Busking ({busking.duration}m)</>
                  )}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </PageLayout>
  );
}
