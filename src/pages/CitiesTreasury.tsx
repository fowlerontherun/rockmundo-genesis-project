import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Landmark, Search, Users, TrendingUp, TrendingDown, Wallet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { FMPageScaffold } from "@/components/fm/FMPageScaffold";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ResponsiveTable } from "@/components/ui/responsive-table";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

const fmt = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const num = new Intl.NumberFormat("en-US");

interface CityRow {
  id: string;
  name: string;
  country: string;
  population: number;
  city_treasury: { balance: number; total_tax_collected: number; total_spent: number; tax_rate_pct: number; weekly_budget: number }[] | null;
}

interface PopHistoryRow {
  city_id: string;
  delta: number;
  created_at: string;
}

export default function CitiesTreasury() {
  const [search, setSearch] = useState("");

  const { data: cities = [], isLoading } = useQuery({
    queryKey: ["cities-treasury-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cities")
        .select("id,name,country,population,city_treasury(balance,total_tax_collected,total_spent,tax_rate_pct,weekly_budget)")
        .order("population", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as unknown as CityRow[];
    },
    staleTime: 60_000,
  });

  // Recent population deltas (last 7 days) per city
  const { data: popDeltas = [] } = useQuery({
    queryKey: ["city-pop-deltas-7d"],
    queryFn: async () => {
      const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
      const { data, error } = await (supabase as any)
        .from("city_population_history")
        .select("city_id,delta,created_at")
        .gte("created_at", since)
        .limit(5000);
      if (error) throw error;
      return (data ?? []) as PopHistoryRow[];
    },
    staleTime: 60_000,
  });

  const deltaByCity = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of popDeltas) m.set(r.city_id, (m.get(r.city_id) ?? 0) + (r.delta ?? 0));
    return m;
  }, [popDeltas]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = cities.map((c) => {
      const t = c.city_treasury?.[0];
      return {
        ...c,
        balance: t?.balance ?? 0,
        collected: t?.total_tax_collected ?? 0,
        spent: t?.total_spent ?? 0,
        tax: t?.tax_rate_pct ?? 0,
        weekly: t?.weekly_budget ?? 0,
        pop7d: deltaByCity.get(c.id) ?? 0,
      };
    });
    if (!q) return rows;
    return rows.filter((r) => r.name.toLowerCase().includes(q) || r.country.toLowerCase().includes(q));
  }, [cities, search, deltaByCity]);

  const totals = useMemo(() => {
    return filtered.reduce(
      (acc, r) => {
        acc.balance += r.balance;
        acc.collected += r.collected;
        acc.spent += r.spent;
        acc.population += r.population;
        return acc;
      },
      { balance: 0, collected: 0, spent: 0, population: 0 },
    );
  }, [filtered]);

  return (
    <FMPageScaffold
      title="World Treasuries"
      subtitle="Every city's population, tax rate, and treasury at a glance. Population shifts as players travel and host gigs."
      icon={Landmark}
      backTo="/hub/world-social"
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat icon={Users} label="Total population" value={num.format(totals.population)} />
          <Stat icon={Wallet} label="Combined balance" value={fmt.format(totals.balance)} accent="text-emerald-500" />
          <Stat icon={TrendingUp} label="Tax collected" value={fmt.format(totals.collected)} accent="text-primary" />
          <Stat icon={TrendingDown} label="Total spent" value={fmt.format(totals.spent)} accent="text-warning" />
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search city or country..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <Card>
          <CardContent className="p-0">
            <ResponsiveTable>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>City</TableHead>
                    <TableHead>Country</TableHead>
                    <TableHead className="text-right">Population</TableHead>
                    <TableHead className="text-right">7d Δ</TableHead>
                    <TableHead className="text-right">Tax</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                    <TableHead className="text-right">Collected</TableHead>
                    <TableHead className="text-right">Spent</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-8">
                        Loading world treasuries…
                      </TableCell>
                    </TableRow>
                  )}
                  {!isLoading && filtered.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-8">
                        No cities match your search.
                      </TableCell>
                    </TableRow>
                  )}
                  {filtered.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">
                        <Link to={`/cities/${r.id}`} className="hover:underline">
                          {r.name}
                        </Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{r.country}</TableCell>
                      <TableCell className="text-right">{num.format(r.population)}</TableCell>
                      <TableCell className="text-right">
                        {r.pop7d === 0 ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          <Badge
                            variant="outline"
                            className={r.pop7d > 0
                              ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                              : "bg-red-500/10 text-red-600 border-red-500/30"}
                          >
                            {r.pop7d > 0 ? "+" : ""}{num.format(r.pop7d)}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">{r.tax}%</TableCell>
                      <TableCell className="text-right font-medium text-emerald-500">
                        {fmt.format(r.balance)}
                      </TableCell>
                      <TableCell className="text-right">{fmt.format(r.collected)}</TableCell>
                      <TableCell className="text-right text-warning">{fmt.format(r.spent)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ResponsiveTable>
          </CardContent>
        </Card>
      </div>
    </FMPageScaffold>
  );
}

function Stat({ icon: Icon, label, value, accent }: { icon: any; label: string; value: string; accent?: string }) {
  return (
    <Card>
      <CardContent className="p-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
          <Icon className="h-3 w-3" />
          {label}
        </div>
        <div className={`text-lg font-bold ${accent ?? "text-foreground"}`}>{value}</div>
      </CardContent>
    </Card>
  );
}
