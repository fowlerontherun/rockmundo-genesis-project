import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Radio, Newspaper, BookOpen, Mic2, Globe, Tv, Search } from "lucide-react";
import { BAND_FAME_THRESHOLDS } from "@/utils/bandFame";

// ---------------------------------------------------------------------------
// Reach tier helpers — mirror src/utils/mediaReachGate.ts breakpoints
// ---------------------------------------------------------------------------
type Tier = "hyper-local" | "local" | "regional" | "national" | "international";

const tierForFame = (fame: number): Tier => {
  if (fame >= 18000) return "international";
  if (fame >= 3500) return "national";
  if (fame >= 1000) return "regional";
  if (fame >= 300) return "local";
  return "hyper-local";
};

const tierBadgeColor: Record<Tier, string> = {
  "hyper-local": "bg-slate-500/20 text-slate-300 border-slate-500/40",
  local: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
  regional: "bg-teal-500/20 text-teal-300 border-teal-500/40",
  national: "bg-sky-500/20 text-sky-300 border-sky-500/40",
  international: "bg-amber-500/20 text-amber-300 border-amber-500/40",
};

// ---------------------------------------------------------------------------
// Outlet type configuration
// ---------------------------------------------------------------------------
type OutletKind =
  | "magazines"
  | "newspapers"
  | "podcasts"
  | "websites"
  | "radio_stations"
  | "tv_shows";

interface OutletConfig {
  label: string;
  table: OutletKind;
  nameField: string;
  typeField?: string;
  audienceField?: string;
  hasCity: boolean;
  hasCountry: boolean;
  icon: any;
}

const CONFIGS: OutletConfig[] = [
  { label: "Magazines", table: "magazines", nameField: "name", typeField: "magazine_type", audienceField: "readership", hasCity: false, hasCountry: true, icon: BookOpen },
  { label: "Newspapers", table: "newspapers", nameField: "name", typeField: "newspaper_type", audienceField: "circulation", hasCity: true, hasCountry: true, icon: Newspaper },
  { label: "Podcasts", table: "podcasts", nameField: "podcast_name", typeField: "podcast_type", audienceField: "listener_base", hasCity: false, hasCountry: true, icon: Mic2 },
  { label: "Websites", table: "websites", nameField: "name", typeField: "website_type", audienceField: "traffic_rank", hasCity: false, hasCountry: true, icon: Globe },
  { label: "Radio Stations", table: "radio_stations", nameField: "name", typeField: "station_type", audienceField: "listener_base", hasCity: true, hasCountry: true, icon: Radio },
  { label: "TV Shows", table: "tv_shows", nameField: "show_name", typeField: "show_type", audienceField: "viewer_reach", hasCity: false, hasCountry: false, icon: Tv },
];

