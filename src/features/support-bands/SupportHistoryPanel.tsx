import { useEffect, useMemo, useState } from 'react';
import { Award, Banknote, Handshake, Loader2, Star, Ticket, TrendingUp, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';

type Reputation = {
  completed_support_shows?: number;
  successful_support_shows?: number;
  cancelled_support_shows?: number;
  reliability_score?: number;
  performance_score?: number;
  reputation_score?: number;
};

type HistoryRow = {
  id: string;
  gig_id: string;
  support_band_id: string;
  headliner_band_id: string;
  performed_at: string | null;
  attendance: number;
  performance_rating: number;
  ticket_revenue: number;
  support_payment: number;
  ticket_demand_multiplier: number;
  support_fame_gain: number;
  support_fan_gain: number;
  support_popularity_gain: number;
  headliner_fame_gain: number;
  headliner_popularity_gain: number;
  relationship_gain: number;
  reputation_gain: number;
};

type Summary = {
  reputation: Reputation;
  supportHistory: HistoryRow[];
  headlinerHistory: HistoryRow[];
};

const money = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value || 0);

export function SupportHistoryPanel({ bandId }: { bandId: string }) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [bandNames, setBandNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      const { data, error } = await (supabase as any).rpc('get_band_support_summary', { p_band_id: bandId });
      if (!mounted) return;
      if (error) {
        setSummary(null);
        setLoading(false);
        return;
      }
      const next = (data ?? { reputation: {}, supportHistory: [], headlinerHistory: [] }) as Summary;
      setSummary(next);
      const ids = Array.from(new Set([
        ...(next.supportHistory ?? []).flatMap((row) => [row.support_band_id, row.headliner_band_id]),
        ...(next.headlinerHistory ?? []).flatMap((row) => [row.support_band_id, row.headliner_band_id]),
      ])).filter(Boolean);
      if (ids.length > 0) {
        const names = await (supabase as any).from('bands').select('id,name').in('id', ids);
        if (mounted && !names.error) setBandNames(Object.fromEntries((names.data ?? []).map((row: any) => [row.id, row.name])));
      }
      if (mounted) setLoading(false);
    };
    void load();
    return () => { mounted = false; };
  }, [bandId]);

  const reputation = summary?.reputation ?? {};
  const completed = reputation.completed_support_shows ?? 0;
  const successful = reputation.successful_support_shows ?? 0;
  const successRate = completed > 0 ? Math.round((successful / completed) * 100) : 0;
  const recent = useMemo(() => (summary?.supportHistory ?? []).slice(0, 8), [summary]);

  if (loading) return <Card><CardContent className="flex items-center gap-2 p-6 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading support history...</CardContent></Card>;

  return <Card className="border-primary/20">
    <CardHeader><CardTitle className="flex items-center gap-2"><Award className="h-5 w-5" /> Support Reputation & Results</CardTitle><CardDescription>Your band's support record and the exact contribution/rewards recorded for each completed show.</CardDescription></CardHeader>
    <CardContent className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Support reputation</p><p className="text-2xl font-bold">{reputation.reputation_score ?? 0}</p></div>
        <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Completed shows</p><p className="text-2xl font-bold">{completed}</p></div>
        <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Reliability</p><p className="text-2xl font-bold">{Math.round(reputation.reliability_score ?? 100)}%</p></div>
        <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Avg performance</p><p className="text-2xl font-bold">{Number(reputation.performance_score ?? 0).toFixed(1)}/25</p></div>
      </div>

      <div className="space-y-2"><div className="flex items-center justify-between text-sm"><span>Successful support shows</span><span>{successRate}%</span></div><Progress value={successRate} /></div>

      <div className="space-y-3">
        <h4 className="font-semibold">Recent support results</h4>
        {recent.length === 0 ? <p className="text-sm text-muted-foreground">No completed support shows yet.</p> : recent.map((row) => {
          const boost = Math.max(0, (Number(row.ticket_demand_multiplier || 1) - 1) * 100);
          return <div key={row.id} className="rounded-lg border p-4 space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-medium">Supporting {bandNames[row.headliner_band_id] ?? 'Headliner'}</p><p className="text-xs text-muted-foreground">{row.performed_at ? new Date(row.performed_at).toLocaleDateString() : 'Completed show'} · {row.attendance.toLocaleString()} attended</p></div><Badge variant="outline">+{row.reputation_gain} reputation</Badge></div>
            <div className="grid grid-cols-2 gap-2 text-sm md:grid-cols-4">
              <div className="rounded bg-muted/40 p-2"><span className="flex items-center gap-1 text-xs text-muted-foreground"><Ticket className="h-3.5 w-3.5" />Support payment</span><strong>{money(row.support_payment)}</strong></div>
              <div className="rounded bg-muted/40 p-2"><span className="flex items-center gap-1 text-xs text-muted-foreground"><TrendingUp className="h-3.5 w-3.5" />Ticket demand</span><strong>+{boost.toFixed(1)}%</strong></div>
              <div className="rounded bg-muted/40 p-2"><span className="flex items-center gap-1 text-xs text-muted-foreground"><Star className="h-3.5 w-3.5" />Performance</span><strong>{Number(row.performance_rating).toFixed(1)}/25</strong></div>
              <div className="rounded bg-muted/40 p-2"><span className="flex items-center gap-1 text-xs text-muted-foreground"><Banknote className="h-3.5 w-3.5" />Ticket revenue</span><strong>{money(row.ticket_revenue)}</strong></div>
              <div className="flex items-center gap-1"><Users className="h-3.5 w-3.5 text-muted-foreground" />+{row.support_fan_gain} fans</div>
              <div className="flex items-center gap-1"><TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />+{row.support_fame_gain} fame</div>
              <div className="flex items-center gap-1"><Handshake className="h-3.5 w-3.5 text-muted-foreground" />+{row.relationship_gain} relationship</div>
              <div className="flex items-center gap-1"><Award className="h-3.5 w-3.5 text-muted-foreground" />+{row.reputation_gain} reputation</div>
            </div>
          </div>;
        })}
      </div>
    </CardContent>
  </Card>;
}
