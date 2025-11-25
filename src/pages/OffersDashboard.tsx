import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  ArrowUpRight,
  Banknote,
  CheckCircle2,
  Filter,
  Link as LinkIcon,
  Send,
  TrendingUp,
} from "lucide-react";

interface ContractRecord {
  id: string;
  brand: string;
  entityName: string;
  entityType: string;
  fameTier: string;
  offerDate: string;
  status: "sent" | "accepted" | "rejected" | "breached" | "expired" | "pending";
  basePayout: number;
  bonusPayout: number;
  bonusesTriggered: string[];
  breachReason?: string;
  fameImpact: number;
  contractUrl: string;
}

const contractRecords: ContractRecord[] = [
  {
    id: "CTR-4021",
    brand: "Starlite Audio",
    entityName: "Neon Bridge",
    entityType: "band",
    fameTier: "Rising Star",
    offerDate: "2024-06-03",
    status: "accepted",
    basePayout: 55000,
    bonusPayout: 12000,
    bonusesTriggered: ["Merch milestone", "Regional sellouts"],
    fameImpact: 14,
    contractUrl: "/legal/contracts/CTR-4021",
  },
  {
    id: "CTR-4014",
    brand: "Pulse Cola",
    entityName: "Aster Vega",
    entityType: "influencer",
    fameTier: "A-List",
    offerDate: "2024-05-18",
    status: "accepted",
    basePayout: 88000,
    bonusPayout: 22000,
    bonusesTriggered: ["Engagement bonus"],
    fameImpact: 21,
    contractUrl: "/legal/contracts/CTR-4014",
  },
  {
    id: "CTR-3999",
    brand: "Volt Wear",
    entityName: "Silver Riot",
    entityType: "band",
    fameTier: "Headliner",
    offerDate: "2024-05-02",
    status: "breached",
    basePayout: 62000,
    bonusPayout: 0,
    bonusesTriggered: [],
    breachReason: "Missed exclusivity window",
    fameImpact: -8,
    contractUrl: "/legal/contracts/CTR-3999",
  },
  {
    id: "CTR-3982",
    brand: "Nightwave Energy",
    entityName: "DJ Aria",
    entityType: "dj",
    fameTier: "Rising Star",
    offerDate: "2024-04-22",
    status: "expired",
    basePayout: 30000,
    bonusPayout: 6000,
    bonusesTriggered: ["Launch bonus"],
    fameImpact: 2,
    contractUrl: "/legal/contracts/CTR-3982",
  },
  {
    id: "CTR-3965",
    brand: "Aurora Threads",
    entityName: "The Mainstay",
    entityType: "band",
    fameTier: "Local Hero",
    offerDate: "2024-04-08",
    status: "accepted",
    basePayout: 26000,
    bonusPayout: 4000,
    bonusesTriggered: ["Sell-through bonus"],
    fameImpact: 7,
    contractUrl: "/legal/contracts/CTR-3965",
  },
  {
    id: "CTR-3950",
    brand: "Nova Cola",
    entityName: "Rifted",
    entityType: "band",
    fameTier: "Headliner",
    offerDate: "2024-03-30",
    status: "accepted",
    basePayout: 94000,
    bonusPayout: 16000,
    bonusesTriggered: ["Bonus: arena sellouts"],
    fameImpact: 26,
    contractUrl: "/legal/contracts/CTR-3950",
  },
  {
    id: "CTR-3922",
    brand: "Starlite Audio",
    entityName: "Echo & Ember",
    entityType: "band",
    fameTier: "Rising Star",
    offerDate: "2024-03-10",
    status: "rejected",
    basePayout: 18000,
    bonusPayout: 0,
    bonusesTriggered: [],
    fameImpact: -1,
    contractUrl: "/legal/contracts/CTR-3922",
  },
  {
    id: "CTR-3890",
    brand: "Pulse Cola",
    entityName: "The Monument",
    entityType: "band",
    fameTier: "A-List",
    offerDate: "2024-02-27",
    status: "sent",
    basePayout: 52000,
    bonusPayout: 10000,
    bonusesTriggered: [],
    fameImpact: 0,
    contractUrl: "/legal/contracts/CTR-3890",
  },
  {
    id: "CTR-3866",
    brand: "Volt Wear",
    entityName: "Keira Lux",
    entityType: "influencer",
    fameTier: "Rising Star",
    offerDate: "2024-02-14",
    status: "accepted",
    basePayout: 34000,
    bonusPayout: 5000,
    bonusesTriggered: ["Share velocity"],
    fameImpact: 9,
    contractUrl: "/legal/contracts/CTR-3866",
  },
  {
    id: "CTR-3842",
    brand: "Nightwave Energy",
    entityName: "Tempo Syndicate",
    entityType: "dj",
    fameTier: "Local Hero",
    offerDate: "2024-01-29",
    status: "accepted",
    basePayout: 24000,
    bonusPayout: 3500,
    bonusesTriggered: ["Streaming milestone"],
    fameImpact: 6,
    contractUrl: "/legal/contracts/CTR-3842",
  },
];

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);