// ---------------------------------------------------------------------------
// Per-outlet panel
// ---------------------------------------------------------------------------
function OutletPanel({ config, cities }: { config: OutletConfig; cities: { id: string; name: string }[] }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [countryFilter, setCountryFilter] = useState("all");
  const [tierFilter, setTierFilter] = useState<Tier | "all">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "disabled">("all");
  const [editing, setEditing] = useState<any | null>(null);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["admin-media", config.table],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from(config.table)
        .select("*")
        .order(config.nameField, { ascending: true })
        .limit(2000);
      if (error) throw error;
      return data ?? [];
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Record<string, any> }) => {
      const { error } = await (supabase as any).from(config.table).update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-media", config.table] });
      toast({ title: "Outlet updated" });
    },
    onError: (e: any) => toast({ title: "Update failed", description: e.message, variant: "destructive" }),
  });

  const countries = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r: any) => r.country && set.add(r.country));
    return Array.from(set).sort();
  }, [rows]);

  const cityNameById = useMemo(() => {
    const m = new Map<string, string>();
    cities.forEach((c) => m.set(c.id, c.name));
    return m;
  }, [cities]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r: any) => {
      if (q && !String(r[config.nameField] ?? "").toLowerCase().includes(q)) return false;
      if (countryFilter !== "all" && r.country !== countryFilter) return false;
      if (statusFilter === "active" && !r.is_active) return false;
      if (statusFilter === "disabled" && r.is_active) return false;
      if (tierFilter !== "all" && tierForFame(r.min_fame_required ?? 0) !== tierFilter) return false;
      return true;
    });
  }, [rows, search, countryFilter, statusFilter, tierFilter, config.nameField]);

  const counts = useMemo(() => {
    const out = { total: rows.length, active: 0, disabled: 0 } as any;
    rows.forEach((r: any) => (r.is_active ? out.active++ : out.disabled++));
    return out;
  }, [rows]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[200px]">
          <Label className="text-xs">Search</Label>
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name…" className="pl-8" />
          </div>
        </div>
        {config.hasCountry && (
          <div>
            <Label className="text-xs">Country</Label>
            <Select value={countryFilter} onValueChange={setCountryFilter}>
              <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All countries</SelectItem>
                {countries.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
        <div>
          <Label className="text-xs">Tier</Label>
          <Select value={tierFilter} onValueChange={(v) => setTierFilter(v as any)}>
            <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All tiers</SelectItem>
              <SelectItem value="hyper-local">Hyper-local</SelectItem>
              <SelectItem value="local">Local</SelectItem>
              <SelectItem value="regional">Regional</SelectItem>
              <SelectItem value="national">National</SelectItem>
              <SelectItem value="international">International</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Status</Label>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
            <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="disabled">Disabled</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex gap-2 text-xs text-muted-foreground">
        <span>Total: <b className="text-foreground">{counts.total}</b></span>
        <span>· Active: <b className="text-emerald-400">{counts.active}</b></span>
        <span>· Disabled: <b className="text-red-400">{counts.disabled}</b></span>
        <span>· Showing: <b className="text-foreground">{filtered.length}</b></span>
      </div>

      <div className="border border-border rounded-md overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              {config.typeField && <TableHead className="w-[120px]">Type</TableHead>}
              {config.hasCountry && <TableHead className="w-[120px]">Country</TableHead>}
              {config.hasCity && <TableHead className="w-[140px]">City</TableHead>}
              {config.audienceField && <TableHead className="w-[110px]">Audience</TableHead>}
              <TableHead className="w-[100px]">Min fame</TableHead>
              <TableHead className="w-[120px]">Tier</TableHead>
              <TableHead className="w-[90px]">Active</TableHead>
              <TableHead className="w-[80px] text-right">Edit</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={9} className="text-center py-6 text-muted-foreground">Loading…</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={9} className="text-center py-6 text-muted-foreground">No outlets match the filters.</TableCell></TableRow>
            ) : filtered.slice(0, 500).map((r: any) => {
              const tier = tierForFame(r.min_fame_required ?? 0);
              return (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r[config.nameField]}</TableCell>
                  {config.typeField && <TableCell className="text-muted-foreground text-xs">{r[config.typeField] ?? "—"}</TableCell>}
                  {config.hasCountry && <TableCell className="text-xs">{r.country ?? "—"}</TableCell>}
                  {config.hasCity && <TableCell className="text-xs">{r.city_id ? cityNameById.get(r.city_id) ?? "—" : "—"}</TableCell>}
                  {config.audienceField && <TableCell className="text-xs">{(r[config.audienceField] ?? 0).toLocaleString()}</TableCell>}
                  <TableCell className="text-xs">{(r.min_fame_required ?? 0).toLocaleString()}</TableCell>
                  <TableCell><Badge variant="outline" className={tierBadgeColor[tier]}>{tier}</Badge></TableCell>
                  <TableCell>
                    <Switch
                      checked={!!r.is_active}
                      onCheckedChange={(checked) => updateMutation.mutate({ id: r.id, patch: { is_active: checked } })}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="outline" onClick={() => setEditing(r)}>Edit</Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        {filtered.length > 500 && (
          <div className="text-xs text-muted-foreground p-2 border-t border-border">
            Showing first 500 of {filtered.length} — narrow filters to see more.
          </div>
        )}
      </div>

      {editing && (
        <EditDialog
          config={config}
          row={editing}
          cities={cities}
          countries={countries}
          onClose={() => setEditing(null)}
          onSave={(patch) => {
            updateMutation.mutate({ id: editing.id, patch });
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Edit dialog
// ---------------------------------------------------------------------------
function EditDialog({
  config,
  row,
  cities,
  countries,
  onClose,
  onSave,
}: {
  config: OutletConfig;
  row: any;
  cities: { id: string; name: string }[];
  countries: string[];
  onClose: () => void;
  onSave: (patch: Record<string, any>) => void;
}) {
  const [name, setName] = useState(row[config.nameField] ?? "");
  const [minFame, setMinFame] = useState<number>(row.min_fame_required ?? 0);
  const [country, setCountry] = useState<string>(row.country ?? "");
  const [cityId, setCityId] = useState<string>(row.city_id ?? "__none__");
  const [isActive, setIsActive] = useState<boolean>(!!row.is_active);
  const [audience, setAudience] = useState<number>(config.audienceField ? row[config.audienceField] ?? 0 : 0);

  const tier = tierForFame(minFame);
  const nextTierIndex = BAND_FAME_THRESHOLDS.findIndex((t) => t.minFame > minFame);

  const handleSave = () => {
    const patch: Record<string, any> = {
      [config.nameField]: name,
      min_fame_required: Number(minFame) || 0,
      is_active: isActive,
    };
    if (config.hasCountry) patch.country = country || null;
    if (config.hasCity) patch.city_id = cityId === "__none__" ? null : cityId;
    if (config.audienceField) patch[config.audienceField] = Number(audience) || 0;
    onSave(patch);
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit {config.label.slice(0, -1)}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          {config.hasCountry && (
            <div>
              <Label>Country</Label>
              <Input value={country} onChange={(e) => setCountry(e.target.value)} list={`countries-${config.table}`} />
              <datalist id={`countries-${config.table}`}>
                {countries.map((c) => <option key={c} value={c} />)}
              </datalist>
            </div>
          )}

          {config.hasCity && (
            <div>
              <Label>City</Label>
              <Select value={cityId} onValueChange={setCityId}>
                <SelectTrigger><SelectValue placeholder="Select city" /></SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectItem value="__none__">— None —</SelectItem>
                  {cities.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          {config.audienceField && (
            <div>
              <Label>Audience ({config.audienceField})</Label>
              <Input type="number" value={audience} onChange={(e) => setAudience(Number(e.target.value))} />
            </div>
          )}

          <div>
            <Label>Minimum fame required</Label>
            <Input type="number" value={minFame} onChange={(e) => setMinFame(Number(e.target.value))} />
            <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
              Tier: <Badge variant="outline" className={tierBadgeColor[tier]}>{tier}</Badge>
              {nextTierIndex >= 0 && (
                <span>· Next career rung at {BAND_FAME_THRESHOLDS[nextTierIndex].minFame.toLocaleString()} fame</span>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between border border-border rounded-md p-3">
            <div>
              <Label>Active</Label>
              <p className="text-xs text-muted-foreground">Disabled outlets are hidden from players.</p>
            </div>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave}>Save changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Top-level page
// ---------------------------------------------------------------------------
export default function MediaOutletsAdmin() {
  const { data: cities = [] } = useQuery({
    queryKey: ["admin-media-cities"],
    queryFn: async () => {
      const { data, error } = await supabase.from("cities").select("id, name").order("name").limit(1000);
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      <div>
        <h1 className="text-2xl font-medium">Media outlets</h1>
        <p className="text-sm text-muted-foreground">
          Review, edit, and disable seeded media outlets — adjust min-fame, region, city and audience without touching the database.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Seeded outlets</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="magazines">
            <TabsList className="flex-wrap h-auto">
              {CONFIGS.map((c) => {
                const Icon = c.icon;
                return (
                  <TabsTrigger key={c.table} value={c.table} className="gap-1.5">
                    <Icon className="h-3.5 w-3.5" />
                    {c.label}
                  </TabsTrigger>
                );
              })}
            </TabsList>
            {CONFIGS.map((c) => (
              <TabsContent key={c.table} value={c.table} className="mt-4">
                <OutletPanel config={c} cities={cities} />
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
