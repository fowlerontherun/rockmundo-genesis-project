import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AdminRoute } from "@/components/AdminRoute";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ResponsiveTable } from "@/components/ui/responsive-table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  ArrowLeft,
  Building2,
  Coins,
  DollarSign,
  Landmark,
  Loader2,
  Receipt,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { format } from "date-fns";

interface City { id: string; name: string; country: string; }
interface Treasury {
  id: string;
  city_id: string;
  balance: number;
  total_tax_collected: number;
  total_spent: number;
  tax_rate_pct: number;
  weekly_budget: number;
  salary_paid: number;
  pending_commitments: number;
}
interface LedgerEntry {
  id: string;
  city_id: string;
  amount: number;
  type: string;
  description: string | null;
  reference_id: string | null;
  created_at: string;
}

const fmt = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

const CityTreasuryDetail = () => {
  const { cityId } = useParams<{ cityId: string }>();
  const navigate = useNavigate();
  const [city, setCity] = useState<City | null>(null);
  const [treasury, setTreasury] = useState<Treasury | null>(null);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [directionFilter, setDirectionFilter] = useState<string>("all"); // all/credit/debit
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [search, setSearch] = useState<string>("");

  useEffect(() => {
    if (!cityId) return;
    void load();
  }, [cityId]);

  const load = async () => {
    setLoading(true);
    try {
      const [cityRes, treasuryRes, ledgerRes] = await Promise.all([
        supabase.from("cities").select("id, name, country").eq("id", cityId!).maybeSingle(),
        supabase.from("city_treasury").select("*").eq("city_id", cityId!).maybeSingle(),
        supabase
          .from("city_treasury_ledger")
          .select("*")
          .eq("city_id", cityId!)
          .order("created_at", { ascending: false })
          .limit(1000),
      ]);
      if (cityRes.error) throw cityRes.error;
      if (treasuryRes.error) throw treasuryRes.error;
      if (ledgerRes.error) throw ledgerRes.error;
      setCity(cityRes.data as City | null);
      setTreasury(treasuryRes.data as Treasury | null);
      setLedger((ledgerRes.data || []) as LedgerEntry[]);
    } catch (e) {
      console.error(e);
      toast.error("Failed to load city treasury");
    } finally {
      setLoading(false);
    }
  };

  const ledgerTypes = useMemo(() => {
    const set = new Set<string>();
    ledger.forEach((e) => set.add(e.type));
    return Array.from(set).sort();
  }, [ledger]);

  // Lifetime breakdown by type (all loaded entries, ignores active filters)
  const typeBreakdown = useMemo(() => {
    const map = new Map<string, { credits: number; debits: number; count: number }>();
    for (const e of ledger) {
      const cur = map.get(e.type) || { credits: 0, debits: 0, count: 0 };
      if (e.amount >= 0) cur.credits += e.amount;
      else cur.debits += Math.abs(e.amount);
      cur.count += 1;
      map.set(e.type, cur);
    }
    return Array.from(map.entries())
      .map(([type, v]) => ({ type, ...v, net: v.credits - v.debits }))
      .sort((a, b) => (b.credits - b.debits) - (a.credits - a.debits));
  }, [ledger]);

  const lifetimeCredits = typeBreakdown.reduce((s, t) => s + t.credits, 0);
  const lifetimeDebits = typeBreakdown.reduce((s, t) => s + t.debits, 0);

  const filtered = useMemo(() => {
    const start = startDate ? new Date(startDate).getTime() : null;
    const end = endDate ? new Date(endDate).getTime() + 24 * 60 * 60 * 1000 : null;
    const q = search.trim().toLowerCase();
    return ledger.filter((e) => {
      if (typeFilter !== "all" && e.type !== typeFilter) return false;
      if (directionFilter === "credit" && e.amount < 0) return false;
      if (directionFilter === "debit" && e.amount >= 0) return false;
      const ts = new Date(e.created_at).getTime();
      if (start && ts < start) return false;
      if (end && ts > end) return false;
      if (q && !(e.description || "").toLowerCase().includes(q) && !e.type.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [ledger, typeFilter, directionFilter, startDate, endDate, search]);

  const filteredCredits = filtered.filter((e) => e.amount > 0).reduce((s, e) => s + e.amount, 0);
  const filteredDebits = filtered.filter((e) => e.amount < 0).reduce((s, e) => s + Math.abs(e.amount), 0);
  const filteredNet = filteredCredits - filteredDebits;

  const exportCsv = () => {
    const rows = [
      ["Date", "Type", "Description", "Amount", "Reference"],
      ...filtered.map((e) => [
        new Date(e.created_at).toISOString(),
        e.type,
        (e.description || "").replace(/"/g, '""'),
        String(e.amount),
        e.reference_id || "",
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${city?.name ?? "city"}-ledger.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <AdminRoute>
        <div className="container mx-auto p-6 flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AdminRoute>
    );
  }

  if (!city) {
    return (
      <AdminRoute>
        <div className="container mx-auto p-6">
          <Button variant="ghost" onClick={() => navigate("/admin/city-treasuries")}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <p className="mt-4 text-muted-foreground">City not found.</p>
        </div>
      </AdminRoute>
    );
  }

  return (
    <AdminRoute>
      <div className="container mx-auto p-4 md:p-6 space-y-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("/admin/city-treasuries")}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Treasuries
            </Button>
            <div className="p-2 rounded-lg bg-primary/10">
              <Landmark className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold">{city.name}</h1>
              <p className="text-xs text-muted-foreground">{city.country}</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={exportCsv}>
            Export CSV
          </Button>
        </div>

        {/* Treasury KPIs */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard icon={Building2} label="Balance" value={fmt.format(treasury?.balance ?? 0)} color="text-emerald-500" />
          <KpiCard icon={TrendingUp} label="Total Tax Collected" value={fmt.format(treasury?.total_tax_collected ?? 0)} color="text-primary" />
          <KpiCard icon={DollarSign} label="Total Spent" value={fmt.format(treasury?.total_spent ?? 0)} color="text-destructive" />
          <KpiCard icon={Coins} label="Weekly Budget" value={fmt.format(treasury?.weekly_budget ?? 0)} color="text-blue-500" />
        </div>

        {/* Budget breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Budget &amp; Commitments</CardTitle>
            <CardDescription>How this city's funds are allocated</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 text-sm">
            <Stat label="Tax Rate" value={`${treasury?.tax_rate_pct ?? 0}%`} />
            <Stat label="Weekly Budget" value={fmt.format(treasury?.weekly_budget ?? 0)} />
            <Stat label="Salaries Paid" value={fmt.format(treasury?.salary_paid ?? 0)} />
            <Stat label="Pending Commitments" value={fmt.format(treasury?.pending_commitments ?? 0)} />
          </CardContent>
        </Card>

        {/* Lifetime breakdown by source */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Revenue & Spend by Source</CardTitle>
            <CardDescription>
              Lifetime totals across every credit / debit type (from the loaded ledger window).
              Use this to verify each tax stream is flowing into the treasury.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {typeBreakdown.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No ledger entries yet. Once gig income tax, record sales tax, merch sales tax, or wage
                withholdings land in this city they will appear here grouped by source.
              </p>
            ) : (
              <ResponsiveTable>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Source</TableHead>
                      <TableHead className="text-right">Entries</TableHead>
                      <TableHead className="text-right">Credits</TableHead>
                      <TableHead className="text-right">Debits</TableHead>
                      <TableHead className="text-right">Net</TableHead>
                      <TableHead className="text-right">% of Credits</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {typeBreakdown.map((row) => {
                      const pct = lifetimeCredits > 0 ? (row.credits / lifetimeCredits) * 100 : 0;
                      return (
                        <TableRow key={row.type}>
                          <TableCell>
                            <Badge variant="outline" className="text-[11px] capitalize">
                              {row.type.replace(/_/g, " ")}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right text-sm">{row.count}</TableCell>
                          <TableCell className="text-right text-emerald-500 font-medium">
                            {row.credits > 0 ? `+${fmt.format(row.credits)}` : "—"}
                          </TableCell>
                          <TableCell className="text-right text-destructive font-medium">
                            {row.debits > 0 ? `-${fmt.format(row.debits)}` : "—"}
                          </TableCell>
                          <TableCell
                            className={`text-right font-semibold ${row.net >= 0 ? "text-emerald-500" : "text-destructive"}`}
                          >
                            {row.net >= 0 ? "+" : "-"}{fmt.format(Math.abs(row.net))}
                          </TableCell>
                          <TableCell className="text-right text-xs text-muted-foreground">
                            {row.credits > 0 ? `${pct.toFixed(1)}%` : "—"}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    <TableRow className="bg-muted/40 font-semibold">
                      <TableCell>Total</TableCell>
                      <TableCell className="text-right">
                        {typeBreakdown.reduce((s, r) => s + r.count, 0)}
                      </TableCell>
                      <TableCell className="text-right text-emerald-500">
                        +{fmt.format(lifetimeCredits)}
                      </TableCell>
                      <TableCell className="text-right text-destructive">
                        -{fmt.format(lifetimeDebits)}
                      </TableCell>
                      <TableCell
                        className={`text-right ${
                          lifetimeCredits - lifetimeDebits >= 0 ? "text-emerald-500" : "text-destructive"
                        }`}
                      >
                        {lifetimeCredits - lifetimeDebits >= 0 ? "+" : "-"}
                        {fmt.format(Math.abs(lifetimeCredits - lifetimeDebits))}
                      </TableCell>
                      <TableCell />
                    </TableRow>
                  </TableBody>
                </Table>
              </ResponsiveTable>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Receipt className="h-5 w-5" /> Ledger
            </CardTitle>
            <CardDescription>
              Filter and inspect every credit and debit against this treasury (last 1,000 entries)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <div className="space-y-1">
                <Label className="text-xs">Type</Label>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    {ledgerTypes.map((t) => (
                      <SelectItem key={t} value={t} className="capitalize">{t.replace(/_/g, " ")}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Direction</Label>
                <Select value={directionFilter} onValueChange={setDirectionFilter}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="credit">Credits only</SelectItem>
                    <SelectItem value="debit">Debits only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">From</Label>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">To</Label>
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Search</Label>
                <Input placeholder="Description or type..." value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
            </div>

            {/* Filtered totals */}
            <div className="grid gap-3 sm:grid-cols-3">
              <MiniStat icon={TrendingUp} label="Filtered Credits" value={fmt.format(filteredCredits)} color="text-emerald-500" />
              <MiniStat icon={TrendingDown} label="Filtered Debits" value={fmt.format(filteredDebits)} color="text-destructive" />
              <MiniStat
                icon={DollarSign}
                label="Net"
                value={fmt.format(filteredNet)}
                color={filteredNet >= 0 ? "text-emerald-500" : "text-destructive"}
              />
            </div>

            <ScrollArea className="h-[500px]">
              <ResponsiveTable>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground py-6">
                          No ledger entries match the current filters.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filtered.map((entry) => (
                        <TableRow key={entry.id}>
                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                            {format(new Date(entry.created_at), "MMM d, yyyy HH:mm")}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-[10px] capitalize">
                              {entry.type.replace(/_/g, " ")}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm max-w-[360px] truncate">
                            {entry.description || "—"}
                          </TableCell>
                          <TableCell
                            className={`text-right font-medium ${
                              entry.amount >= 0 ? "text-emerald-500" : "text-destructive"
                            }`}
                          >
                            {entry.amount >= 0 ? "+" : "-"}
                            {fmt.format(Math.abs(entry.amount))}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </ResponsiveTable>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </AdminRoute>
  );
};

function KpiCard({
  icon: Icon, label, value, color,
}: { icon: React.ElementType; label: string; value: string; color: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
          </div>
          <Icon className={`h-8 w-8 ${color}`} />
        </div>
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold">{value}</p>
    </div>
  );
}

function MiniStat({
  icon: Icon, label, value, color,
}: { icon: React.ElementType; label: string; value: string; color: string }) {
  return (
    <div className="rounded-lg border border-border p-3 flex items-center justify-between">
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`text-lg font-semibold ${color}`}>{value}</p>
      </div>
      <Icon className={`h-5 w-5 ${color}`} />
    </div>
  );
}

export default CityTreasuryDetail;
