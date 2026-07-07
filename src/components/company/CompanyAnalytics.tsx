import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  ComposedChart,
} from "recharts";
import { Users, DollarSign, Landmark, Package, Briefcase, TrendingUp, TrendingDown } from "lucide-react";
import { format, subDays, startOfDay } from "date-fns";

interface Props {
  companyId: string;
}

const WINDOW_DAYS = 30;

const fmtCurrency = (v: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v || 0);
const fmtCompact = (v: number) =>
  new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(v || 0);

const tooltipStyle = {
  background: "hsl(var(--fm-panel-2))",
  border: "1px solid hsl(var(--fm-border))",
  borderRadius: 6,
  fontSize: 11,
  color: "hsl(var(--fm-fg))",
};
const axis = { stroke: "hsl(var(--fm-border))", fontSize: 10, tick: { fill: "hsl(var(--fm-fg-muted))" } } as const;

export const CompanyAnalytics = ({ companyId }: Props) => {
  const since = useMemo(() => startOfDay(subDays(new Date(), WINDOW_DAYS)).toISOString(), []);
  const sinceDate = useMemo(() => format(startOfDay(subDays(new Date(), WINDOW_DAYS)), "yyyy-MM-dd"), []);

  const { data, isLoading } = useQuery({
    queryKey: ["company-analytics", companyId, WINDOW_DAYS],
    queryFn: async () => {
      const [demand, tx, cityTax, employees, inventory, shifts] = await Promise.all([
        (supabase as any)
          .from("company_demand_log")
          .select("resolved_for, customers, revenue, demand_score, avg_unit_price, base_tax_rate, sales_tax_rate, combined_tax_rate, tax_amount, net_revenue")
          .eq("company_id", companyId)
          .gte("resolved_for", sinceDate)
          .order("resolved_for", { ascending: true }),
        (supabase as any)
          .from("company_transactions")
          .select("created_at, transaction_type, category, amount")
          .eq("company_id", companyId)
          .gte("created_at", since)
          .order("created_at", { ascending: true }),
        (supabase as any)
          .from("company_city_tax_payments")
          .select("paid_at, amount, tax_rate")
          .eq("company_id", companyId)
          .gte("paid_at", since)
          .order("paid_at", { ascending: true }),
        (supabase as any)
          .from("company_employees")
          .select("id, role, salary, status, hired_at, performance_rating")
          .eq("company_id", companyId),
        (supabase as any)
          .from("company_inventory")
          .select("id, name, category, unit_price, unit_cost, stock, restock_level, is_active")
          .eq("company_id", companyId),
        (supabase as any)
          .from("company_shifts")
          .select("id, role, wage_per_hour, duration_hours, slots_total, slots_filled, status, starts_at")
          .eq("company_id", companyId)
          .gte("starts_at", since),
      ]);

      return {
        demand: demand.data ?? [],
        tx: tx.data ?? [],
        cityTax: cityTax.data ?? [],
        employees: employees.data ?? [],
        inventory: inventory.data ?? [],
        shifts: shifts.data ?? [],
      };
    },
    enabled: !!companyId,
  });

  const daily = useMemo(() => {
    if (!data) return [] as any[];
    const map = new Map<string, any>();
    // seed all days
    for (let i = WINDOW_DAYS; i >= 0; i--) {
      const key = format(subDays(new Date(), i), "yyyy-MM-dd");
      map.set(key, {
        date: key,
        customers: 0,
        demandRevenue: 0,
        funding: 0,
        expenses: 0,
        taxes: 0,
        wages: 0,
        net: 0,
      });
    }
    for (const d of data.demand) {
      const key = String(d.resolved_for).slice(0, 10);
      const row = map.get(key);
      if (!row) continue;
      row.customers += Number(d.customers) || 0;
      row.demandRevenue += Number(d.revenue) || 0;
    }
    for (const t of data.tx) {
      const key = format(new Date(t.created_at), "yyyy-MM-dd");
      const row = map.get(key);
      if (!row) continue;
      const amt = Number(t.amount) || 0;
      const type = String(t.transaction_type || "").toLowerCase();
      const cat = String(t.category || "").toLowerCase();
      if (type === "funding" || cat === "funding" || cat === "loan" || cat === "capital") {
        row.funding += Math.abs(amt);
      } else if (type === "tax" || cat === "tax") {
        row.taxes += Math.abs(amt);
      } else if (cat === "wages" || cat === "payroll" || cat === "salary") {
        row.wages += Math.abs(amt);
      } else if (type === "expense" || amt < 0) {
        row.expenses += Math.abs(amt);
      }
    }
    for (const c of data.cityTax) {
      const key = format(new Date(c.paid_at), "yyyy-MM-dd");
      const row = map.get(key);
      if (!row) continue;
      row.taxes += Number(c.amount) || 0;
    }
    for (const row of map.values()) {
      row.net = row.demandRevenue + row.funding - row.expenses - row.taxes - row.wages;
    }
    return Array.from(map.values());
  }, [data]);

  const inventorySeries = useMemo(() => {
    if (!data) return [] as any[];
    return (data.inventory as any[])
      .filter(i => i.is_active !== false)
      .map(i => ({
        name: i.name?.slice(0, 18) || i.sku || "SKU",
        stock: Number(i.stock) || 0,
        restock: Number(i.restock_level) || 0,
        value: (Number(i.stock) || 0) * (Number(i.unit_price) || 0),
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [data]);

  const staffingSeries = useMemo(() => {
    if (!data) return [] as any[];
    // aggregate shift utilization by day
    const map = new Map<string, { date: string; slots: number; filled: number; wageBill: number }>();
    for (let i = WINDOW_DAYS; i >= 0; i--) {
      const key = format(subDays(new Date(), i), "yyyy-MM-dd");
      map.set(key, { date: key, slots: 0, filled: 0, wageBill: 0 });
    }
    for (const s of data.shifts as any[]) {
      const key = format(new Date(s.starts_at), "yyyy-MM-dd");
      const row = map.get(key);
      if (!row) continue;
      row.slots += Number(s.slots_total) || 0;
      row.filled += Number(s.slots_filled) || 0;
      row.wageBill += (Number(s.wage_per_hour) || 0) * (Number(s.duration_hours) || 0) * (Number(s.slots_filled) || 0);
    }
    return Array.from(map.values());
  }, [data]);

  const revenueTaxBreakdown = useMemo(() => {
    if (!data) return [] as any[];
    return (data.demand as any[])
      .slice()
      .sort((a, b) => (a.resolved_for > b.resolved_for ? 1 : -1))
      .map((d: any) => {
        const rev = Number(d.revenue) || 0;
        const tax = Number(d.tax_amount) || 0;
        const net = d.net_revenue != null ? Number(d.net_revenue) : rev - tax;
        return {
          date: String(d.resolved_for).slice(0, 10),
          customers: Number(d.customers) || 0,
          avgUnitPrice: Number(d.avg_unit_price) || 0,
          gross: rev,
          baseTaxRate: Number(d.base_tax_rate) || 0,
          salesTaxRate: Number(d.sales_tax_rate) || 0,
          combinedRate: Number(d.combined_tax_rate) || 0,
          tax,
          net,
        };
      });
  }, [data]);

  const breakdownTotals = useMemo(() => {
    return revenueTaxBreakdown.reduce(
      (acc, r) => {
        acc.customers += r.customers;
        acc.gross += r.gross;
        acc.tax += r.tax;
        acc.net += r.net;
        return acc;
      },
      { customers: 0, gross: 0, tax: 0, net: 0 }
    );
  }, [revenueTaxBreakdown]);

  const kpis = useMemo(() => {
    const last7 = daily.slice(-7);
    const prev7 = daily.slice(-14, -7);
    const sum = (arr: any[], k: string) => arr.reduce((s, r) => s + (r[k] || 0), 0);
    const custNow = sum(last7, "customers");
    const custPrev = sum(prev7, "customers");
    const revNow = sum(last7, "demandRevenue");
    const revPrev = sum(prev7, "demandRevenue");
    const taxNow = sum(last7, "taxes");
    const fundNow = sum(last7, "funding");
    const activeEmployees = (data?.employees ?? []).filter((e: any) => e.status !== "terminated").length;
    const lowStock = (data?.inventory ?? []).filter(
      (i: any) => (i.stock ?? 0) <= (i.restock_level ?? 0)
    ).length;
    const pct = (n: number, p: number) => (p === 0 ? (n > 0 ? 100 : 0) : ((n - p) / p) * 100);
    return {
      custNow,
      custDelta: pct(custNow, custPrev),
      revNow,
      revDelta: pct(revNow, revPrev),
      taxNow,
      fundNow,
      activeEmployees,
      lowStock,
    };
  }, [daily, data]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid gap-3 md:grid-cols-4">
          {[0, 1, 2, 3].map(i => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-72" />
        <div className="grid gap-3 md:grid-cols-2">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  const Delta = ({ v }: { v: number }) => {
    const up = v >= 0;
    const Icon = up ? TrendingUp : TrendingDown;
    return (
      <span
        className={`inline-flex items-center gap-1 text-[11px] ${
          up ? "text-emerald-500" : "text-rose-500"
        }`}
      >
        <Icon className="h-3 w-3" />
        {v.toFixed(1)}% vs prior 7d
      </span>
    );
  };

  return (
    <div className="space-y-4">
      {/* KPI Row */}
      <div className="grid gap-3 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center justify-between text-xs text-fm-fg-muted">
              Customers (7d)
              <Users className="h-3.5 w-3.5" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{fmtCompact(kpis.custNow)}</div>
            <Delta v={kpis.custDelta} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center justify-between text-xs text-fm-fg-muted">
              Revenue (7d)
              <DollarSign className="h-3.5 w-3.5" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{fmtCurrency(kpis.revNow)}</div>
            <Delta v={kpis.revDelta} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center justify-between text-xs text-fm-fg-muted">
              Taxes / Funding (7d)
              <Landmark className="h-3.5 w-3.5" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-semibold">
              <span className="text-rose-500">{fmtCurrency(kpis.taxNow)}</span>
              <span className="text-fm-fg-muted mx-1 text-xs">/</span>
              <span className="text-emerald-500">{fmtCurrency(kpis.fundNow)}</span>
            </div>
            <p className="text-[11px] text-fm-fg-muted">Paid out vs raised</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center justify-between text-xs text-fm-fg-muted">
              Staffing & Stock
              <Briefcase className="h-3.5 w-3.5" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-semibold">
              {kpis.activeEmployees} <span className="text-xs text-fm-fg-muted">staff</span>
            </div>
            <div className="text-[11px] text-fm-fg-muted flex items-center gap-1">
              {kpis.lowStock > 0 ? (
                <Badge variant="destructive" className="text-[10px] px-1 py-0">
                  {kpis.lowStock} low stock
                </Badge>
              ) : (
                <span>Inventory healthy</span>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Revenue Drivers Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Daily revenue drivers</CardTitle>
          <CardDescription className="text-xs">
            Stacked customer revenue and funding vs taxes, wages, and other expenses over the last {WINDOW_DAYS} days.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={daily} margin={{ top: 8, right: 12, bottom: 0, left: -8 }}>
              <CartesianGrid stroke="hsl(var(--fm-border))" strokeDasharray="2 3" vertical={false} />
              <XAxis
                dataKey="date"
                {...axis}
                tickFormatter={v => format(new Date(v), "MMM d")}
              />
              <YAxis {...axis} tickFormatter={v => `$${fmtCompact(v)}`} />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(value: number, name: string) => [fmtCurrency(value), name]}
                labelFormatter={l => format(new Date(l), "PPP")}
              />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              <Bar dataKey="demandRevenue" name="Customer revenue" stackId="in" fill="hsl(var(--fm-accent))" />
              <Bar dataKey="funding" name="Funding raised" stackId="in" fill="hsl(var(--fm-good))" />
              <Bar dataKey="taxes" name="Taxes" stackId="out" fill="hsl(var(--fm-bad))" />
              <Bar dataKey="wages" name="Wages" stackId="out" fill="#f59e0b" />
              <Bar dataKey="expenses" name="Other expenses" stackId="out" fill="#a855f7" />
              <Line type="monotone" dataKey="net" name="Net" stroke="hsl(var(--fm-fg))" strokeWidth={1.5} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Revenue & Tax Breakdown */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Landmark className="h-4 w-4" />
            Revenue & tax breakdown
          </CardTitle>
          <CardDescription className="text-xs">
            How each day's storefront outcome was priced and taxed — customers × average unit price gives gross,
            then base corporate tax (from company type) plus city sales tax (mayor law) determine tax and net.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {revenueTaxBreakdown.length === 0 ? (
            <p className="text-xs text-fm-fg-muted py-6 text-center">
              No resolved storefront demand yet in this window.
            </p>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={220}>
                <ComposedChart data={revenueTaxBreakdown} margin={{ top: 8, right: 12, bottom: 0, left: -8 }}>
                  <CartesianGrid stroke="hsl(var(--fm-border))" strokeDasharray="2 3" vertical={false} />
                  <XAxis dataKey="date" {...axis} tickFormatter={v => format(new Date(v), "MMM d")} />
                  <YAxis yAxisId="left" {...axis} tickFormatter={v => `$${fmtCompact(v)}`} />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    {...axis}
                    tickFormatter={v => `${(v * 100).toFixed(0)}%`}
                    domain={[0, 'auto']}
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(value: number, name: string) => {
                      if (name === "Combined tax rate" || name === "Avg unit price") {
                        return name === "Combined tax rate"
                          ? [`${(value * 100).toFixed(2)}%`, name]
                          : [fmtCurrency(value), name];
                      }
                      return [fmtCurrency(value), name];
                    }}
                    labelFormatter={l => format(new Date(l), "PPP")}
                  />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  <Bar yAxisId="left" dataKey="net" name="Net revenue" stackId="rev" fill="hsl(var(--fm-good))" />
                  <Bar yAxisId="left" dataKey="tax" name="Tax collected" stackId="rev" fill="hsl(var(--fm-bad))" />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="combinedRate"
                    name="Combined tax rate"
                    stroke="#f59e0b"
                    strokeWidth={1.5}
                    dot={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>

              <div className="grid grid-cols-4 gap-2 text-[11px] rounded-md border border-fm-border bg-fm-panel-2/40 p-2">
                <div>
                  <div className="text-fm-fg-muted">Customers</div>
                  <div className="font-semibold">{fmtCompact(breakdownTotals.customers)}</div>
                </div>
                <div>
                  <div className="text-fm-fg-muted">Gross</div>
                  <div className="font-semibold">{fmtCurrency(breakdownTotals.gross)}</div>
                </div>
                <div>
                  <div className="text-fm-fg-muted">Tax paid</div>
                  <div className="font-semibold text-rose-500">{fmtCurrency(breakdownTotals.tax)}</div>
                </div>
                <div>
                  <div className="text-fm-fg-muted">Net</div>
                  <div className="font-semibold text-emerald-500">{fmtCurrency(breakdownTotals.net)}</div>
                </div>
              </div>

              <div className="overflow-x-auto -mx-2">
                <table className="w-full text-[11px] min-w-[560px]">
                  <thead className="text-fm-fg-muted">
                    <tr className="border-b border-fm-border">
                      <th className="text-left font-normal py-1.5 px-2">Date</th>
                      <th className="text-right font-normal py-1.5 px-2">Cust.</th>
                      <th className="text-right font-normal py-1.5 px-2">Avg price</th>
                      <th className="text-right font-normal py-1.5 px-2">Gross</th>
                      <th className="text-right font-normal py-1.5 px-2">Base tax</th>
                      <th className="text-right font-normal py-1.5 px-2">City tax</th>
                      <th className="text-right font-normal py-1.5 px-2">Tax $</th>
                      <th className="text-right font-normal py-1.5 px-2">Net</th>
                    </tr>
                  </thead>
                  <tbody>
                    {revenueTaxBreakdown.slice().reverse().slice(0, 14).map((r) => (
                      <tr key={r.date} className="border-b border-fm-border/40">
                        <td className="py-1 px-2 whitespace-nowrap">{format(new Date(r.date), "MMM d")}</td>
                        <td className="py-1 px-2 text-right">{r.customers}</td>
                        <td className="py-1 px-2 text-right">{fmtCurrency(r.avgUnitPrice)}</td>
                        <td className="py-1 px-2 text-right">{fmtCurrency(r.gross)}</td>
                        <td className="py-1 px-2 text-right text-fm-fg-muted">{(r.baseTaxRate * 100).toFixed(1)}%</td>
                        <td className="py-1 px-2 text-right text-fm-fg-muted">{(r.salesTaxRate * 100).toFixed(1)}%</td>
                        <td className="py-1 px-2 text-right text-rose-500">{fmtCurrency(r.tax)}</td>
                        <td className="py-1 px-2 text-right text-emerald-500 font-medium">{fmtCurrency(r.net)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </CardContent>
      </Card>


      {/* Customers */}
      <div className="grid gap-3 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Customer traffic</CardTitle>
            <CardDescription className="text-xs">
              Daily resolved customer visits from the demand engine.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={daily} margin={{ top: 8, right: 12, bottom: 0, left: -8 }}>
                <defs>
                  <linearGradient id="custG" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--fm-accent))" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="hsl(var(--fm-accent))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="hsl(var(--fm-border))" strokeDasharray="2 3" vertical={false} />
                <XAxis dataKey="date" {...axis} tickFormatter={v => format(new Date(v), "MMM d")} />
                <YAxis {...axis} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value: number) => [fmtCompact(value), "Customers"]}
                  labelFormatter={l => format(new Date(l), "PPP")}
                />
                <Area
                  type="monotone"
                  dataKey="customers"
                  stroke="hsl(var(--fm-accent))"
                  fill="url(#custG)"
                  strokeWidth={1.5}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Staffing utilization</CardTitle>
            <CardDescription className="text-xs">
              Shift slots filled vs offered and the resulting wage bill per day.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <ComposedChart data={staffingSeries} margin={{ top: 8, right: 12, bottom: 0, left: -8 }}>
                <CartesianGrid stroke="hsl(var(--fm-border))" strokeDasharray="2 3" vertical={false} />
                <XAxis dataKey="date" {...axis} tickFormatter={v => format(new Date(v), "MMM d")} />
                <YAxis yAxisId="left" {...axis} />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  {...axis}
                  tickFormatter={v => `$${fmtCompact(v)}`}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value: number, name: string) =>
                    name === "Wage bill" ? [fmtCurrency(value), name] : [value, name]
                  }
                  labelFormatter={l => format(new Date(l), "PPP")}
                />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Bar yAxisId="left" dataKey="slots" name="Slots offered" fill="hsl(var(--fm-border))" />
                <Bar yAxisId="left" dataKey="filled" name="Slots filled" fill="hsl(var(--fm-accent))" />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="wageBill"
                  name="Wage bill"
                  stroke="#f59e0b"
                  strokeWidth={1.5}
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Inventory */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Package className="h-4 w-4" />
            Top inventory positions
          </CardTitle>
          <CardDescription className="text-xs">
            Stock on hand vs restock threshold for the ten highest-value SKUs. Hover for retail value.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {inventorySeries.length === 0 ? (
            <p className="text-xs text-fm-fg-muted py-8 text-center">No active inventory yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(220, inventorySeries.length * 28)}>
              <BarChart
                data={inventorySeries}
                layout="vertical"
                margin={{ top: 4, right: 12, bottom: 0, left: 8 }}
              >
                <CartesianGrid stroke="hsl(var(--fm-border))" strokeDasharray="2 3" horizontal={false} />
                <XAxis type="number" {...axis} />
                <YAxis type="category" dataKey="name" width={120} {...axis} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value: number, name: string, item: any) => {
                    if (name === "Stock") {
                      return [`${value} units · ${fmtCurrency(item.payload.value)}`, "Stock"];
                    }
                    return [value, name];
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Bar dataKey="restock" name="Restock at" fill="hsl(var(--fm-border))" />
                <Bar dataKey="stock" name="Stock" fill="hsl(var(--fm-accent))" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default CompanyAnalytics;
