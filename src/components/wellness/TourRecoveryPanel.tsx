import { useQuery } from "@tanstack/react-query";
import { Bus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useActiveProfile } from "@/hooks/useActiveProfile";

type Transport = { vehicle_tier: string; travel_comfort: number; sleep_capability: number; recovery_efficiency: number; noise: number; personal_space: number; onboard_facilities: string[] };
type RecoveryEvent = { id: string; source_type: string; occurred_on: string; notes: string | null; effects: Record<string, number> };
type Load = { id: string; load_state: string; load_score: number; window_start: string; window_end: string };

const db = supabase as any;
const label = (s: string) => s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
const SOURCE: Record<string, string> = { overnight: "Overnight rest", travel: "Travel", rest_day: "Rest day", jet_lag: "Jet lag", accommodation: "Accommodation", condition: "Condition" };

export default function TourRecoveryPanel() {
  const { profileId } = useActiveProfile() as { profileId?: string | null };
  const transport = useQuery({
    queryKey: ["transport-wellness"],
    queryFn: async () => {
      const { data, error } = await db.from("transport_wellness_profiles").select("vehicle_tier,travel_comfort,sleep_capability,recovery_efficiency,noise,personal_space,onboard_facilities").order("travel_comfort");
      if (error) throw error;
      return data as Transport[];
    },
    staleTime: 10 * 60_000,
  });
  const mine = useQuery({
    queryKey: ["tour-recovery", profileId],
    enabled: !!profileId,
    queryFn: async () => {
      const [ev, ld] = await Promise.all([
        db.from("wellness_recovery_events").select("id,source_type,occurred_on,notes,effects").eq("profile_id", profileId).order("occurred_on", { ascending: false }).limit(10),
        db.from("tour_load_summaries").select("id,load_state,load_score,window_start,window_end").eq("profile_id", profileId).order("window_end", { ascending: false }).limit(1),
      ]);
      if (ev.error) throw ev.error;
      if (ld.error) throw ld.error;
      return { events: (ev.data ?? []) as RecoveryEvent[], load: ((ld.data ?? [])[0] ?? null) as Load | null };
    },
  });

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base"><Bus className="h-4 w-4 text-primary" /> Touring recovery</CardTitle>
        <p className="text-xs text-muted-foreground">Better transport means better sleep and recovery between shows.</p>
      </CardHeader>
      <CardContent className="space-y-4 text-xs">
        {mine.data?.load && (
          <div className="flex items-center gap-2 rounded border p-2">
            <span className="font-medium">Tour workload</span>
            <Badge variant="outline" className="text-[10px]">{label(mine.data.load.load_state)}</Badge>
            <Progress value={mine.data.load.load_score} className="h-1.5 flex-1" />
            <span>{mine.data.load.load_score}/100</span>
          </div>
        )}

        <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
          {(transport.data ?? []).map((t) => (
            <div key={t.vehicle_tier} className="w-40 shrink-0 space-y-1 rounded border p-2">
              <p className="font-medium">{label(t.vehicle_tier)}</p>
              {[["Comfort", t.travel_comfort], ["Sleep", t.sleep_capability], ["Recovery", t.recovery_efficiency], ["Space", t.personal_space]].map(([k, v]) => (
                <div key={k as string} className="flex items-center gap-1">
                  <span className="w-14 text-[10px] text-muted-foreground">{k}</span>
                  <Progress value={v as number} className="h-1 flex-1" />
                </div>
              ))}
              <p className="truncate text-[10px] text-muted-foreground">{(t.onboard_facilities ?? []).join(" · ")}</p>
            </div>
          ))}
        </div>

        <div className="space-y-1">
          <p className="font-medium">Recent recovery</p>
          {(mine.data?.events ?? []).length === 0 ? (
            <p className="text-muted-foreground">Nothing recorded yet. Recovery from rest, travel and jet lag will show here.</p>
          ) : (
            mine.data!.events.map((e) => (
              <div key={e.id} className="flex items-center gap-2">
                <span className="w-20 text-[10px] text-muted-foreground">{e.occurred_on}</span>
                <Badge variant="outline" className="text-[10px]">{SOURCE[e.source_type] ?? label(e.source_type)}</Badge>
                <span className="truncate text-muted-foreground">
                  {e.notes ?? Object.entries(e.effects ?? {}).map(([k, v]) => `${label(k)} ${Number(v) > 0 ? "+" : ""}${v}`).join(", ")}
                </span>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
