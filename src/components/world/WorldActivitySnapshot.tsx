import { useMemo } from "react";
import type { ComponentType } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { Activity, Building2, CalendarDays, Disc3, LineChart, Loader2, RadioTower, Sparkles, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { fetchWorldNews, type WorldNewsItem } from "@/lib/api/worldNews";

interface SnapshotItem {
  id: string;
  icon: ComponentType<{ className?: string }>;
  title: string;
  description: string;
  source: string;
  timestamp?: string | null;
}

const db = supabase as any;

const fmtNum = (value: unknown) => Number(value ?? 0).toLocaleString();

const RelativeTime = ({ value }: { value?: string | null }) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return <span>{formatDistanceToNow(date, { addSuffix: true })}</span>;
};

const iconForNews = (category: WorldNewsItem["category"]) => {
  if (category === "Release") return Disc3;
  if (category === "Festival") return CalendarDays;
  if (category === "Charts") return LineChart;
  if (category === "Milestone") return TrendingUp;
  return Activity;
};

const buildSnapshotItems = async (): Promise<SnapshotItem[]> => {
  const [news, labels, studios] = await Promise.all([
    fetchWorldNews(8).catch(() => []),
    db
      .from("labels")
      .select("id, name, label_tier, headquarters_city, market_share, reputation_score, updated_at")
      .order("updated_at", { ascending: false, nullsFirst: false })
      .limit(2)
      .then(({ data, error }: any) => (error ? [] : data ?? [])),
    db
      .from("city_studios")
      .select("id, name, reputation, total_sessions, sessions_completed, total_revenue, updated_at:created_at")
      .order("total_sessions", { ascending: false, nullsFirst: false })
      .limit(2)
      .then(({ data, error }: any) => (error ? [] : data ?? [])),
  ]);

  const activityFromNews = news
    .filter((item) => ["Release", "Milestone", "Festival", "Charts"].includes(item.category))
    .slice(0, 5)
    .map((item) => ({
      id: item.id,
      icon: iconForNews(item.category),
      title: item.title,
      description: item.description,
      source: item.source,
      timestamp: item.timestamp,
    }));

  const labelItems = labels.map((label: any) => ({
    id: `label-${label.id}`,
    icon: RadioTower,
    title: `${label.name} label activity`,
    description: `${label.label_tier ?? "Independent"} label${label.headquarters_city ? ` based in ${label.headquarters_city}` : ""}${label.market_share != null ? ` · ${fmtNum(label.market_share)} market share` : ""}${label.reputation_score != null ? ` · ${fmtNum(label.reputation_score)} reputation` : ""}.`,
    source: "labels",
    timestamp: label.updated_at,
  }));

  const studioItems = studios.map((studio: any) => ({
    id: `studio-${studio.id}`,
    icon: Building2,
    title: `${studio.name} studio activity`,
    description: `${fmtNum(studio.total_sessions ?? studio.sessions_completed)} sessions logged${studio.reputation != null ? ` · ${fmtNum(studio.reputation)} reputation` : ""}${studio.total_revenue != null ? ` · $${fmtNum(studio.total_revenue)} lifetime revenue` : ""}.`,
    source: "city_studios",
    timestamp: studio.updated_at,
  }));

  return [...activityFromNews, ...labelItems, ...studioItems].slice(0, 8);
};

export function WorldActivitySnapshot() {
  const { data: items = [], isLoading } = useQuery({
    queryKey: ["world-activity-snapshot"],
    queryFn: buildSnapshotItems,
    staleTime: 60_000,
    refetchInterval: 2 * 60_000,
  });

  const sources = useMemo(() => Array.from(new Set(items.map((item) => item.source))), [items]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5" /> World activity snapshot
        </CardTitle>
        <CardDescription>
          Lightweight, read-only signals from existing bands, releases, charts, festivals, labels, and studios — no simulated events are created.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="grid gap-3 md:grid-cols-2" aria-live="polite">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="flex gap-3 rounded-lg border p-3">
                <Loader2 className="mt-0.5 h-4 w-4 animate-spin text-muted-foreground" />
                <div className="space-y-2">
                  <div className="h-4 w-40 rounded bg-muted" />
                  <div className="h-3 w-64 max-w-full rounded bg-muted" />
                </div>
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">
            <Activity className="mx-auto mb-3 h-10 w-10 opacity-50" />
            <p className="font-medium text-foreground">No world activity to summarize yet</p>
            <p className="mx-auto mt-1 max-w-lg">
              Existing release, popularity, festival, chart, label, or studio records will appear here once they are available.
            </p>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {items.map((item) => {
              const Icon = item.icon;
              return (
                <article key={item.id} className="rounded-lg border bg-card/60 p-3">
                  <div className="flex items-start gap-3">
                    <div className="rounded-full bg-primary/10 p-2 text-primary">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-medium leading-snug">{item.title}</h3>
                        <Badge variant="outline" className="text-[10px]">{item.source}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{item.description}</p>
                      <p className="text-xs text-muted-foreground"><RelativeTime value={item.timestamp} /></p>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
        <p className="mt-4 text-xs text-muted-foreground">
          Data sources used: {sources.length > 0 ? sources.join(", ") : "chart_entries, song_releases, bands, festivals, labels, city_studios when present"}.
        </p>
      </CardContent>
    </Card>
  );
}
