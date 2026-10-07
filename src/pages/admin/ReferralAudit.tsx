import { useQuery } from "@tanstack/react-query";
import { AdminRoute } from "@/components/AdminRoute";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Gift, RefreshCw, Users } from "lucide-react";

const sourceLabel = (source: string) => ({ band_recruitment:"Band recruitment", gig_share:"Gig share", song_chart_share:"Song chart", release_chart_share:"Release chart", achievement_share:"Achievement", referral_hub:"Invite Friends", manual_code:"Referral code", signup_metadata:"Direct invite", unknown:"Direct invite" } as Record<string,string>)[source] ?? source.replace(/_/g," ");\n\ntype GrowthAnalytics = { trends:{joins_7d:number;joins_prev_7d:number;qualified_7d:number;qualified_prev_7d:number;band_joins_7d:number;band_joins_prev_7d:number}; speed:{median_qualification_hours:number|null;median_band_join_hours:number|null}; funnel: { joined:number; qualified:number; vip:number; activating:number }; dropoff:{ missing_email:number; waiting_24h:number; missing_activity:number }; band:{ joined:number; qualified:number; band_members:number; vip:number; qualification_rate:number; band_join_rate:number }; sources:Array<{source:string;joined:number;qualified:number;vip:number;activating:number;missing_email:number;waiting_24h:number;missing_activity:number;band_joined:number;qualification_rate:number;vip_rate:number}> };

type Audit = {
  summary: {
    total_referrals: number;
    qualified: number;
    signup_rewarded: number;
    vip_paid: number;
    vip_rewarded: number;
    last_24h: number;
    last_7d: number;
    qualification_rate: number;
    vip_conversion_rate: number;
    band_recruits: number;
  };
  sources: Array<{ source: string; referrals: number; qualified: number; vip_paid: number; qualification_rate: number; vip_conversion_rate: number }>;
  recent: Array<{
    id: string; referral_code: string; bound_at: string; signup_qualified_at?: string | null;
    signup_rewarded_at?: string | null; vip_paid_at?: string | null; vip_rewarded_at?: string | null;
    source: string; referrer_name?: string | null; referred_name?: string | null;
  }>;
  recent_rewards: Array<{
    id: string; reward_key: string; beneficiary_name?: string | null; xp_amount: number; ap_amount: number;
    cash_amount: number; player_fame_amount: number; band_fame_amount: number; granted_at: string;
  }>;
};

