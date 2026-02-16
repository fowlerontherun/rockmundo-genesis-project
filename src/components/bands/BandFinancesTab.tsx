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
import { DollarSign, TrendingUp, PiggyBank, Receipt } from "lucide-react";

interface BandFinancesTabProps {
  bandId: string;
}

type BandRow = Database["public"]["Tables"]["bands"]["Row"];
type BandEarningRow = Database["public"]["Tables"]["band_earnings"]["Row"];

type AggregatedFinancials = {
  balance: number;
  monthlyRunway: number;
  averageDeposit: number;
  recentActivity: BandEarningRow[];
};

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
};

function getSourceLabel(source: string) {
  return sourceLabels[source] ?? source
    .split("_")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
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
  const [loading, setLoading] = useState(true);
  const [band, setBand] = useState<BandRow | null>(null);
  const [earnings, setEarnings] = useState<BandEarningRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const fetchFinances = async () => {
      setLoading(true);
      setError(null);
      try {
        const [{ data: bandData, error: bandError }, { data: earningData, error: earningError }] = await Promise.all([
          supabase
            .from("bands")
            .select("*")
            .eq("id", bandId)
            .single(),
          supabase
            .from("band_earnings")
            .select("*")
            .eq("band_id", bandId)
            .order("created_at", { ascending: false })
            .limit(20),
        ]);

        if (bandError) throw bandError;
        if (earningError) throw earningError;

        if (!isMounted) return;

        setBand((bandData as BandRow) ?? null);
        setEarnings((earningData as BandEarningRow[]) ?? []);
      } catch (caught) {
        console.error("Failed to load band finances", caught);
        if (isMounted) {
          setBand(null);
          setEarnings([]);
          setError("We were unable to load the financial data for this band.");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    void fetchFinances();

    return () => {
      isMounted = false;
    };
  }, [bandId]);

  const aggregated = useMemo<AggregatedFinancials>(() => {
    const balance = band?.band_balance ?? 0;

    if (earnings.length === 0) {
      return {
        balance,
        monthlyRunway: 0,
        averageDeposit: 0,
        recentActivity: [],
      };
    }

    const deposits = earnings.filter((earning) => earning.amount > 0);
    const expenses = earnings.filter((earning) => earning.amount < 0);

    const averageDeposit = deposits.length
      ? Math.round(deposits.reduce((sum, earning) => sum + earning.amount, 0) / deposits.length)
      : 0;

    const averageExpense = expenses.length
      ? Math.abs(expenses.reduce((sum, earning) => sum + earning.amount, 0)) / expenses.length
      : 0;

    const monthlyRunway = averageExpense > 0 ? Math.max(0, Math.round(balance / averageExpense)) : Math.max(0, balance);

    return {
      balance,
      monthlyRunway,
      averageDeposit,
      recentActivity: earnings,
    };
  }, [band, earnings]);

  if (loading) {
    return (
      <div className="space-y-6">
        {[...Array(2)].map((_, index) => (
          <Card key={index}>
            <CardHeader>
              <Skeleton className="h-6 w-1/3" />
              <Skeleton className="h-4 w-1/2" />
            </CardHeader>
            <CardContent className="space-y-3">
              {[...Array(4)].map((__, rowIndex) => (
                <Skeleton key={rowIndex} className="h-4 w-full" />
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Unable to load band finances</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!band) {
    return <p className="text-sm text-muted-foreground">Band not found.</p>;
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <PiggyBank className="h-4 w-4 text-muted-foreground" /> Current balance
            </CardTitle>
            <CardDescription>The cash reserves available for the band</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{formatCurrency(aggregated.balance)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <TrendingUp className="h-4 w-4 text-muted-foreground" /> Average deposit
            </CardTitle>
            <CardDescription>Average positive transaction over the last entries</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{formatCurrency(aggregated.averageDeposit)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Receipt className="h-4 w-4 text-muted-foreground" /> Monthly runway
            </CardTitle>
            <CardDescription>Estimated months remaining with current spend</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-end justify-between gap-4">
              <p className="text-3xl font-semibold">{aggregated.monthlyRunway}</p>
              <div className="flex-1">
                <Progress value={Math.max(0, Math.min(100, aggregated.monthlyRunway * 10))} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <DollarSign className="h-4 w-4 text-muted-foreground" /> Transactions tracked
            </CardTitle>
            <CardDescription>Recent financial activity captured in Supabase</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{earnings.length}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent transactions</CardTitle>
          <CardDescription>A snapshot of the latest financial entries for this band.</CardDescription>
        </CardHeader>
        <CardContent>
          {aggregated.recentActivity.length === 0 ? (
            <p className="text-sm text-muted-foreground">No transactions recorded yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Source</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {aggregated.recentActivity.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">{getSourceLabel(entry.source)}</span>
                        {entry.earned_by_user_id && (
                          <span className="text-xs text-muted-foreground">Recorded by {entry.earned_by_user_id}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="font-semibold">
                      <Badge variant={entry.amount >= 0 ? "default" : "destructive"}>
                        {formatCurrency(entry.amount)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {entry.description ?? "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDateTime(entry.created_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default BandFinancesTab;
