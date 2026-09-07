import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { BarChart3, CalendarDays, ChevronDown, DollarSign, Filter, Music2, Search, Ticket, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useVenueBookings, useVenueFinancials } from "@/hooks/useVenueBusiness";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface VenueShowsHistoryProps {
  venueId: string;
  capacity?: number | null;
}

type GigRow = {
  id: string;
  venue_id: string;
  band_id: string;
  scheduled_date: string;
  scheduled_end: string | null;
  status: string;
  show_type: string | null;
  ticket_price: number | null;
  tickets_sold: number | null;
  estimated_attendance: number | null;
  estimated_revenue: number | null;
  booking_fee: number | null;
  payment: number | null;
  cancellation_reason: string | null;
  failure_reason: string | null;
  band?: { name: string } | null;
};

type OutcomeRow = {
  gig_id: string;
  actual_attendance: number | null;
  attendance_percentage: number | null;
  ticket_revenue: number | null;
  merch_revenue: number | null;
  total_revenue: number | null;
  venue_cost: number | null;
  crew_cost: number | null;
  equipment_cost: number | null;
  total_costs: number | null;
  net_profit: number | null;
  overall_rating: number | null;
  performance_grade: string | null;
  crowd_energy_peak: number | null;
  fan_conversions: number | null;
  new_followers: number | null;
  completed_at: string | null;
};

const money = (value: number | null | undefined) =>
  `$${Math.round(Number(value || 0)).toLocaleString()}`;

const statusVariant = (status: string) => {
  if (status === "completed") return "outline" as const;
  if (status === "cancelled" || status === "failed") return "destructive" as const;
  return "secondary" as const;
};

