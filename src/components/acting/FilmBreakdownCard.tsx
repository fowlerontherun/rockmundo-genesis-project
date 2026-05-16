import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Film, Star, Users, DollarSign, Trophy, TrendingUp, Calendar } from "lucide-react";
import { format, parseISO } from "date-fns";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

export function FilmBreakdownCard({ contract: c }: { contract: any }) {
  const { data: weekly = [] } = useQuery({
    queryKey: ["film-weekly", c.id],
    queryFn: async () => {
      const { data } = await supabase.from("film_performance_weekly")
        .select("*").eq("contract_id", c.id).order("week_number");
      return data ?? [];
    },
    enabled: !!c.released_at,
  });

  const released = !!c.released_at;
  const totalGross = Number(c.box_office_gross ?? 0);
  const merch = Number(c.merch_revenue_cents ?? 0);
  const totalPay = Number(c.total_pay_cents ?? c.compensation * 100 ?? 0);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Film className="h-5 w-5" /> {c.film_title ?? "Untitled Film"}
              {c.is_sequel && <Badge variant="secondary">SEQUEL</Badge>}
              <Badge variant="outline" className="capitalize">{c.role_type}</Badge>
              <Badge variant={released ? "default" : "secondary"} className="capitalize">{c.status}</Badge>
            </CardTitle>
            <CardDescription>
              {c.filming_start_date && (
                <>Filming: {format(parseISO(c.filming_start_date), "MMM d, yyyy")} </>
              )}
              {c.premiere_date && (
                <> · Premiere: {format(parseISO(c.premiere_date), "MMM d, yyyy")}</>
              )}
            </CardDescription>
          </div>
          <div className="text-right">
            <div className="text-lg font-bold">${(totalPay / 100).toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">your pay</div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!released ? (
          <div className="text-sm text-muted-foreground">
            Filming / awaiting release. Box office and reviews unlock after premiere.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <Stat icon={<DollarSign className="h-4 w-4" />} label="Opening wkd" value={`$${(Number(c.opening_weekend_cents) / 100 / 1_000_000).toFixed(1)}M`} />
              <Stat icon={<TrendingUp className="h-4 w-4" />} label="Total gross" value={`$${(totalGross / 100 / 1_000_000).toFixed(1)}M`} />
              <Stat icon={<Star className="h-4 w-4" />} label="Critic" value={c.critic_score ? `${c.critic_score}%` : "—"} />
              <Stat icon={<Users className="h-4 w-4" />} label="Audience" value={c.audience_score ? `${c.audience_score}%` : "—"} />
              <Stat icon={<DollarSign className="h-4 w-4" />} label="Merch" value={`$${(merch / 100 / 1000).toFixed(0)}k`} />
              <Stat icon={<TrendingUp className="h-4 w-4" />} label="Streams" value={Number(c.streaming_views ?? 0).toLocaleString()} />
              <Stat icon={<Trophy className="h-4 w-4" />} label="Awards" value={c.awards_won ?? 0} />
              <Stat icon={<Calendar className="h-4 w-4" />} label="Weeks" value={weekly.length} />
            </div>

            {weekly.length > 0 && (
              <div className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={weekly.map((w: any) => ({
                    week: `W${w.week_number}`,
                    box: Number(w.box_office_week_cents) / 100 / 1_000_000,
                  }))}>
                    <XAxis dataKey="week" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} unit="M" />
                    <Tooltip formatter={(v: any) => `$${Number(v).toFixed(2)}M`} />
                    <Line type="monotone" dataKey="box" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </>
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
