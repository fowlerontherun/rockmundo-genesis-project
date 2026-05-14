import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { AdminRoute } from "@/components/AdminRoute";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Building2,
  Landmark,
  Receipt,
  Music,
  ShoppingBag,
  Mic2,
  Loader2,
  DollarSign,
  TrendingUp,
  Coins,
} from "lucide-react";
import { format } from "date-fns";
import { ResponsiveTable } from "@/components/ui/responsive-table";

interface CityTreasury {
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

interface City {
  id: string;
  name: string;
  country: string;
}

interface LedgerEntry {
  id: string;
  city_id: string;
  amount: number;
  type: string;
  description: string | null;
  reference_id: string | null;
  created_at: string;
  city?: { name: string; country: string };
}

const TAX_TYPES = [
  { key: "all", label: "All Taxes", icon: Receipt },
  { key: "gig_income_tax", label: "Gig Tax", icon: Mic2 },
  { key: "record_sales_tax", label: "Record Tax", icon: Music },
  { key: "merch_sales_tax", label: "Merch Tax", icon: ShoppingBag },
];

const fmt = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

const CityTreasuryAdmin = () => {
  const [cities, setCities] = useState<City[]>([]);
  const [treasuries, setTreasuries] = useState<CityTreasury[]>([]);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch all cities
      const { data: citiesData, error: citiesError } = await supabase
        .from("cities")
        .select("id, name, country")
        .order("name");
      if (citiesError) throw citiesError;
      setCities(citiesData || []);

      // Fetch all treasuries
      const { data: treasuryData, error: treasuryError } = await supabase
        .from("city_treasury")
        .select("*");
      if (treasuryError) throw treasuryError;
      setTreasuries(treasuryData || []);

      // Fetch recent ledger entries (all tax types)
      const { data: ledgerData, error: ledgerError } = await supabase
        .from("city_treasury_ledger")
        .select("*")
        .in("type", ["gig_income_tax", "record_sales_tax", "merch_sales_tax"])
        .order("created_at", { ascending: false })
        .limit(200);
      if (ledgerError) throw ledgerError;

      // Enrich ledger with city names
      const enrichedLedger = (ledgerData || []).map((entry) => ({
        ...entry,
        city: citiesData?.find((c) => c.id === entry.city_id),
      }));
      setLedger(enrichedLedger);
    } catch (error) {
      console.error("Error fetching treasury data:", error);
      toast.error("Failed to load treasury data");
    } finally {
      setLoading(false);
    }
  };

  const filteredLedger =
    activeTab === "all"
      ? ledger
      : ledger.filter((entry) => entry.type === activeTab);

  // Build city + treasury combined rows
  const cityRows = cities
    .map((city) => {
      const t = treasuries.find((tr) => tr.city_id === city.id);
      return { city, treasury: t };
    })
    .filter((row) => row.treasury) // only cities with treasury data
    .sort((a, b) => (b.treasury?.balance ?? 0) - (a.treasury?.balance ?? 0));

  const totalBalance = treasuries.reduce((sum, t) => sum + (t.balance ?? 0), 0);
  const totalTaxCollected = treasuries.reduce((sum, t) => sum + (t.total_tax_collected ?? 0), 0);
  const totalSpent = treasuries.reduce((sum, t) => sum + (t.total_spent ?? 0), 0);

  const taxTypeBreakdown = {
    gig_income_tax: ledger.filter((e) => e.type === "gig_income_tax").reduce((s, e) => s + e.amount, 0),
    record_sales_tax: ledger.filter((e) => e.type === "record_sales_tax").reduce((s, e) => s + e.amount, 0),
    merch_sales_tax: ledger.filter((e) => e.type === "merch_sales_tax").reduce((s, e) => s + e.amount, 0),
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

  return (
    <AdminRoute>
      <div className="container mx-auto p-4 md:p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-lg bg-primary/10">
              <Landmark className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">City Treasuries</h1>
              <p className="text-muted-foreground text-sm">
                Tax revenue from gigs, records, and merch across all cities
              </p>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard icon={Building2} label="Total Balance" value={fmt.format(totalBalance)} color="text-emerald-500" />
          <SummaryCard icon={TrendingUp} label="Total Tax Collected" value={fmt.format(totalTaxCollected)} color="text-primary" />
          <SummaryCard icon={DollarSign} label="Total Spent" value={fmt.format(totalSpent)} color="text-destructive" />
          <SummaryCard icon={Coins} label="Cities with Treasury" value={`${cityRows.length} / ${cities.length}`} color="text-blue-500" />
        </div>

        {/* Tax Breakdown */}
        <div className="grid gap-4 sm:grid-cols-3">
          <TaxBreakdownCard icon={Mic2} label="Gig Income Tax" amount={taxTypeBreakdown.gig_income_tax} color="bg-orange-500/10 text-orange-500" />
          <TaxBreakdownCard icon={Music} label="Record Sales Tax" amount={taxTypeBreakdown.record_sales_tax} color="bg-purple-500/10 text-purple-500" />
          <TaxBreakdownCard icon={ShoppingBag} label="Merch Sales Tax" amount={taxTypeBreakdown.merch_sales_tax} color="bg-cyan-500/10 text-cyan-500" />
        </div>

        {/* City Treasuries Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              City Treasury Balances
            </CardTitle>
            <CardDescription>
              All cities sorted by balance (highest first)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveTable>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>City</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                    <TableHead className="text-right">Tax Collected</TableHead>
                    <TableHead className="text-right">Total Spent</TableHead>
                    <TableHead className="text-right">Tax Rate</TableHead>
                    <TableHead className="text-right">Weekly Budget</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cityRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-6">
                        No treasury data found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    cityRows.map((row) => (
                      <TableRow key={row.city.id}>
                        <TableCell className="font-medium">
                          {row.city.name}
                          <span className="block text-xs text-muted-foreground">{row.city.country}</span>
                        </TableCell>
                        <TableCell className="text-right font-medium text-emerald-500">
                          {fmt.format(row.treasury?.balance ?? 0)}
                        </TableCell>
                        <TableCell className="text-right">
                          {fmt.format(row.treasury?.total_tax_collected ?? 0)}
                        </TableCell>
                        <TableCell className="text-right">
                          {fmt.format(row.treasury?.total_spent ?? 0)}
                        </TableCell>
                        <TableCell className="text-right">
                          {row.treasury?.tax_rate_pct ?? 0}%
                        </TableCell>
                        <TableCell className="text-right">
                          {fmt.format(row.treasury?.weekly_budget ?? 0)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </ResponsiveTable>
          </CardContent>
        </Card>

        {/* Ledger Tabs */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              Tax Ledger Entries
            </CardTitle>
            <CardDescription>
              Recent transactions by tax type
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="mb-4">
                {TAX_TYPES.map((t) => (
                  <TabsTrigger key={t.key} value={t.key} className="flex items-center gap-2">
                    <t.icon className="h-4 w-4" />
                    <span className="hidden sm:inline">{t.label}</span>
                  </TabsTrigger>
                ))}
              </TabsList>
              <TabsContent value={activeTab}>
                <ScrollArea className="h-[400px]">
                  <ResponsiveTable>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>City</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                          <TableHead className="text-right">Date</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredLedger.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                              No ledger entries for this filter.
                            </TableCell>
                          </TableRow>
                        ) : (
                          filteredLedger.map((entry) => (
                            <TableRow key={entry.id}>
                              <TableCell className="font-medium">
                                {entry.city?.name || "Unknown"}
                                <span className="block text-xs text-muted-foreground">
                                  {entry.city?.country || ""}
                                </span>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className="text-xs capitalize">
                                  {entry.type.replace(/_/g, " ")}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-sm max-w-[200px] truncate">
                                {entry.description || "—"}
                              </TableCell>
                              <TableCell className="text-right font-medium text-emerald-500">
                                {fmt.format(entry.amount)}
                              </TableCell>
                              <TableCell className="text-right text-xs text-muted-foreground">
                                {format(new Date(entry.created_at), "MMM d, HH:mm")}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </ResponsiveTable>
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </AdminRoute>
  );
};

function SummaryCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  color: string;
}) {
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

function TaxBreakdownCard({
  icon: Icon,
  label,
  amount,
  color,
}: {
  icon: React.ElementType;
  label: string;
  amount: number;
  color: string;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${color}`}>
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="text-xl font-bold">{fmt.format(amount)}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default CityTreasuryAdmin;
