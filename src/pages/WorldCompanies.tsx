import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Search, Star, Briefcase, TrendingUp, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { FMPageScaffold } from "@/components/fm/FMPageScaffold";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

const fmt = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

interface StorefrontRow {
  company_id: string;
  price_tier: number;
  quality_score: number;
  rating_avg: number;
  rating_count: number;
  total_customers_week: number;
  total_revenue_week: number;
  now_hiring: boolean;
  tagline: string | null;
  companies: {
    id: string;
    name: string;
    company_type: string;
    reputation_score: number;
    headquarters_city_id: string | null;
    cities?: { name: string; country: string } | null;
  } | null;
}

interface ShiftRow {
  id: string;
  company_id: string;
  role: string;
  description: string | null;
  wage_per_hour: number;
  duration_hours: number;
  slots_total: number;
  slots_filled: number;
  status: string;
  companies?: { name: string; company_type: string } | null;
}

const PRICE_LABEL = ["", "Premium", "High", "Standard", "Budget", "Discount"];

export default function WorldCompanies() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const { data: storefronts = [], isLoading } = useQuery({
    queryKey: ["world-storefronts"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("company_storefront")
        .select("*, companies:company_id(id, name, company_type, reputation_score, headquarters_city_id, cities:headquarters_city_id(name, country))")
        .eq("is_public", true)
        .order("rating_avg", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as StorefrontRow[];
    },
  });

  const { data: shifts = [] } = useQuery({
    queryKey: ["open-shifts"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("company_shifts")
        .select("*, companies:company_id(name, company_type)")
        .eq("status", "open")
        .order("wage_per_hour", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as ShiftRow[];
    },
  });

  const types = useMemo(() => {
    const s = new Set<string>();
    storefronts.forEach(r => r.companies?.company_type && s.add(r.companies.company_type));
    return ["all", ...Array.from(s).sort()];
  }, [storefronts]);

  const filtered = useMemo(() => {
    return storefronts.filter(r => {
      const c = r.companies; if (!c) return false;
      if (typeFilter !== "all" && c.company_type !== typeFilter) return false;
      if (search && !c.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [storefronts, typeFilter, search]);

  return (
    <FMPageScaffold
      title="World Companies"
      eyebrow="Business"
      subtitle="Directory of every public-facing company in the world"
      icon={Briefcase}
    >
      <Tabs defaultValue="directory" className="space-y-4">
        <TabsList>
          <TabsTrigger value="directory">Directory ({storefronts.length})</TabsTrigger>
          <TabsTrigger value="shifts">Open shifts ({shifts.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="directory" className="space-y-4">
          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input className="pl-8" placeholder="Search company" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <div className="flex flex-wrap gap-1">
              {types.map(t => (
                <Badge key={t} variant={typeFilter === t ? "default" : "outline"} className="cursor-pointer" onClick={() => setTypeFilter(t)}>
                  {t === "all" ? "All" : t}
                </Badge>
              ))}
            </div>
          </div>

          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground">No companies match your filters.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {filtered.map(r => {
                const c = r.companies!;
                return (
                  <Link key={r.company_id} to={`/company/${c.id}`}>
                    <Card className="hover:border-primary transition-colors h-full">
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between gap-2">
                          <CardTitle className="text-base truncate">{c.name}</CardTitle>
                          {r.now_hiring && <Badge variant="secondary" className="text-[10px]">Hiring</Badge>}
                        </div>
                        <div className="text-xs text-muted-foreground capitalize">{c.company_type.replace(/_/g, " ")} · {c.cities?.name ?? "Unknown city"}</div>
                      </CardHeader>
                      <CardContent className="space-y-2 text-xs">
                        {r.tagline && <p className="text-muted-foreground italic">{r.tagline}</p>}
                        <div className="grid grid-cols-2 gap-2">
                          <div className="flex items-center gap-1"><Star className="h-3 w-3 text-amber-500" /> {r.rating_avg.toFixed(1)} ({r.rating_count})</div>
                          <div className="flex items-center gap-1"><TrendingUp className="h-3 w-3" /> Q{r.quality_score}</div>
                          <div className="flex items-center gap-1"><Users className="h-3 w-3" /> {r.total_customers_week}/wk</div>
                          <div>{PRICE_LABEL[r.price_tier] ?? "Standard"} pricing</div>
                        </div>
                        <div className="text-muted-foreground">Weekly revenue: {fmt.format(r.total_revenue_week ?? 0)}</div>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="shifts" className="space-y-3">
          {shifts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No open shifts right now. Check back soon.</p>
          ) : (
            shifts.map(s => (
              <Card key={s.id}>
                <CardContent className="py-3 flex flex-wrap items-center gap-3 justify-between">
                  <div>
                    <div className="font-medium">{s.companies?.name} · {s.role}</div>
                    <div className="text-xs text-muted-foreground capitalize">{s.companies?.company_type?.replace(/_/g, " ")} · {s.duration_hours}h shift</div>
                    {s.description && <div className="text-xs mt-1">{s.description}</div>}
                  </div>
                  <div className="text-right">
                    <div className="font-medium">{fmt.format(s.wage_per_hour)}/h</div>
                    <div className="text-xs text-muted-foreground">{s.slots_filled}/{s.slots_total} filled</div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </FMPageScaffold>
  );
}
