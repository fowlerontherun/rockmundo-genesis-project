import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Save, RefreshCw, Search, MapPin, Eye } from "lucide-react";

type FestivalRow = {
  id: string;
  name: string;
  city_id: string;
  scale: string;
  status: string;
  start_date: string;
  end_date: string;
  expected_attendance: number | null;
  ticket_price_low: number | null;
  ticket_price_high: number | null;
  genre: string | null;
};

type CityRow = { id: string; name: string; country: string | null; population: number | null };

// Safe defaults per scale used when re-seeding cities without a festival
const SCALE_DEFAULTS: Record<string, { attendance: number; low: number; high: number }> = {
  small: { attendance: 2500, low: 25, high: 60 },
  medium: { attendance: 8000, low: 40, high: 110 },
  large: { attendance: 20000, low: 65, high: 180 },
  major: { attendance: 60000, low: 120, high: 350 },
};

export default function CityFestivalsAdmin() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [scaleFilter, setScaleFilter] = useState<string>("all");
  const [cityFilter, setCityFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("name-asc");
  const [edits, setEdits] = useState<Record<string, Partial<FestivalRow>>>({});

  const { data: cities } = useQuery({
    queryKey: ["admin-cf-cities"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cities")
        .select("id, name, country, population")
        .order("name");
      if (error) throw error;
      return data as CityRow[];
    },
  });

  const { data: festivals, isLoading } = useQuery({
    queryKey: ["admin-cf-festivals"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("festivals")
        .select("id, name, city_id, scale, status, start_date, end_date, expected_attendance, ticket_price_low, ticket_price_high, genre")
        .order("name");
      if (error) throw error;
      return (data || []) as FestivalRow[];
    },
  });

  const cityMap = useMemo(() => {
    const m = new Map<string, CityRow>();
    (cities || []).forEach((c) => m.set(c.id, c));
    return m;
  }, [cities]);

  const rows = useMemo(() => {
    let list = festivals || [];
    if (scaleFilter !== "all") list = list.filter((f) => f.scale === scaleFilter);
    if (cityFilter !== "all") list = list.filter((f) => f.city_id === cityFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((f) => {
        const city = cityMap.get(f.city_id);
        return (
          f.name.toLowerCase().includes(q) ||
          city?.name?.toLowerCase().includes(q) ||
          city?.country?.toLowerCase().includes(q)
        );
      });
    }
    const sorted = [...list];
    const num = (v: any) => (v == null ? 0 : Number(v));
    sorted.sort((a, b) => {
      switch (sortBy) {
        case "name-desc": return b.name.localeCompare(a.name);
        case "city-asc": return (cityMap.get(a.city_id)?.name || "").localeCompare(cityMap.get(b.city_id)?.name || "");
        case "city-desc": return (cityMap.get(b.city_id)?.name || "").localeCompare(cityMap.get(a.city_id)?.name || "");
        case "start-asc": return a.start_date.localeCompare(b.start_date);
        case "start-desc": return b.start_date.localeCompare(a.start_date);
        case "price-low-asc": return num(a.ticket_price_low) - num(b.ticket_price_low);
        case "price-low-desc": return num(b.ticket_price_low) - num(a.ticket_price_low);
        case "price-high-asc": return num(a.ticket_price_high) - num(b.ticket_price_high);
        case "price-high-desc": return num(b.ticket_price_high) - num(a.ticket_price_high);
        case "capacity-asc": return num(a.expected_attendance) - num(b.expected_attendance);
        case "capacity-desc": return num(b.expected_attendance) - num(a.expected_attendance);
        case "name-asc":
        default: return a.name.localeCompare(b.name);
      }
    });
    return sorted;
  }, [festivals, scaleFilter, cityFilter, search, cityMap, sortBy]);

  const citiesMissingFestival = useMemo(() => {
    const withFest = new Set((festivals || []).map((f) => f.city_id));
    return (cities || []).filter((c) => !withFest.has(c.id));
  }, [festivals, cities]);

  const setEdit = (id: string, patch: Partial<FestivalRow>) => {
    setEdits((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  };

  const getVal = <K extends keyof FestivalRow>(row: FestivalRow, key: K): FestivalRow[K] => {
    const patch = edits[row.id];
    return (patch && key in patch ? (patch as any)[key] : row[key]) as FestivalRow[K];
  };

  const isDirty = (id: string) => Boolean(edits[id]);

  const validate = (row: FestivalRow): string | null => {
    const attendance = Number(getVal(row, "expected_attendance") ?? 0);
    const low = Number(getVal(row, "ticket_price_low") ?? 0);
    const high = Number(getVal(row, "ticket_price_high") ?? 0);
    const start = String(getVal(row, "start_date") || "");
    const end = String(getVal(row, "end_date") || "");
    if (!start || !end) return "Start and end dates are required";
    if (new Date(end) < new Date(start)) return "End date must be on or after start date";
    if (attendance <= 0) return "Capacity must be greater than 0";
    if (low < 0 || high < 0) return "Ticket prices cannot be negative";
    if (high < low) return "Ticket price high must be ≥ low";
    return null;
  };

  const saveMutation = useMutation({
    mutationFn: async (row: FestivalRow) => {
      const err = validate(row);
      if (err) throw new Error(err);
      const patch = {
        expected_attendance: Number(getVal(row, "expected_attendance") ?? 0),
        ticket_price_low: Number(getVal(row, "ticket_price_low") ?? 0),
        ticket_price_high: Number(getVal(row, "ticket_price_high") ?? 0),
        start_date: String(getVal(row, "start_date")),
        end_date: String(getVal(row, "end_date")),
        scale: String(getVal(row, "scale")),
        updated_at: new Date().toISOString(),
      };
      const { error } = await (supabase as any).from("festivals").update(patch).eq("id", row.id);
      if (error) throw error;
      return row.id;
    },
    onSuccess: (id) => {
      setEdits((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      qc.invalidateQueries({ queryKey: ["admin-cf-festivals"] });
      toast({ title: "Festival updated" });
    },
    onError: (e: Error) => toast({ title: "Save failed", description: e.message, variant: "destructive" }),
  });

  const saveAllMutation = useMutation({
    mutationFn: async () => {
      const dirtyRows = (festivals || []).filter((r) => isDirty(r.id));
      for (const row of dirtyRows) {
        const err = validate(row);
        if (err) throw new Error(`${row.name}: ${err}`);
      }
      const updates = dirtyRows.map((row) =>
        (supabase as any)
          .from("festivals")
          .update({
            expected_attendance: Number(getVal(row, "expected_attendance") ?? 0),
            ticket_price_low: Number(getVal(row, "ticket_price_low") ?? 0),
            ticket_price_high: Number(getVal(row, "ticket_price_high") ?? 0),
            start_date: String(getVal(row, "start_date")),
            end_date: String(getVal(row, "end_date")),
            scale: String(getVal(row, "scale")),
            updated_at: new Date().toISOString(),
          })
          .eq("id", row.id),
      );
      const results = await Promise.all(updates);
      const failed = results.find((r: any) => r.error);
      if (failed?.error) throw failed.error;
      return dirtyRows.length;
    },
    onSuccess: (n) => {
      setEdits({});
      qc.invalidateQueries({ queryKey: ["admin-cf-festivals"] });
      toast({ title: `Saved ${n} festival${n === 1 ? "" : "s"}` });
    },
    onError: (e: Error) => toast({ title: "Batch save failed", description: e.message, variant: "destructive" }),
  });

  const reseedMissingMutation = useMutation({
    mutationFn: async () => {
      if (!citiesMissingFestival.length) return 0;
      const today = new Date();
      const startBase = new Date(today.getFullYear(), today.getMonth() + 1, 1);
      const rowsToInsert = citiesMissingFestival.map((c, idx) => {
        const start = new Date(startBase);
        start.setDate(start.getDate() + idx); // stagger by 1 day
        const end = new Date(start);
        end.setDate(end.getDate() + 2); // 3-day small festival
        const d = SCALE_DEFAULTS.small;
        const iso = (dt: Date) => dt.toISOString().slice(0, 10);
        return {
          name: `${c.name} Local Festival`,
          city_id: c.id,
          scale: "small",
          status: "upcoming",
          start_date: iso(start),
          end_date: iso(end),
          expected_attendance: d.attendance,
          ticket_price_low: d.low,
          ticket_price_high: d.high,
          genre: "indie",
          description: `A small-scale community festival in ${c.name}.`,
        };
      });
      const { error } = await (supabase as any).from("festivals").insert(rowsToInsert);
      if (error) throw error;
      return rowsToInsert.length;
    },
    onSuccess: (n) => {
      qc.invalidateQueries({ queryKey: ["admin-cf-festivals"] });
      toast({ title: `Seeded ${n} missing festival${n === 1 ? "" : "s"}` });
    },
    onError: (e: Error) => toast({ title: "Re-seed failed", description: e.message, variant: "destructive" }),
  });

  const applyScalePreset = (row: FestivalRow, scale: string) => {
    const d = SCALE_DEFAULTS[scale] || SCALE_DEFAULTS.small;
    setEdit(row.id, {
      scale,
      expected_attendance: d.attendance,
      ticket_price_low: d.low,
      ticket_price_high: d.high,
    });
  };

  const dirtyCount = Object.keys(edits).length;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-oswald">City Festival Editor</h1>
          <p className="text-sm text-muted-foreground">
            Adjust capacity, ticket price range, run dates, and scale for every city's festival.
          </p>
        </div>
        <div className="flex gap-2">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" disabled={!citiesMissingFestival.length}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Re-seed missing ({citiesMissingFestival.length})
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Re-seed missing city festivals?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will insert one small-scale festival for each of the {citiesMissingFestival.length} cities
                  that currently have no festival record. Existing festivals will not be touched.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => reseedMissingMutation.mutate()}>
                  Re-seed safely
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Button onClick={() => saveAllMutation.mutate()} disabled={!dirtyCount || saveAllMutation.isPending}>
            <Save className="h-4 w-4 mr-2" />
            Save all ({dirtyCount})
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap gap-2 items-end">
            <div className="flex-1 min-w-[220px]">
              <Label className="text-xs">Search</Label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-8"
                  placeholder="Festival, city, or country"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
            <div className="w-56">
              <Label className="text-xs">City</Label>
              <Select value={cityFilter} onValueChange={setCityFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectItem value="all">All cities</SelectItem>
                  {(cities || []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}{c.country ? `, ${c.country}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-40">
              <Label className="text-xs">Scale</Label>
              <Select value={scaleFilter} onValueChange={setScaleFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All scales</SelectItem>
                  <SelectItem value="small">Small</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="large">Large</SelectItem>
                  <SelectItem value="major">Major</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="w-52">
              <Label className="text-xs">Sort by</Label>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="name-asc">Name (A–Z)</SelectItem>
                  <SelectItem value="name-desc">Name (Z–A)</SelectItem>
                  <SelectItem value="city-asc">City (A–Z)</SelectItem>
                  <SelectItem value="city-desc">City (Z–A)</SelectItem>
                  <SelectItem value="start-asc">Start date (earliest)</SelectItem>
                  <SelectItem value="start-desc">Start date (latest)</SelectItem>
                  <SelectItem value="price-low-asc">Ticket low (cheapest)</SelectItem>
                  <SelectItem value="price-low-desc">Ticket low (priciest)</SelectItem>
                  <SelectItem value="price-high-asc">Ticket high (cheapest)</SelectItem>
                  <SelectItem value="price-high-desc">Ticket high (priciest)</SelectItem>
                  <SelectItem value="capacity-asc">Capacity (smallest)</SelectItem>
                  <SelectItem value="capacity-desc">Capacity (largest)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {(search || cityFilter !== "all" || scaleFilter !== "all" || sortBy !== "name-asc") && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setSearch(""); setCityFilter("all"); setScaleFilter("all"); setSortBy("name-asc"); }}
              >
                Reset
              </Button>
            )}
            <div className="text-xs text-muted-foreground ml-auto">
              {rows.length} of {festivals?.length ?? 0} festivals
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {isLoading ? (
            <div className="py-8 text-center text-muted-foreground">Loading festivals…</div>
          ) : rows.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">No festivals match your filters.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground border-b">
                  <tr>
                    <th className="text-left py-2 pr-2">Festival / City</th>
                    <th className="text-left px-2">Scale</th>
                    <th className="text-left px-2">Start</th>
                    <th className="text-left px-2">End</th>
                    <th className="text-left px-2">Capacity</th>
                    <th className="text-left px-2">Ticket Low</th>
                    <th className="text-left px-2">Ticket High</th>
                    <th className="text-right pl-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const city = cityMap.get(row.city_id);
                    const dirty = isDirty(row.id);
                    return (
                      <tr key={row.id} className={`border-b last:border-0 ${dirty ? "bg-primary/5" : ""}`}>
                        <td className="py-2 pr-2">
                          <div className="font-medium">{row.name}</div>
                          <div className="text-xs text-muted-foreground flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {city ? `${city.name}${city.country ? `, ${city.country}` : ""}` : "Unknown city"}
                            {dirty && <Badge variant="secondary" className="ml-2 text-[10px]">unsaved</Badge>}
                          </div>
                        </td>
                        <td className="px-2">
                          <Select
                            value={String(getVal(row, "scale") || "small")}
                            onValueChange={(v) => applyScalePreset(row, v)}
                          >
                            <SelectTrigger className="h-8 w-28"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="small">Small</SelectItem>
                              <SelectItem value="medium">Medium</SelectItem>
                              <SelectItem value="large">Large</SelectItem>
                              <SelectItem value="major">Major</SelectItem>
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-2">
                          <Input
                            type="date"
                            className="h-8 w-36"
                            value={String(getVal(row, "start_date") || "").slice(0, 10)}
                            onChange={(e) => setEdit(row.id, { start_date: e.target.value })}
                          />
                        </td>
                        <td className="px-2">
                          <Input
                            type="date"
                            className="h-8 w-36"
                            value={String(getVal(row, "end_date") || "").slice(0, 10)}
                            onChange={(e) => setEdit(row.id, { end_date: e.target.value })}
                          />
                        </td>
                        <td className="px-2">
                          <Input
                            type="number"
                            min={0}
                            className="h-8 w-24"
                            value={Number(getVal(row, "expected_attendance") ?? 0)}
                            onChange={(e) => setEdit(row.id, { expected_attendance: Number(e.target.value) })}
                          />
                        </td>
                        <td className="px-2">
                          <Input
                            type="number"
                            min={0}
                            className="h-8 w-20"
                            value={Number(getVal(row, "ticket_price_low") ?? 0)}
                            onChange={(e) => setEdit(row.id, { ticket_price_low: Number(e.target.value) })}
                          />
                        </td>
                        <td className="px-2">
                          <Input
                            type="number"
                            min={0}
                            className="h-8 w-20"
                            value={Number(getVal(row, "ticket_price_high") ?? 0)}
                            onChange={(e) => setEdit(row.id, { ticket_price_high: Number(e.target.value) })}
                          />
                        </td>
                        <td className="pl-2 text-right">
                          <Button
                            size="sm"
                            variant={dirty ? "default" : "ghost"}
                            disabled={!dirty || saveMutation.isPending}
                            onClick={() => saveMutation.mutate(row)}
                          >
                            <Save className="h-3.5 w-3.5 mr-1" />
                            Save
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