export function VenueShowsHistory({ venueId, capacity }: VenueShowsHistoryProps) {
  const [view, setView] = useState<"current" | "history">("current");
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const { data: bookings = [] } = useVenueBookings(venueId);
  const { data: transactions = [] } = useVenueFinancials(venueId);

  const { data: gigs = [], isLoading } = useQuery({
    queryKey: ["venue-owner-gigs", venueId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("gigs")
        .select("id,venue_id,band_id,scheduled_date,scheduled_end,status,show_type,ticket_price,tickets_sold,estimated_attendance,estimated_revenue,booking_fee,payment,cancellation_reason,failure_reason,band:bands(name)")
        .eq("venue_id", venueId)
        .order("scheduled_date", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as GigRow[];
    },
    enabled: !!venueId,
  });

  const gigIds = useMemo(() => gigs.map((gig) => gig.id), [gigs]);
  const { data: outcomes = [] } = useQuery({
    queryKey: ["venue-owner-gig-outcomes", venueId, gigIds.join(",")],
    queryFn: async () => {
      if (!gigIds.length) return [];
      const { data, error } = await supabase
        .from("gig_outcomes")
        .select("gig_id,actual_attendance,attendance_percentage,ticket_revenue,merch_revenue,total_revenue,venue_cost,crew_cost,equipment_cost,total_costs,net_profit,overall_rating,performance_grade,crowd_energy_peak,fan_conversions,new_followers,completed_at")
        .in("gig_id", gigIds);
      if (error) throw error;
      return (data || []) as OutcomeRow[];
    },
    enabled: gigIds.length > 0,
  });

  const outcomeByGig = useMemo(
    () => new Map(outcomes.map((outcome) => [outcome.gig_id, outcome])),
    [outcomes],
  );
  const bookingByGig = useMemo(
    () => new Map(bookings.filter((booking) => booking.gig_id).map((booking) => [booking.gig_id as string, booking])),
    [bookings],
  );
  const transactionsByBooking = useMemo(() => {
    const map = new Map<string, typeof transactions>();
    transactions.forEach((transaction) => {
      if (!transaction.related_booking_id) return;
      const current = map.get(transaction.related_booking_id) || [];
      current.push(transaction);
      map.set(transaction.related_booking_id, current);
    });
    return map;
  }, [transactions]);

  const now = Date.now();
  const filtered = useMemo(() => {
    return gigs.filter((gig) => {
      const time = new Date(gig.scheduled_date).getTime();
      const isHistoric = time < now || ["completed", "cancelled", "failed"].includes(gig.status);
      if (view === "current" && isHistoric) return false;
      if (view === "history" && !isHistoric) return false;
      if (status !== "all" && gig.status !== status) return false;
      if (search && !gig.band?.name?.toLowerCase().includes(search.toLowerCase())) return false;
      if (dateFrom && gig.scheduled_date.slice(0, 10) < dateFrom) return false;
      if (dateTo && gig.scheduled_date.slice(0, 10) > dateTo) return false;
      return true;
    });
  }, [gigs, view, status, search, dateFrom, dateTo, now]);

  const summary = useMemo(() => {
    return filtered.reduce(
      (acc, gig) => {
        const outcome = outcomeByGig.get(gig.id);
        const booking = bookingByGig.get(gig.id);
        const ledger = booking ? transactionsByBooking.get(booking.id) || [] : [];
        const venueIncome = ledger.filter((tx) => tx.amount > 0).reduce((sum, tx) => sum + Number(tx.amount), 0);
        const venueCosts = ledger.filter((tx) => tx.amount < 0).reduce((sum, tx) => sum + Math.abs(Number(tx.amount)), 0);
        acc.attendance += Number(outcome?.actual_attendance || gig.tickets_sold || 0);
        acc.ticketRevenue += Number(outcome?.ticket_revenue || 0);
        acc.venueIncome += venueIncome;
        acc.venueCosts += venueCosts;
        if (outcome?.overall_rating != null) {
          acc.ratingTotal += Number(outcome.overall_rating);
          acc.ratedShows += 1;
        }
        return acc;
      },
      { attendance: 0, ticketRevenue: 0, venueIncome: 0, venueCosts: 0, ratingTotal: 0, ratedShows: 0 },
    );
  }, [filtered, outcomeByGig, bookingByGig, transactionsByBooking]);

  const averageRating = summary.ratedShows ? summary.ratingTotal / summary.ratedShows : 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Filtered shows</p><p className="text-2xl font-bold">{filtered.length}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Attendance</p><p className="text-2xl font-bold">{summary.attendance.toLocaleString()}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Ticket sales</p><p className="text-2xl font-bold">{money(summary.ticketRevenue)}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Venue net</p><p className={`text-2xl font-bold ${summary.venueIncome - summary.venueCosts < 0 ? "text-destructive" : "text-primary"}`}>{money(summary.venueIncome - summary.venueCosts)}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Avg show rating</p><p className="text-2xl font-bold">{averageRating ? averageRating.toFixed(1) : "—"}</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader className="space-y-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <CardTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5" /> Shows & settlements</CardTitle>
            <div className="flex rounded-md border p-1 w-fit">
              <button className={`px-3 py-1.5 text-sm rounded ${view === "current" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`} onClick={() => setView("current")}>Current & upcoming</button>
              <button className={`px-3 py-1.5 text-sm rounded ${view === "history" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`} onClick={() => setView("history")}>Show history</button>
            </div>
          </div>
          <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-5">
            <div className="relative lg:col-span-2"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="pl-9" placeholder="Filter by band..." value={search} onChange={(e) => setSearch(e.target.value)} /></div>
            <Select value={status} onValueChange={setStatus}><SelectTrigger><Filter className="h-4 w-4 mr-2" /><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All statuses</SelectItem><SelectItem value="scheduled">Scheduled</SelectItem><SelectItem value="confirmed">Confirmed</SelectItem><SelectItem value="in_progress">In progress</SelectItem><SelectItem value="completed">Completed</SelectItem><SelectItem value="cancelled">Cancelled</SelectItem><SelectItem value="failed">Failed</SelectItem></SelectContent></Select>
            <Input type="date" aria-label="From date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            <Input type="date" aria-label="To date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? <p className="py-8 text-center text-muted-foreground">Loading venue shows...</p> : filtered.length === 0 ? <p className="py-8 text-center text-muted-foreground">No shows match these filters.</p> : (
            <div className="space-y-3">
              {filtered.map((gig) => {
                const outcome = outcomeByGig.get(gig.id);
                const booking = bookingByGig.get(gig.id);
                const ledger = booking ? transactionsByBooking.get(booking.id) || [] : [];
                const venueIncome = ledger.filter((tx) => tx.amount > 0).reduce((sum, tx) => sum + Number(tx.amount), 0);
                const venueCosts = ledger.filter((tx) => tx.amount < 0).reduce((sum, tx) => sum + Math.abs(Number(tx.amount)), 0);
                const attendance = outcome?.actual_attendance ?? gig.tickets_sold ?? 0;
                const attendancePct = outcome?.attendance_percentage ?? (capacity ? (attendance / capacity) * 100 : null);
                return (
                  <details key={gig.id} className="group rounded-lg border bg-card">
                    <summary className="flex cursor-pointer list-none flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2"><Music2 className="h-4 w-4" /><span className="font-semibold">{gig.band?.name || "Unknown band"}</span><Badge variant={statusVariant(gig.status)} className="capitalize">{gig.status.replace(/_/g, " ")}</Badge>{outcome?.performance_grade && <Badge variant="outline">Grade {outcome.performance_grade}</Badge>}</div>
                        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground"><span className="flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" />{format(new Date(gig.scheduled_date), "dd MMM yyyy, HH:mm")}</span><span className="capitalize">{gig.show_type?.replace(/_/g, " ") || "Live show"}</span></div>
                      </div>
                      <div className="flex items-center gap-5 text-sm"><span className="flex items-center gap-1"><Users className="h-4 w-4" />{attendance.toLocaleString()}</span><span className="font-medium">{outcome?.overall_rating != null ? `${Number(outcome.overall_rating).toFixed(1)}/100` : "Awaiting result"}</span><ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" /></div>
                    </summary>
                    <div className="border-t p-4 space-y-4">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                        <div><p className="text-muted-foreground">Attendance</p><p className="font-semibold">{attendance.toLocaleString()}{attendancePct != null ? ` (${Number(attendancePct).toFixed(1)}%)` : ""}</p></div>
                        <div><p className="text-muted-foreground">Tickets / price</p><p className="font-semibold">{(gig.tickets_sold || 0).toLocaleString()} @ {money(gig.ticket_price)}</p></div>
                        <div><p className="text-muted-foreground">Crowd energy</p><p className="font-semibold">{outcome?.crowd_energy_peak ?? "—"}</p></div>
                        <div><p className="text-muted-foreground">Fan conversions</p><p className="font-semibold">{outcome?.fan_conversions ?? "—"}</p></div>
                      </div>
                      {(gig.cancellation_reason || gig.failure_reason) && <div className="rounded-md bg-destructive/10 p-3 text-sm"><span className="font-medium">Outcome note: </span>{gig.cancellation_reason || gig.failure_reason}</div>}
                      <div>
                        <p className="mb-2 flex items-center gap-2 font-medium"><DollarSign className="h-4 w-4" /> Financial detail</p>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                          <div className="rounded border p-3"><p className="text-muted-foreground">Ticket revenue</p><p className="font-semibold">{money(outcome?.ticket_revenue)}</p></div>
                          <div className="rounded border p-3"><p className="text-muted-foreground">Band merch</p><p className="font-semibold">{money(outcome?.merch_revenue)}</p></div>
                          <div className="rounded border p-3"><p className="text-muted-foreground">Show costs</p><p className="font-semibold">{money(outcome?.total_costs)}</p></div>
                          <div className="rounded border p-3"><p className="text-muted-foreground">Band net</p><p className="font-semibold">{money(outcome?.net_profit)}</p></div>
                        </div>
                        <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                          <div className="rounded border p-3"><p className="text-muted-foreground">Venue ledger income</p><p className="font-semibold text-primary">{money(venueIncome)}</p></div>
                          <div className="rounded border p-3"><p className="text-muted-foreground">Venue ledger costs</p><p className="font-semibold text-destructive">{money(venueCosts)}</p></div>
                          <div className="rounded border p-3"><p className="text-muted-foreground">Venue net</p><p className="font-semibold">{money(venueIncome - venueCosts)}</p></div>
                          <div className="rounded border p-3"><p className="text-muted-foreground">Rental / booking fee</p><p className="font-semibold">{money(booking?.rental_fee ?? gig.booking_fee ?? gig.payment)}</p></div>
                        </div>
                        {ledger.length > 0 && <div className="mt-3 space-y-1">{ledger.map((tx) => <div key={tx.id} className="flex justify-between rounded bg-muted/40 px-3 py-2 text-xs"><span className="capitalize">{tx.transaction_type.replace(/_/g, " ")}{tx.description ? ` — ${tx.description}` : ""}</span><span className={tx.amount < 0 ? "text-destructive" : "text-primary"}>{tx.amount >= 0 ? "+" : ""}{money(tx.amount)}</span></div>)}</div>}
                      </div>
                    </div>
                  </details>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
