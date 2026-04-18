import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/lib/supabase-types";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  DollarSign, TrendingUp, PiggyBank, Receipt, ArrowUpRight, ArrowDownRight,
  Music, Mic, ShoppingBag, Radio, Settings, Users, Calendar,
} from "lucide-react";

interface BandFinancesTabProps {
  bandId: string;
}

type BandRow = Database["public"]["Tables"]["bands"]["Row"];
type BandEarningRow = Database["public"]["Tables"]["band_earnings"]["Row"];

const sourceLabels: Record<string, string> = {
  gig: "Gig payout",
  rehearsal: "Rehearsal expense",
  merch: "Merchandise",
  streaming: "Streaming revenue",
  release: "Release investment",
  release_sales: "Record sales",
  video_revenue: "Video revenue",
  sponsorship: "Sponsorship deal",
  pr_appearance: "PR appearance",
  refund: "Refund",
  leader_deposit: "Leader deposit",
  leader_withdrawal: "Leader withdrawal",
  recording: "Recording session",
  major_event: "Major event performance",
  weekly_pay: "Weekly member pay",
};

const sourceIcons: Record<string, React.ReactNode> = {
  gig: <Mic className="h-3.5 w-3.5" />,
  streaming: <Radio className="h-3.5 w-3.5" />,
  release_sales: <Music className="h-3.5 w-3.5" />,
  merch: <ShoppingBag className="h-3.5 w-3.5" />,
  rehearsal: <Calendar className="h-3.5 w-3.5" />,
  recording: <Music className="h-3.5 w-3.5" />,
  weekly_pay: <Users className="h-3.5 w-3.5" />,
};

