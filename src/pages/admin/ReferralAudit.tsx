import { useQuery } from "@tanstack/react-query";
import { AdminRoute } from "@/components/AdminRoute";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Gift, RefreshCw, Users } from "lucide-react";

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
  };
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
  const audit = query.data;

  return (
    <AdminRoute>
      <div className="container mx-auto space-y-6 p-4 md:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-3xl font-bold"><Gift className="h-7 w-7" />Referral Audit</h1>
            <p className="text-muted-foreground">Read-only referral attribution, qualification, conversion and reward diagnostics.</p>
          </div>
          <Button variant="outline" onClick={() => query.refetch()} disabled={query.isFetching}>
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
            ["Last 24h", audit?.summary.last_24h ?? 0],
            ["Last 7d", audit?.summary.last_7d ?? 0],
            ["Signup rewards", audit?.summary.signup_rewarded ?? 0],
            ["VIP rewards", audit?.summary.vip_rewarded ?? 0],
          ].map(([label, value]) => <Card key={String(label)}><CardContent className="pt-5"><p className="text-xs text-muted-foreground">{label}</p><p className="text-2xl font-semibold">{value}</p></CardContent></Card>)}
        </div>

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