export default function ReferralAudit() {
  const query = useQuery({
    queryKey: ["admin-referral-audit"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("admin_get_referral_audit", { p_limit: 100 });
      if (error) throw error;
      return data as Audit;
    },
  });
  const growthQuery = useQuery({ queryKey: ["admin-referral-growth-analytics"], queryFn: async () => { const { data, error } = await (supabase as any).rpc("admin_get_referral_growth_analytics"); if (error) throw error; return data as GrowthAnalytics; } });
  const audit = query.data;
  const growth = growthQuery.data;

  return (
    <AdminRoute>
      <div className="container mx-auto space-y-6 p-4 md:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-3xl font-bold"><Gift className="h-7 w-7" />Referral Audit</h1>
            <p className="text-muted-foreground">Read-only referral attribution, qualification, conversion and reward diagnostics.</p>
          </div>
          <Button variant="outline" onClick={() => { query.refetch(); growthQuery.refetch(); }} disabled={query.isFetching}>
            <RefreshCw className={`mr-2 h-4 w-4 ${query.isFetching ? "animate-spin" : ""}`} />Refresh
          </Button>
        </div>

        {query.error ? <Card className="border-destructive"><CardContent className="pt-6 text-destructive">{(query.error as Error).message}</CardContent></Card> : null}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {[
            ["Referrals", audit?.summary.total_referrals ?? 0],
            ["Qualified", audit?.summary.qualified ?? 0],
            ["Qualification", `${audit?.summary.qualification_rate ?? 0}%`],
            ["VIP buyers", audit?.summary.vip_paid ?? 0],
            ["VIP conversion", `${audit?.summary.vip_conversion_rate ?? 0}%`],
            ["Band recruits", audit?.summary.band_recruits ?? 0],
            ["Last 24h", audit?.summary.last_24h ?? 0],
            ["Last 7d", audit?.summary.last_7d ?? 0],
            ["Signup rewards", audit?.summary.signup_rewarded ?? 0],
            ["VIP rewards", audit?.summary.vip_rewarded ?? 0],
          ].map(([label, value]) => <Card key={String(label)}><CardContent className="pt-5"><p className="text-xs text-muted-foreground">{label}</p><p className="text-2xl font-semibold">{value}</p></CardContent></Card>)}
        </div>

        <div className="grid gap-4 lg:grid-cols-4">\n          <Card><CardHeader><CardTitle>7-day momentum</CardTitle><CardDescription>Current seven days compared with the previous seven.</CardDescription></CardHeader><CardContent className="space-y-2 text-sm"><div className="flex justify-between"><span>New referrals</span><strong>{growth?.trends.joins_7d ?? 0} <span className="text-xs text-muted-foreground">vs {growth?.trends.joins_prev_7d ?? 0}</span></strong></div><div className="flex justify-between"><span>Qualified</span><strong>{growth?.trends.qualified_7d ?? 0} <span className="text-xs text-muted-foreground">vs {growth?.trends.qualified_prev_7d ?? 0}</span></strong></div><div className="flex justify-between"><span>Band joins</span><strong>{growth?.trends.band_joins_7d ?? 0} <span className="text-xs text-muted-foreground">vs {growth?.trends.band_joins_prev_7d ?? 0}</span></strong></div><div className="flex justify-between"><span>Median qualification</span><strong>{growth?.speed.median_qualification_hours == null ? "—" : `${growth.speed.median_qualification_hours}h`}</strong></div><div className="flex justify-between"><span>Median band join</span><strong>{growth?.speed.median_band_join_hours == null ? "—" : `${growth.speed.median_band_join_hours}h`}</strong></div></CardContent></Card>
          <Card><CardHeader><CardTitle>Activation funnel</CardTitle><CardDescription>Referral joins progressing into active players and VIP customers.</CardDescription></CardHeader><CardContent className="space-y-2 text-sm"><div className="flex justify-between"><span>Joined</span><strong>{growth?.funnel.joined ?? 0}</strong></div><div className="flex justify-between"><span>Qualified</span><strong>{growth?.funnel.qualified ?? 0}</strong></div><div className="flex justify-between"><span>Still activating</span><strong>{growth?.funnel.activating ?? 0}</strong></div><div className="flex justify-between"><span>VIP</span><strong>{growth?.funnel.vip ?? 0}</strong></div></CardContent></Card>
          <Card><CardHeader><CardTitle>Activation drop-off</CardTitle><CardDescription>Which qualification gates are holding pending recruits back. A recruit can appear in more than one row.</CardDescription></CardHeader><CardContent className="space-y-2 text-sm"><div className="flex justify-between"><span>Email not confirmed</span><strong>{growth?.dropoff.missing_email ?? 0}</strong></div><div className="flex justify-between"><span>Waiting for 24h</span><strong>{growth?.dropoff.waiting_24h ?? 0}</strong></div><div className="flex justify-between"><span>Needs active play</span><strong>{growth?.dropoff.missing_activity ?? 0}</strong></div></CardContent></Card>
          <Card><CardHeader><CardTitle>Band recruitment</CardTitle><CardDescription>Performance of referrals created specifically to recruit a player into a band.</CardDescription></CardHeader><CardContent className="space-y-2 text-sm"><div className="flex justify-between"><span>Joined</span><strong>{growth?.band.joined ?? 0}</strong></div><div className="flex justify-between"><span>Qualified</span><strong>{growth?.band.qualified ?? 0}</strong></div><div className="flex justify-between"><span>Joined intended band</span><strong>{growth?.band.band_members ?? 0}</strong></div><div className="flex justify-between"><span>Band join rate</span><strong>{growth?.band.band_join_rate ?? 0}%</strong></div><div className="flex justify-between"><span>Qualification rate</span><strong>{growth?.band.qualification_rate ?? 0}%</strong></div><div className="flex justify-between"><span>VIP</span><strong>{growth?.band.vip ?? 0}</strong></div></CardContent></Card>
        </div>

        <Card>
          <CardHeader><CardTitle>Source funnel diagnostics</CardTitle><CardDescription>Find share surfaces that generate signups but lose players before activation.</CardDescription></CardHeader>
          <CardContent className="overflow-x-auto"><table className="w-full min-w-[900px] text-sm"><thead><tr className="border-b text-left"><th className="p-2">Source</th><th className="p-2">Joined</th><th className="p-2">Activating</th><th className="p-2">Qualified</th><th className="p-2">Qual. rate</th><th className="p-2">Email gap</th><th className="p-2">24h gap</th><th className="p-2">Play gap</th><th className="p-2">VIP</th></tr></thead><tbody>{growth?.sources.map(row=><tr key={row.source} className="border-b"><td className="p-2"><Badge variant="outline">{sourceLabel(row.source)}</Badge></td><td className="p-2">{row.joined}</td><td className="p-2">{row.activating}</td><td className="p-2">{row.qualified}</td><td className="p-2">{row.qualification_rate}%</td><td className="p-2">{row.missing_email}</td><td className="p-2">{row.waiting_24h}</td><td className="p-2">{row.missing_activity}</td><td className="p-2">{row.vip}</td></tr>)}</tbody></table></CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Acquisition sources</CardTitle><CardDescription>Which referral entry points turn invitations into qualified players and VIP customers.</CardDescription></CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-sm">
              <thead><tr className="border-b text-left"><th className="p-2">Source</th><th className="p-2">Referrals</th><th className="p-2">Qualified</th><th className="p-2">Qualification</th><th className="p-2">VIP</th><th className="p-2">VIP conversion</th></tr></thead>
              <tbody>{audit?.sources?.map((row) => <tr key={row.source} className="border-b">
                <td className="p-2"><Badge variant="outline">{sourceLabel(row.source)}</Badge></td><td className="p-2">{row.referrals}</td><td className="p-2">{row.qualified}</td><td className="p-2">{row.qualification_rate}%</td><td className="p-2">{row.vip_paid}</td><td className="p-2">{row.vip_conversion_rate}%</td>
              </tr>)}</tbody>
            </table>
            {!query.isLoading && !audit?.sources?.length ? <p className="py-6 text-center text-muted-foreground">No referral source data yet.</p> : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" />Recent referrals</CardTitle><CardDescription>Newest attribution records and their progression through qualification and VIP conversion.</CardDescription></CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead><tr className="border-b text-left"><th className="p-2">Joined</th><th className="p-2">Referrer</th><th className="p-2">Recruit</th><th className="p-2">Source</th><th className="p-2">Code</th><th className="p-2">Qualified</th><th className="p-2">Signup reward</th><th className="p-2">VIP</th></tr></thead>
              <tbody>{audit?.recent?.map((row) => <tr key={row.id} className="border-b">
                <td className="p-2 whitespace-nowrap">{new Date(row.bound_at).toLocaleString()}</td>
                <td className="p-2">{row.referrer_name ?? "—"}</td><td className="p-2">{row.referred_name ?? "—"}</td>
                <td className="p-2"><Badge variant="outline">{row.source}</Badge></td><td className="p-2 font-mono text-xs">{row.referral_code}</td>
                <td className="p-2">{row.signup_qualified_at ? "Yes" : "Pending"}</td><td className="p-2">{row.signup_rewarded_at ? "Paid" : "—"}</td><td className="p-2">{row.vip_paid_at ? (row.vip_rewarded_at ? "Paid + rewarded" : "Paid") : "—"}</td>
              </tr>)}</tbody>
            </table>
            {!query.isLoading && !audit?.recent?.length ? <p className="py-6 text-center text-muted-foreground">No referrals yet.</p> : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Recent referral rewards</CardTitle><CardDescription>Character-bound grants for signup, VIP and promoter milestones.</CardDescription></CardHeader>
          <CardContent className="space-y-2">
            {audit?.recent_rewards?.map((reward) => <div key={reward.id} className="flex flex-col gap-1 rounded border p-3 sm:flex-row sm:items-center sm:justify-between">
              <div><p className="font-medium">{reward.beneficiary_name ?? "Unknown character"} · {reward.reward_key}</p><p className="text-xs text-muted-foreground">{new Date(reward.granted_at).toLocaleString()}</p></div>
              <div className="text-sm text-muted-foreground">{reward.xp_amount} XP · {reward.ap_amount} AP · ${Number(reward.cash_amount).toLocaleString()} · +{reward.player_fame_amount} fame</div>
            </div>)}
          </CardContent>
        </Card>
      </div>
    </AdminRoute>
  );
}
