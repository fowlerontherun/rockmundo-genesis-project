import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
import {
  Banknote,
  CheckCircle2,
  Filter,
  Send,
  TrendingUp,
  Loader2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth-context";
import { useGameData } from "@/hooks/useGameData";

interface UnifiedOffer {
  id: string;
  source: string;
  title: string;
  status: string;
  payout: number;
  date: string;
  fameImpact: number;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);

const statusBadge = (status: string) => {
  switch (status) {
    case "accepted": return <Badge className="bg-success/80 text-success-foreground">Accepted</Badge>;
    case "completed": return <Badge className="bg-success">Completed</Badge>;
    case "pending": return <Badge variant="outline">Pending</Badge>;
    case "declined":
    case "rejected": return <Badge variant="destructive">Declined</Badge>;
    case "expired": return <Badge variant="secondary">Expired</Badge>;
    default: return <Badge>{status}</Badge>;
  }
};

const OffersDashboard = () => {
  const { user } = useAuth();
  const [sourceFilter, setSourceFilter] = useState<string>("all");

  const userId = user?.id;

  // Fetch user's band id
  const { data: bandData } = useQuery({
    queryKey: ["user-band-id", userId],
    queryFn: async () => {
      if (!userId) return null;
      const { data } = await supabase
        .from("band_members")
        .select("band_id")
        .eq("user_id", userId)
        .limit(1)
        .single();
      return data?.band_id || null;
    },
    enabled: !!userId,
  });
  const bandId = bandData;

  // Fetch all offer sources in parallel
  const { data: modelingOffers, isLoading: loadingModeling } = useQuery({
    queryKey: ["offers-modeling", userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data } = await supabase
        .from("player_modeling_contracts")
        .select("id, status, compensation, fame_boost, created_at, gig:modeling_gigs(title)")
        .eq("user_id", userId);
      return (data || []).map((r: any) => ({
        id: r.id,
        source: "Modeling",
        title: r.gig?.title || "Modeling Gig",
        status: r.status,
        payout: r.compensation || 0,
        date: r.created_at,
        fameImpact: r.fame_boost || 0,
      }));
    },
    enabled: !!userId,
  });

  const { data: mediaOffers, isLoading: loadingMedia } = useQuery({
    queryKey: ["offers-media", userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data } = await supabase
        .from("pr_media_offers")
        .select("id, status, compensation, fame_boost, created_at, show_name, outlet_name")
        .eq("user_id", userId);
      return (data || []).map((r: any) => ({
        id: r.id,
        source: "Media",
        title: r.show_name || r.outlet_name || "Media Appearance",
        status: r.status,
        payout: r.compensation || 0,
        date: r.created_at,
        fameImpact: r.fame_boost || 0,
      }));
    },
    enabled: !!userId,
  });

  const { data: gigOffers, isLoading: loadingGigs } = useQuery({
    queryKey: ["offers-gigs", bandId],
    queryFn: async () => {
      if (!bandId) return [];
      const { data } = await supabase
        .from("gig_offers")
        .select("id, status, base_payout, offer_reason, created_at, metadata")
        .eq("band_id", bandId);
      return (data || []).map((r: any) => ({
        id: r.id,
        source: "Gig",
        title: (r.metadata as any)?.venue_name || "Gig Offer",
        status: r.status,
        payout: Number(r.base_payout) || 0,
        date: r.created_at,
        fameImpact: 0,
      }));
    },
    enabled: !!bandId,
  });

  const { data: sponsorshipOffers, isLoading: loadingSponsors } = useQuery({
    queryKey: ["offers-sponsorships", bandId],
    queryFn: async () => {
      if (!bandId) return [];
      const { data } = await supabase
        .from("sponsorship_offers")
        .select("id, status, payout, total_value, created_at, metadata")
        .eq("band_id", bandId);
      return (data || []).map((r: any) => ({
        id: r.id,
        source: "Sponsorship",
        title: (r.metadata as any)?.brand_name || "Sponsorship Deal",
        status: r.status,
        payout: Number(r.payout || r.total_value) || 0,
        date: r.created_at,
        fameImpact: 0,
      }));
    },
    enabled: !!bandId,
  });

  const isLoading = loadingModeling || loadingMedia || loadingGigs || loadingSponsors;

  const allOffers: UnifiedOffer[] = useMemo(() => {
    const combined = [
      ...(modelingOffers || []),
      ...(mediaOffers || []),
      ...(gigOffers || []),
      ...(sponsorshipOffers || []),
    ];
    if (sourceFilter !== "all") {
      return combined.filter(o => o.source === sourceFilter);
    }
    return combined.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [modelingOffers, mediaOffers, gigOffers, sponsorshipOffers, sourceFilter]);

  const offersSent = allOffers.length;
  const accepted = allOffers.filter(o => ["accepted", "completed"].includes(o.status));
  const offersAccepted = accepted.length;
  const acceptanceRate = offersSent === 0 ? 0 : Math.round((offersAccepted / offersSent) * 100);
  const totalPayout = accepted.reduce((sum, o) => sum + o.payout, 0);

  const trendlineData = useMemo(() => {
    const byMonth = new Map<string, { sent: number; accepted: number; payout: number; label: string }>();
    allOffers.forEach(offer => {
      const d = new Date(offer.date);
      const key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2, "0")}`;
      const label = d.toLocaleString("en-US", { month: "short", year: "2-digit" });
      const cur = byMonth.get(key) || { sent: 0, accepted: 0, payout: 0, label };
      cur.sent += 1;
      if (["accepted", "completed"].includes(offer.status)) {
        cur.accepted += 1;
        cur.payout += offer.payout;
      }
      byMonth.set(key, cur);
    });
    return Array.from(byMonth.entries())
      .map(([key, values]) => ({ monthKey: key, month: values.label, ...values }))
      .sort((a, b) => a.monthKey.localeCompare(b.monthKey));
  }, [allOffers]);

  const sourceBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    accepted.forEach(o => map.set(o.source, (map.get(o.source) || 0) + o.payout));
    return Array.from(map.entries())
      .map(([name, payout]) => ({ name, payout }))
      .sort((a, b) => b.payout - a.payout);
  }, [accepted]);

  const uniqueSources = ["Modeling", "Media", "Gig", "Sponsorship"];

  if (!user) {
    return (
      <div className="container mx-auto p-6">
        <p className="text-muted-foreground">Please log in to view your offers.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Offer & Contract Intelligence</p>
          <h1 className="text-2xl font-bold">Partnership Dashboard</h1>
        </div>
        {isLoading && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
      </div>

      {/* Filter */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={sourceFilter} onValueChange={setSourceFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="All Sources" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sources</SelectItem>
                {uniqueSources.map(s => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-primary/10 to-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <Send className="h-4 w-4 text-primary" />
              Total Offers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{offersSent}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <CheckCircle2 className="h-4 w-4 text-success" />
              Accepted
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{offersAccepted}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <TrendingUp className="h-4 w-4 text-warning" />
              Accept Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{acceptanceRate}%</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <Banknote className="h-4 w-4 text-success" />
              Total Payout
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{formatCurrency(totalPayout)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {trendlineData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Offers Over Time</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={trendlineData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="sent" name="Sent" stroke="hsl(var(--primary))" />
                  <Line type="monotone" dataKey="accepted" name="Accepted" stroke="hsl(var(--success, 142 76% 36%))" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {sourceBreakdown.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Payout by Source</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={sourceBreakdown}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  <Bar dataKey="payout" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Offers Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">All Offers ({allOffers.length})</CardTitle>
        </CardHeader>
        <ScrollArea className="max-h-[400px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Source</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Payout</TableHead>
                <TableHead>Fame</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {allOffers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    No offers yet. Play the game to start receiving offers!
                  </TableCell>
                </TableRow>
              ) : (
                allOffers.map((offer) => (
                  <TableRow key={`${offer.source}-${offer.id}`}>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">{offer.source}</Badge>
                    </TableCell>
                    <TableCell className="font-medium">{offer.title}</TableCell>
                    <TableCell>{statusBadge(offer.status)}</TableCell>
                    <TableCell>{formatCurrency(offer.payout)}</TableCell>
                    <TableCell>{offer.fameImpact > 0 ? `+${offer.fameImpact}` : offer.fameImpact || "—"}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {offer.date ? new Date(offer.date).toLocaleDateString() : "—"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      </Card>
    </div>
  );
};

export default OffersDashboard;