function getSourceLabel(source: string) {
  return sourceLabels[source] ?? source
    .split("_")
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(" ");
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDateTime(value: string) {
  try {
    return format(new Date(value), "MMM d, yyyy h:mm a");
  } catch {
    return value;
  }
}

export function BandFinancesTab({ bandId }: BandFinancesTabProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [band, setBand] = useState<BandRow | null>(null);
  const [earnings, setEarnings] = useState<BandEarningRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLeader, setIsLeader] = useState(false);
  const [weeklyPayPct, setWeeklyPayPct] = useState(0);
  const [savingPay, setSavingPay] = useState(false);
  const [memberCount, setMemberCount] = useState(0);

  useEffect(() => {
    let isMounted = true;

    const fetchFinances = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data: { user } } = await supabase.auth.getUser();

        const [{ data: bandData, error: bandError }, { data: earningData, error: earningError }, { data: membersData }] = await Promise.all([
          supabase.from("bands").select("*").eq("id", bandId).single(),
          supabase.from("band_earnings").select("*").eq("band_id", bandId).order("created_at", { ascending: false }).limit(50),
          supabase.from("band_members").select("id, is_touring_member, user_id").eq("band_id", bandId),
        ]);

        if (bandError) throw bandError;
        if (earningError) throw earningError;

        if (!isMounted) return;

        const b = bandData as BandRow;
        setBand(b);
        setEarnings((earningData as BandEarningRow[]) ?? []);
        setWeeklyPayPct(Number((b as any).weekly_pay_percent ?? 0));
        setIsLeader(user?.id === b.leader_id);
        const realMembers = (membersData ?? []).filter(m => !m.is_touring_member);
        setMemberCount(realMembers.length);
      } catch (caught) {
        console.error("Failed to load band finances", caught);
        if (isMounted) {
          setBand(null);
          setEarnings([]);
          setError("We were unable to load the financial data for this band.");
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    void fetchFinances();
    return () => { isMounted = false; };
  }, [bandId]);

  const aggregated = useMemo(() => {
    const balance = band?.band_balance ?? 0;
    if (earnings.length === 0) {
      return { balance, totalIncome: 0, totalExpenses: 0, averageDeposit: 0, monthlyRunway: 0, recentActivity: [], bySource: {} as Record<string, number> };
    }

    const deposits = earnings.filter(e => e.amount > 0);
    const expenses = earnings.filter(e => e.amount < 0);

    const totalIncome = deposits.reduce((s, e) => s + e.amount, 0);
    const totalExpenses = Math.abs(expenses.reduce((s, e) => s + e.amount, 0));

    const averageDeposit = deposits.length ? Math.round(totalIncome / deposits.length) : 0;
    const averageExpense = expenses.length ? totalExpenses / expenses.length : 0;
    const monthlyRunway = averageExpense > 0 ? Math.max(0, Math.round(balance / averageExpense)) : Math.max(0, balance);

    const bySource: Record<string, number> = {};
    for (const e of earnings) {
      const key = e.source;
      bySource[key] = (bySource[key] ?? 0) + e.amount;
    }

    return { balance, totalIncome, totalExpenses, averageDeposit, monthlyRunway, recentActivity: earnings, bySource };
  }, [band, earnings]);

  const topSources = useMemo(() => {
    return Object.entries(aggregated.bySource)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);
  }, [aggregated.bySource]);

  const handleSaveWeeklyPay = async () => {
    const clamped = Math.max(0, Math.min(100, weeklyPayPct));
    setSavingPay(true);
    try {
      const { error } = await supabase
        .from("bands")
        .update({ weekly_pay_percent: clamped } as any)
        .eq("id", bandId);
      if (error) throw error;
      toast({
        title: "Weekly Pay Updated",
        description: `${clamped}% of band balance will be paid out each Saturday at 10:00 AM.`,
      });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSavingPay(false);
    }
  };

  const projectedTotal = Math.floor((aggregated.balance * Math.max(0, Math.min(100, weeklyPayPct))) / 100);
  const projectedPerMember = memberCount > 0 ? Math.floor(projectedTotal / memberCount) : 0;

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(2)].map((_, i) => (
          <Card key={i}>
            <CardHeader><Skeleton className="h-6 w-1/3" /><Skeleton className="h-4 w-1/2" /></CardHeader>
            <CardContent className="space-y-3">{[...Array(4)].map((__, j) => <Skeleton key={j} className="h-4 w-full" />)}</CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return <Alert variant="destructive"><AlertTitle>Unable to load band finances</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>;
  }

  if (!band) return <p className="text-sm text-muted-foreground">Band not found.</p>;

  return (
    <div className="space-y-6">
      {/* Key metrics */}
      <div className="grid gap-3 grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <PiggyBank className="h-3.5 w-3.5" /> Balance
            </div>
            <p className="text-2xl font-bold">{formatCurrency(aggregated.balance)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <ArrowUpRight className="h-3.5 w-3.5 text-emerald-500" /> Total Income
            </div>
            <p className="text-2xl font-bold text-emerald-500">{formatCurrency(aggregated.totalIncome)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <ArrowDownRight className="h-3.5 w-3.5 text-destructive" /> Total Expenses
            </div>
            <p className="text-2xl font-bold text-destructive">{formatCurrency(aggregated.totalExpenses)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <TrendingUp className="h-3.5 w-3.5" /> Runway
            </div>
            <p className="text-2xl font-bold">{aggregated.monthlyRunway} <span className="text-sm font-normal text-muted-foreground">months</span></p>
            <Progress value={Math.min(100, aggregated.monthlyRunway * 10)} className="mt-1 h-1.5" />
          </CardContent>
        </Card>
      </div>

      {/* Revenue breakdown + Weekly pay settings */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Revenue by source */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <DollarSign className="h-4 w-4" /> Revenue Breakdown
            </CardTitle>
            <CardDescription>Earnings & expenses by source</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {topSources.length === 0 ? (
              <p className="text-sm text-muted-foreground">No data yet.</p>
            ) : (
              topSources.map(([source, amount]) => {
                const maxAbs = Math.max(...topSources.map(([, v]) => Math.abs(v)), 1);
                return (
                  <div key={source} className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5 w-32 shrink-0 text-xs">
                      {sourceIcons[source] ?? <Receipt className="h-3.5 w-3.5" />}
                      <span className="truncate">{getSourceLabel(source)}</span>
                    </div>
                    <div className="flex-1">
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className={`h-full rounded-full ${amount >= 0 ? "bg-emerald-500" : "bg-destructive"}`}
                          style={{ width: `${Math.min(100, (Math.abs(amount) / maxAbs) * 100)}%` }}
                        />
                      </div>
                    </div>
                    <span className={`text-xs font-semibold w-16 text-right ${amount >= 0 ? "text-emerald-500" : "text-destructive"}`}>
                      {formatCurrency(amount)}
                    </span>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* Weekly Pay Settings */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Settings className="h-4 w-4" /> Weekly Member Pay
            </CardTitle>
            <CardDescription>
              Automatic payroll — every Saturday at 10:00 AM. A % of the band balance is split equally between real player members.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground space-y-1">
              <div className="flex justify-between">
                <span>Real members:</span>
                <span className="font-semibold text-foreground">{memberCount}</span>
              </div>
              <div className="flex justify-between">
                <span>Configured rate:</span>
                <span className="font-semibold text-foreground">{weeklyPayPct}% of balance</span>
              </div>
              <div className="flex justify-between">
                <span>Projected total payout:</span>
                <span className="font-semibold text-foreground">{formatCurrency(projectedTotal)}</span>
              </div>
              <div className="flex justify-between border-t border-border pt-1 mt-1">
                <span>Per member / week:</span>
                <span className="font-semibold text-foreground">{formatCurrency(projectedPerMember)}</span>
              </div>
            </div>

            {isLeader ? (
              <div className="space-y-2">
                <Label htmlFor="weekly-pay" className="text-xs">% of band balance per week (0–100)</Label>
                <div className="flex gap-2">
                  <Input
                    id="weekly-pay"
                    type="number"
                    min={0}
                    max={100}
                    step={0.5}
                    value={weeklyPayPct}
                    onChange={(e) =>
                      setWeeklyPayPct(Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)))
                    }
                    className="h-9"
                  />
                  <Button onClick={handleSaveWeeklyPay} disabled={savingPay} size="sm" className="h-9 px-4">
                    {savingPay ? "Saving…" : "Save"}
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Example: 10% of a {formatCurrency(aggregated.balance)} balance ={" "}
                  {formatCurrency(Math.floor(aggregated.balance * 0.1))} split between members.
                </p>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic">Only the band leader can change this setting.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent transactions */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Recent Transactions</CardTitle>
          <CardDescription>Last {aggregated.recentActivity.length} financial entries</CardDescription>
        </CardHeader>
        <CardContent>
          {aggregated.recentActivity.length === 0 ? (
            <p className="text-sm text-muted-foreground">No transactions recorded yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Source</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="hidden md:table-cell">Description</TableHead>
                    <TableHead className="text-right">Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {aggregated.recentActivity.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="text-muted-foreground">
                            {sourceIcons[entry.source] ?? <Receipt className="h-3.5 w-3.5" />}
                          </div>
                          <span className="text-xs font-medium">{getSourceLabel(entry.source)}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant={entry.amount >= 0 ? "default" : "destructive"} className="text-xs">
                          {entry.amount >= 0 ? "+" : ""}{formatCurrency(entry.amount)}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-xs text-muted-foreground max-w-[200px] truncate">
                        {entry.description ?? "—"}
                      </TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground whitespace-nowrap">
                        {formatDateTime(entry.created_at)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default BandFinancesTab;