const OffersDashboard = () => {
  const [entityType, setEntityType] = useState<string>("all");
  const [brand, setBrand] = useState<string>("all");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  const filteredRecords = useMemo(() => {
    return contractRecords.filter(record => {
      if (entityType !== "all" && record.entityType !== entityType) return false;
      if (brand !== "all" && record.brand !== brand) return false;

      const offerTime = new Date(record.offerDate).getTime();
      if (startDate && offerTime < new Date(startDate).getTime()) return false;
      if (endDate && offerTime > new Date(endDate).getTime()) return false;

      return true;
    });
  }, [entityType, brand, startDate, endDate]);

  const offersSent = filteredRecords.length;
  const acceptedOffers = filteredRecords.filter(record => record.status === "accepted");
  const offersAccepted = acceptedOffers.length;
  const acceptanceRate = offersSent === 0 ? 0 : Math.round((offersAccepted / offersSent) * 100);
  const totalPayout = acceptedOffers.reduce(
    (sum, record) => sum + record.basePayout + record.bonusPayout,
    0,
  );

  const fameTierAverages = useMemo(() => {
    const grouped = new Map<string, { total: number; count: number }>();

    acceptedOffers.forEach(record => {
      const current = grouped.get(record.fameTier) || { total: 0, count: 0 };
      grouped.set(record.fameTier, {
        total: current.total + record.basePayout + record.bonusPayout,
        count: current.count + 1,
      });
    });

    return Array.from(grouped.entries()).map(([tier, { total, count }]) => ({
      tier,
      average: count === 0 ? 0 : total / count,
    }));
  }, [acceptedOffers]);

  const brandTable = useMemo(() => {
    const grouped = new Map<
      string,
      { sent: number; accepted: number; payout: number; acceptanceRate: number }
    >();

    filteredRecords.forEach(record => {
      const current =
        grouped.get(record.brand) || { sent: 0, accepted: 0, payout: 0, acceptanceRate: 0 };
      current.sent += 1;
      if (record.status === "accepted") {
        current.accepted += 1;
        current.payout += record.basePayout + record.bonusPayout;
      }
      grouped.set(record.brand, current);
    });

    return Array.from(grouped.entries())
      .map(([name, metrics]) => ({
        name,
        ...metrics,
        acceptanceRate: metrics.sent === 0 ? 0 : Math.round((metrics.accepted / metrics.sent) * 100),
      }))
      .sort((a, b) => b.payout - a.payout)
      .slice(0, 6);
  }, [filteredRecords]);

  const entityTable = useMemo(() => {
    const grouped = new Map<string, { brand: string; payout: number; fameImpact: number }>();

    filteredRecords.forEach(record => {
      if (record.status !== "accepted") return;
      const current = grouped.get(record.entityName) || { brand: record.brand, payout: 0, fameImpact: 0 };
      grouped.set(record.entityName, {
        brand: current.brand,
        payout: current.payout + record.basePayout + record.bonusPayout,
        fameImpact: current.fameImpact + record.fameImpact,
      });
    });

    return Array.from(grouped.entries())
      .map(([name, metrics]) => ({ name, ...metrics }))
      .sort((a, b) => b.payout - a.payout)
      .slice(0, 6);
  }, [filteredRecords]);

  const brandPerformance = useMemo(() => {
    const byBrand = new Map<string, number>();

    acceptedOffers.forEach(record => {
      const total = record.basePayout + record.bonusPayout;
      byBrand.set(record.brand, (byBrand.get(record.brand) || 0) + total);
    });

    return Array.from(byBrand.entries())
      .map(([name, payout]) => ({ name, payout }))
      .sort((a, b) => b.payout - a.payout)
      .slice(0, 5);
  }, [acceptedOffers]);

  const entityPerformance = useMemo(() => {
    return acceptedOffers
      .map(record => ({
        name: record.entityName,
        payout: record.basePayout + record.bonusPayout,
        fameImpact: record.fameImpact,
      }))
      .sort((a, b) => b.payout - a.payout)
      .slice(0, 5);
  }, [acceptedOffers]);

  const trendlineData = useMemo(() => {
    const byMonth = new Map<
      string,
      { sent: number; accepted: number; payout: number; label: string }
    >();

    filteredRecords.forEach(record => {
      const date = new Date(record.offerDate);
      const monthKey = `${date.getFullYear()}-${date.getMonth()}`;
      const label = date.toLocaleString("en-US", { month: "short", year: "2-digit" });
      const current =
        byMonth.get(monthKey) || { sent: 0, accepted: 0, payout: 0, label };

      current.sent += 1;
      if (record.status === "accepted") {
        current.accepted += 1;
        current.payout += record.basePayout + record.bonusPayout;
      }

      byMonth.set(monthKey, current);
    });

    return Array.from(byMonth.entries())
      .map(([key, values]) => ({ monthKey: key, month: values.label, ...values }))
      .sort((a, b) => a.monthKey.localeCompare(b.monthKey));
  }, [filteredRecords]);

  const outcomeHighlights = useMemo(() => {
    return filteredRecords
      .flatMap(record => {
        const highlights = [] as {
          id: string;
          type: "bonus" | "breach" | "expiration";
          description: string;
          fameImpact: number;
        }[];

        if (record.bonusesTriggered.length > 0) {
          highlights.push({
            id: `${record.id}-bonus`,
            type: "bonus",
            fameImpact: record.fameImpact,
            description: `${record.entityName} unlocked ${record.bonusesTriggered.join(
              ", ",
            )} (${record.brand})`,
          });
        }

        if (record.status === "breached") {
          highlights.push({
            id: `${record.id}-breach`,
            type: "breach",
            fameImpact: record.fameImpact,
            description: `${record.entityName} breach: ${record.breachReason ?? "unspecified"}`,
          });
        }

        if (record.status === "expired") {
          highlights.push({
            id: `${record.id}-expired`,
            type: "expiration",
            fameImpact: record.fameImpact,
            description: `${record.entityName}'s ${record.brand} offer expired`,
          });
        }

        return highlights;
      })
      .slice(0, 6);
  }, [filteredRecords]);

  const fameImpactTotal = filteredRecords.reduce((sum, record) => sum + record.fameImpact, 0);

  const uniqueEntityTypes = Array.from(
    new Set(contractRecords.map(record => record.entityType)),
  );
  const uniqueBrands = Array.from(new Set(contractRecords.map(record => record.brand)));

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Offer & Contract Intelligence</p>
          <h1 className="text-2xl font-bold">Partnership Dashboard</h1>
        </div>
        <Badge variant="outline" className="flex items-center gap-2 px-3 py-1">
          <Filter className="h-4 w-4" />
          Live KPIs
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Filter className="h-5 w-5 text-muted-foreground" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Entity Type</p>
            <Select value={entityType} onValueChange={setEntityType}>
              <SelectTrigger>
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {uniqueEntityTypes.map(type => (
                  <SelectItem key={type} value={type}>
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Brand</p>
            <Select value={brand} onValueChange={setBrand}>
              <SelectTrigger>
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {uniqueBrands.map(brandName => (
                  <SelectItem key={brandName} value={brandName}>
                    {brandName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Start Date</p>
            <Input
              type="date"
              value={startDate}
              onChange={event => setStartDate(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">End Date</p>
            <Input
              type="date"
              value={endDate}
              onChange={event => setEndDate(event.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-primary/10 to-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <Send className="h-4 w-4 text-primary" />
              Offers Sent
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{offersSent}</p>
            <p className="text-xs text-muted-foreground">Within selected range</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              Offers Accepted
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{offersAccepted}</p>
            <p className="text-xs text-muted-foreground">Converted to signed contracts</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <TrendingUp className="h-4 w-4 text-blue-500" />
              Acceptance Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{acceptanceRate}%</p>
            <p className="text-xs text-muted-foreground">Compared to sent volume</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <Banknote className="h-4 w-4 text-amber-500" />
              Total Payout
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{formatCurrency(totalPayout)}</p>
            <p className="text-xs text-muted-foreground">Base + triggered bonuses</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <ArrowUpRight className="h-5 w-5 text-emerald-500" />
            Average payout per fame tier
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="md:col-span-2 h-[220px]">
            {fameTierAverages.length === 0 ? (
              <p className="text-sm text-muted-foreground">No accepted offers in range.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={fameTierAverages}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="tier" />
                  <YAxis tickFormatter={value => formatCurrency(Number(value))} />
                  <Tooltip formatter={value => formatCurrency(Number(value))} />
                  <Bar dataKey="average" fill="#a855f7" name="Avg payout" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="space-y-3">
            {fameTierAverages.length === 0 ? (
              <p className="text-sm text-muted-foreground">No tiers to summarize.</p>
            ) : (
              fameTierAverages.map(item => (
                <div key={item.tier} className="rounded-lg border p-3">
                  <p className="text-xs uppercase text-muted-foreground">{item.tier}</p>
                  <p className="text-lg font-bold">{formatCurrency(item.average)}</p>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="h-[360px]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <TrendingUp className="h-5 w-5 text-blue-500" />
              Top-performing brands
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[280px]">
            {brandPerformance.length === 0 ? (
              <p className="text-sm text-muted-foreground">No accepted offers to chart.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={brandPerformance}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis tickFormatter={formatCurrency} />
                  <Tooltip formatter={value => formatCurrency(Number(value))} />
                  <Legend />
                  <Bar dataKey="payout" fill="#22c55e" name="Total payout" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="h-[360px]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <ArrowUpRight className="h-5 w-5 text-primary" />
              Top-performing entities
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[280px]">
            {entityPerformance.length === 0 ? (
              <p className="text-sm text-muted-foreground">No accepted offers to chart.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={entityPerformance}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis tickFormatter={formatCurrency} />
                  <Tooltip formatter={value => formatCurrency(Number(value))} />
                  <Legend />
                  <Bar dataKey="payout" fill="#3b82f6" name="Total payout" />
                  <Bar dataKey="fameImpact" fill="#a855f7" name="Fame impact" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="h-[420px]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Line className="h-5 w-5 text-emerald-500" />
            Offer momentum over time
          </CardTitle>
        </CardHeader>
        <CardContent className="h-[320px]">
          {trendlineData.length === 0 ? (
            <p className="text-sm text-muted-foreground">No offers in selected range.</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendlineData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis yAxisId="left" allowDecimals={false} />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tickFormatter={formatCurrency}
                  allowDecimals={false}
                />
                <Tooltip
                  formatter={(value, name) =>
                    name === "Total payout"
                      ? formatCurrency(Number(value))
                      : Number(value)
                  }
                />
                <Legend />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="sent"
                  stroke="#94a3b8"
                  name="Offers sent"
                />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="accepted"
                  stroke="#22c55e"
                  name="Offers accepted"
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="payout"
                  stroke="#f59e0b"
                  name="Total payout"
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              Contract outcomes & fame impact
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm text-muted-foreground">Net fame delta (selected)</p>
                <p className="text-2xl font-bold">{fameImpactTotal >= 0 ? "+" : ""}{fameImpactTotal}</p>
              </div>
              <Badge variant={fameImpactTotal >= 0 ? "default" : "destructive"}>
                {fameImpactTotal >= 0 ? "Uplift" : "Penalty"}
              </Badge>
            </div>

            {outcomeHighlights.length === 0 ? (
              <p className="text-sm text-muted-foreground">No highlight events in range.</p>
            ) : (
              <div className="space-y-2">
                {outcomeHighlights.map(item => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div className="flex items-center gap-3">
                      {item.type === "bonus" && (
                        <Badge className="bg-emerald-500/10 text-emerald-600">Bonus</Badge>
                      )}
                      {item.type === "breach" && (
                        <Badge className="bg-red-500/10 text-red-600">Breach</Badge>
                      )}
                      {item.type === "expiration" && (
                        <Badge className="bg-amber-500/10 text-amber-600">Expired</Badge>
                      )}
                      <p className="text-sm">{item.description}</p>
                    </div>
                    <span
                      className={`text-sm font-semibold ${
                        item.fameImpact >= 0 ? "text-emerald-600" : "text-red-600"
                      }`}
                    >
                      {item.fameImpact >= 0 ? "+" : ""}
                      {item.fameImpact} fame
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <LinkIcon className="h-5 w-5 text-primary" />
              Offers & contracts
            </CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableCaption>Filtered offers with direct links to records.</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>Brand</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>Fame</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Payout</TableHead>
                  <TableHead className="text-right">Fame Δ</TableHead>
                  <TableHead className="text-right">Record</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRecords.map(record => (
                  <TableRow key={record.id}>
                    <TableCell className="font-medium">{record.brand}</TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <p className="font-medium leading-none">{record.entityName}</p>
                        <p className="text-xs text-muted-foreground">{record.entityType}</p>
                      </div>
                    </TableCell>
                    <TableCell>{record.fameTier}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          record.status === "accepted"
                            ? "default"
                            : record.status === "sent" || record.status === "pending"
                              ? "secondary"
                              : record.status === "breached" || record.status === "expired"
                                ? "destructive"
                                : "outline"
                        }
                      >
                        {record.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(record.basePayout + record.bonusPayout)}
                    </TableCell>
                    <TableCell
                      className={`text-right ${
                        record.fameImpact >= 0 ? "text-emerald-600" : "text-red-600"
                      }`}
                    >
                      {record.fameImpact >= 0 ? "+" : ""}
                      {record.fameImpact}
                    </TableCell>
                    <TableCell className="text-right">
                      <Link
                        to={record.contractUrl}
                        className="text-primary hover:underline inline-flex items-center gap-1"
                      >
                        View
                        <ArrowUpRight className="h-3 w-3" />
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <TrendingUp className="h-5 w-5 text-emerald-500" />
              Top brand & entity tables
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold">Brands by payout</p>
                <Badge variant="outline">Top {brandTable.length || 0}</Badge>
              </div>
              <ScrollArea className="h-[180px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Brand</TableHead>
                      <TableHead className="text-right">Payout</TableHead>
                      <TableHead className="text-right">Accepted</TableHead>
                      <TableHead className="text-right">Acceptance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {brandTable.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
                          No data in selected range.
                        </TableCell>
                      </TableRow>
                    ) : (
                      brandTable.map(row => (
                        <TableRow key={row.name}>
                          <TableCell className="font-medium">{row.name}</TableCell>
                          <TableCell className="text-right">{formatCurrency(row.payout)}</TableCell>
                          <TableCell className="text-right">{row.accepted}</TableCell>
                          <TableCell className="text-right">{row.acceptanceRate}%</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold">Entities by payout</p>
                <Badge variant="outline">Top {entityTable.length || 0}</Badge>
              </div>
              <ScrollArea className="h-[180px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Entity</TableHead>
                      <TableHead>Lead brand</TableHead>
                      <TableHead className="text-right">Payout</TableHead>
                      <TableHead className="text-right">Fame Δ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entityTable.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
                          No accepted entities in range.
                        </TableCell>
                      </TableRow>
                    ) : (
                      entityTable.map(row => (
                        <TableRow key={row.name}>
                          <TableCell className="font-medium">{row.name}</TableCell>
                          <TableCell>{row.brand}</TableCell>
                          <TableCell className="text-right">{formatCurrency(row.payout)}</TableCell>
                          <TableCell
                            className={`text-right ${row.fameImpact >= 0 ? "text-emerald-600" : "text-red-600"}`}
                          >
                            {row.fameImpact >= 0 ? "+" : ""}
                            {row.fameImpact}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </div>
          </CardContent>
        </Card>
      </div>

    </div>
  );
};

export default OffersDashboard;
