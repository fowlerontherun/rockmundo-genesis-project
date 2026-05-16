import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tv, Star, Users, DollarSign, TrendingUp } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

export function SeriesBreakdownCard({ contract: c }: { contract: any }) {
  const season = c.series_seasons;
  const seriesTitle = c.scripted_series?.title ?? "TV Series";
  const totalPay = Number(c.total_pay_cents ?? 0);

  const { data: weekly = [] } = useQuery({
    queryKey: ["series-weekly", season?.id ?? c.season_id],
    queryFn: async () => {
      const { data } = await supabase.from("series_performance_weekly")
        .select("*").eq("season_id", c.season_id).order("week_number");
      return data ?? [];
    },
    enabled: !!c.season_id,
  });

  const { data: episodes = [] } = useQuery({
    queryKey: ["series-episodes", c.season_id],
    queryFn: async () => {
      const { data } = await supabase.from("series_episodes")
        .select("*").eq("season_id", c.season_id).order("episode_number");
      return data ?? [];
    },
    enabled: !!c.season_id,
  });

  const aired = season?.episodes_aired ?? 0;
  const totalEps = season?.episode_count ?? c.episode_count ?? 10;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Tv className="h-5 w-5" /> {seriesTitle}
              <Badge variant="outline">S{season?.season_number ?? 1}</Badge>
              <Badge variant={season?.status === "cancelled" ? "destructive" : "default"} className="capitalize">
                {season?.status ?? c.status}
              </Badge>
            </CardTitle>
            <CardDescription className="capitalize">
              {c.role_type} role · {c.role_name} · {aired}/{totalEps} episodes aired
            </CardDescription>
          </div>
          <div className="text-right">
            <div className="text-lg font-bold">${(totalPay / 100).toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">
              ${(Number(c.pay_per_episode_cents) / 100).toLocaleString()}/ep × {c.episode_count}
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <Stat icon={<Users className="h-4 w-4" />} label="Avg viewers" value={Number(season?.avg_viewers ?? 0).toLocaleString()} />
          <Stat icon={<TrendingUp className="h-4 w-4" />} label="Total viewers" value={Number(season?.total_viewers ?? 0).toLocaleString()} />
          <Stat icon={<Star className="h-4 w-4" />} label="Critic" value={season?.critic_score ? `${season.critic_score}%` : "—"} />
          <Stat icon={<Star className="h-4 w-4" />} label="Audience" value={season?.audience_score ? `${season.audience_score}%` : "—"} />
          <Stat icon={<DollarSign className="h-4 w-4" />} label="Merch" value={`$${(Number(season?.total_merch_revenue_cents ?? 0) / 100 / 1000).toFixed(0)}k`} />
          <Stat icon={<DollarSign className="h-4 w-4" />} label="Ad revenue (wk)" value={weekly.length > 0 ? `$${(weekly.reduce((a: number, w: any) => a + Number(w.ad_revenue_cents ?? 0), 0) / 100 / 1000).toFixed(0)}k` : "—"} />
        </div>

        {weekly.length > 0 && (
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={weekly.map((w: any) => ({
                week: `Ep${w.week_number}`,
                viewers: Number(w.viewers) / 1_000_000,
              }))}>
                <XAxis dataKey="week" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} unit="M" />
                <Tooltip formatter={(v: any) => `${Number(v).toFixed(2)}M`} />
                <Line type="monotone" dataKey="viewers" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {episodes.length > 0 && (
          <details className="text-xs">
            <summary className="cursor-pointer text-muted-foreground">Episode log ({episodes.length})</summary>
            <div className="mt-2 space-y-1">
              {episodes.map((e: any) => (
                <div key={e.id} className="flex items-center justify-between rounded border bg-card/40 px-2 py-1">
                  <span>{e.title ?? `Episode ${e.episode_number}`}</span>
                  <span className="text-muted-foreground">
                    {e.aired ? `${Number(e.viewers_7day).toLocaleString()} viewers` : `Airs ${e.airdate}`}
                  </span>
                </div>
              ))}
            </div>
          </details>
        )}

        {season?.status === "cancelled" && (
          <div className="rounded border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
            This show has been cancelled. No further seasons.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="rounded border bg-card/40 p-2">
      <div className="flex items-center gap-1 text-xs text-muted-foreground">{icon} {label}</div>
      <div className="font-semibold text-sm">{value}</div>
    </div>
  );
}
