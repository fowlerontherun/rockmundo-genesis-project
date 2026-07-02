import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { TrendingUp } from "lucide-react";
import {
  getPlayerReachTier,
  getReachTierLabel,
  getNextReachTier,
  type ReachTier,
} from "@/utils/mediaReachGate";
import { BAND_FAME_THRESHOLDS } from "@/utils/bandFame";

interface FameTimelineChartProps {
  bandId: string;
  /** Current band fame (used as the anchor for the most recent data point). */
  currentFame: number;
  /** How many historical events to include. */
  limit?: number;
}

interface TimelinePoint {
  ts: number;
  date: string;
  fame: number;
  gained: number;
  label: string;
}

const REACH_LINES: { tier: ReachTier; fame: number; label: string }[] = [
  { tier: "regional", fame: BAND_FAME_THRESHOLDS.localFavorite, label: "Regional reach" },
  { tier: "national", fame: BAND_FAME_THRESHOLDS.regionalAct, label: "National reach" },
  { tier: "international", fame: BAND_FAME_THRESHOLDS.nationalAct, label: "International reach" },
];

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function FameTimelineChart({ bandId, currentFame, limit = 60 }: FameTimelineChartProps) {
  const [events, setEvents] = useState<Array<{ created_at: string; fame_gained: number; event_type: string }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("band_fame_events")
        .select("created_at, fame_gained, event_type")
        .eq("band_id", bandId)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (!cancelled) {
        setEvents((data ?? []).slice().reverse());
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [bandId, limit]);

  const points = useMemo<TimelinePoint[]>(() => {
    if (events.length === 0) {
      const now = Date.now();
      return [
        { ts: now - 86_400_000, date: formatDate(now - 86_400_000), fame: currentFame, gained: 0, label: "start" },
        { ts: now, date: formatDate(now), fame: currentFame, gained: 0, label: "now" },
      ];
    }
    // Reconstruct historical fame by walking backwards from currentFame.
    const totalGained = events.reduce((sum, e) => sum + (e.fame_gained ?? 0), 0);
    let running = Math.max(0, currentFame - totalGained);
    const series: TimelinePoint[] = [
      {
        ts: new Date(events[0].created_at).getTime() - 86_400_000,
        date: formatDate(new Date(events[0].created_at).getTime() - 86_400_000),
        fame: running,
        gained: 0,
        label: "start",
      },
    ];
    for (const e of events) {
      running += e.fame_gained ?? 0;
      const ts = new Date(e.created_at).getTime();
      series.push({
        ts,
        date: formatDate(ts),
        fame: running,
        gained: e.fame_gained ?? 0,
        label: e.event_type.replace(/_/g, " "),
      });
    }
    // Anchor final point to current fame in case of drift.
    if (series.length > 0) series[series.length - 1].fame = currentFame;
    return series;
  }, [events, currentFame]);

  const currentTier = getPlayerReachTier(currentFame);
  const next = getNextReachTier(currentTier);
  const yMax = Math.max(
    currentFame * 1.15,
    next ? next.fame * 1.05 : currentFame * 1.15,
    ...points.map((p) => p.fame),
    100,
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <TrendingUp className="h-4 w-4 text-primary" />
          Fame Timeline
        </CardTitle>
        <CardDescription className="flex flex-wrap items-center gap-2 text-xs">
          <span>Progress toward the next reach tier</span>
          <Badge variant="secondary" className="text-[10px]">
            {getReachTierLabel(currentTier)}
          </Badge>
          {next && (
            <span className="text-muted-foreground">
              → {getReachTierLabel(next.tier)} at {next.fame.toLocaleString()} fame
              {" "}
              ({Math.max(0, next.fame - currentFame).toLocaleString()} to go)
            </span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-56 w-full" />
        ) : (
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={points} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="fameFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis
                  domain={[0, Math.ceil(yMax)]}
                  tick={{ fontSize: 10 }}
                  stroke="hsl(var(--muted-foreground))"
                  tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 100) / 10}k` : `${v}`)}
                />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 6,
                    fontSize: 12,
                  }}
                  formatter={(value: any, name, item: any) => {
                    if (name === "fame") {
                      const g = item?.payload?.gained ?? 0;
                      return [`${Number(value).toLocaleString()}${g ? ` (+${g})` : ""}`, "Fame"];
                    }
                    return [value, name];
                  }}
                  labelFormatter={(_, payload) => {
                    const p = payload?.[0]?.payload as TimelinePoint | undefined;
                    return p ? `${p.date} · ${p.label}` : "";
                  }}
                />
                {REACH_LINES.filter((l) => l.fame <= yMax).map((line) => (
                  <ReferenceLine
                    key={line.tier}
                    y={line.fame}
                    stroke={currentFame >= line.fame ? "hsl(var(--success))" : "hsl(var(--warning))"}
                    strokeDasharray="4 4"
                    strokeOpacity={0.7}
                    label={{
                      value: line.label,
                      position: "insideTopRight",
                      fill: "hsl(var(--muted-foreground))",
                      fontSize: 10,
                    }}
                  />
                ))}
                <Area
                  type="monotone"
                  dataKey="fame"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  fill="url(#fameFill)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
