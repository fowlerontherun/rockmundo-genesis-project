import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format, parseISO } from "date-fns";
import { MapPin, Users, Ticket, Calendar } from "lucide-react";

type FestivalRow = {
  id: string;
  name: string;
  scale: string | null;
  genre: string | null;
  status: string | null;
  start_date: string | null;
  end_date: string | null;
  expected_attendance: number | null;
  ticket_price_low: number | null;
  ticket_price_high: number | null;
  city: { id: string; name: string; country: string | null } | null;
};

const fmtDate = (d: string | null) => {
  if (!d) return "TBA";
  try {
    return format(parseISO(d), "MMM d, yyyy");
  } catch {
    return d;
  }
};

const fmtRange = (start: string | null, end: string | null) => {
  if (!start && !end) return "TBA";
  if (start && end && start !== end) return `${fmtDate(start)} – ${fmtDate(end)}`;
  return fmtDate(start ?? end);
};

const fmtPrice = (low: number | null, high: number | null) => {
  if (low == null && high == null) return "—";
  if (low != null && high != null && Number(low) !== Number(high)) {
    return `$${Number(low).toFixed(0)} – $${Number(high).toFixed(0)}`;
  }
  return `$${Number(low ?? high).toFixed(0)}`;
};

export default function FestivalDirectory() {
  const [search, setSearch] = useState("");
  const [scale, setScale] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("city");

  const { data = [], isLoading } = useQuery({
    queryKey: ["festival-directory"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("festivals")
        .select(
          "id,name,scale,genre,status,start_date,end_date,expected_attendance,ticket_price_low,ticket_price_high,city:cities(id,name,country)"
        )
        .order("start_date", { ascending: true })
        .range(0, 999);
      if (error) throw error;
      return (data ?? []) as FestivalRow[];
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let rows = data.filter((f) => {
      if (scale !== "all" && (f.scale ?? "").toLowerCase() !== scale) return false;
      if (!q) return true;
      return (
        f.name.toLowerCase().includes(q) ||
        (f.city?.name ?? "").toLowerCase().includes(q) ||
        (f.city?.country ?? "").toLowerCase().includes(q) ||
        (f.genre ?? "").toLowerCase().includes(q)
      );
    });
    rows = [...rows].sort((a, b) => {
      switch (sortBy) {
        case "name":
          return a.name.localeCompare(b.name);
        case "city":
          return (a.city?.name ?? "").localeCompare(b.city?.name ?? "");
        case "date":
          return (a.start_date ?? "").localeCompare(b.start_date ?? "");
        case "capacity":
          return (b.expected_attendance ?? 0) - (a.expected_attendance ?? 0);
        case "price":
          return (Number(a.ticket_price_low ?? 0)) - (Number(b.ticket_price_low ?? 0));
        default:
          return 0;
      }
    });
    return rows;
  }, [data, search, scale, sortBy]);

  return (
    <div className="container mx-auto p-4 space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Calendar className="h-6 w-6" /> Festival Directory
        </h1>
        <p className="text-sm text-muted-foreground">
          Every city hosts a festival. Browse dates, capacity, and ticket prices across the world.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filters</CardTitle>
          <CardDescription>
            {isLoading ? "Loading..." : `${filtered.length} of ${data.length} festivals`}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 md:grid-cols-4">
          <Input
            placeholder="Search by name, city, country, genre..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Select value={scale} onValueChange={setScale}>
            <SelectTrigger><SelectValue placeholder="Scale" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All scales</SelectItem>
              <SelectItem value="small">Small</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="large">Large</SelectItem>
              <SelectItem value="major">Major</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger><SelectValue placeholder="Sort by" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="city">City (A-Z)</SelectItem>
              <SelectItem value="name">Name (A-Z)</SelectItem>
              <SelectItem value="date">Start date</SelectItem>
              <SelectItem value="capacity">Capacity (high-low)</SelectItem>
              <SelectItem value="price">Ticket price (low-high)</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {isLoading && (
        <div className="text-center text-muted-foreground py-8">Loading festivals…</div>
      )}
      {!isLoading && filtered.length === 0 && (
        <div className="text-center text-muted-foreground py-8">No festivals match those filters.</div>
      )}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {filtered.map((f) => (
          <Link
            key={f.id}
            to={`/festivals/${f.id}`}
            className="group block rounded-lg border bg-card transition hover:border-primary hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary"
            aria-label={`View ${f.name}`}
          >
            <div className="p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-semibold truncate group-hover:text-primary">{f.name}</div>
                  {f.genre && (
                    <div className="text-xs text-muted-foreground capitalize truncate">{f.genre}</div>
                  )}
                </div>
                <Badge variant="outline" className="capitalize shrink-0">{f.scale ?? "—"}</Badge>
              </div>
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <MapPin className="h-3.5 w-3.5" />
                <span className="truncate">
                  {f.city?.name ?? "—"}{f.city?.country ? `, ${f.city.country}` : ""}
                </span>
              </div>
              <div className="flex items-center gap-1 text-sm">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                <span>{fmtRange(f.start_date, f.end_date)}</span>
              </div>
              <div className="flex items-center justify-between text-sm pt-1 border-t">
                <span className="inline-flex items-center gap-1">
                  <Users className="h-3.5 w-3.5 text-muted-foreground" />
                  {f.expected_attendance?.toLocaleString() ?? "—"}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Ticket className="h-3.5 w-3.5 text-muted-foreground" />
                  {fmtPrice(f.ticket_price_low, f.ticket_price_high)}
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
