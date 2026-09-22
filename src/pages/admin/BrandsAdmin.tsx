import { useEffect, useMemo, useState } from "react";
import { AdminRoute } from "@/components/AdminRoute";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Plus, RefreshCw, Save, Trash2 } from "lucide-react";

interface BrandRecord {
  id: string;
  name: string;
  category: string;
  region: string;
  size: string;
  wealth_tier: number;
  min_fame_required: number;
  is_active: boolean;
  logo_url: string | null;
  available_budget: number | null;
  wealth_score: number | null;
  targeting_flags: string[] | null;
  min_fame_threshold: number | null;
  exclusivity_pref: boolean | null;
}

const defaultCategories = [
  "music_gear",
  "fashion",
  "technology",
  "gaming",
  "automotive",
  "finance",
  "fitness",
  "travel",
  "entertainment",
  "soft_drinks",
];

const defaultRegions = [
  "United Kingdom",
  "United States",
  "Europe",
  "North America",
  "Asia Pacific",
  "Latin America",
  "Canada",
  "Australia",
  "Japan",
  "Global",
];

const defaultSizes = ["emerging", "growth", "major", "enterprise"];

const emptyForm = {
  name: "",
  category: "music_gear",
  region: "United Kingdom",
  size: "emerging",
  wealthTier: 1,
  wealthScore: 35,
  availableBudget: 100000,
  minFame: 0,
  active: true,
  exclusivity: false,
  targetingFlags: "",
};

const formatMoney = (value: number | null) =>
  new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(value ?? 0);

const BrandsAdmin = () => {
  const [brands, setBrands] = useState<BrandRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("catalog");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filters, setFilters] = useState({ search: "", category: "all", region: "all", active: "all" });
  const [form, setForm] = useState(emptyForm);

  const loadBrands = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("sponsorship_brands")
      .select("*")
      .order("name", { ascending: true });

    if (error) {
      toast.error(`Could not load brands: ${error.message}`);
      setLoading(false);
      return;
    }

    setBrands((data ?? []) as BrandRecord[]);
    setLoading(false);
  };

  useEffect(() => {
    void loadBrands();
  }, []);

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
  };

  const handleSubmit = async () => {
    const name = form.name.trim();
    if (!name) {
      toast.error("Brand name is required");
      return;
    }

    setSaving(true);
    const payload = {
      name,
      category: form.category.trim() || "lifestyle",
      region: form.region.trim() || "Global",
      size: form.size,
      wealth_tier: Math.min(5, Math.max(1, Number(form.wealthTier) || 1)),
      wealth_score: Math.min(100, Math.max(0, Number(form.wealthScore) || 0)),
      available_budget: Math.max(0, Number(form.availableBudget) || 0),
      min_fame_required: Math.max(0, Number(form.minFame) || 0),
      min_fame_threshold: Math.max(0, Number(form.minFame) || 0),
      is_active: form.active,
      exclusivity_pref: form.exclusivity,
      targeting_flags: form.targetingFlags
        .split(",")
        .map((flag) => flag.trim())
        .filter(Boolean),
    };

    const query = editingId
      ? supabase.from("sponsorship_brands").update(payload).eq("id", editingId).select("*").single()
      : supabase.from("sponsorship_brands").insert(payload).select("*").single();

    const { data, error } = await query;

    if (error) {
      toast.error(`Could not save brand: ${error.message}`);
      setSaving(false);
      return;
    }

    const saved = data as BrandRecord;
    setBrands((prev) =>
      editingId
        ? prev.map((brand) => (brand.id === saved.id ? saved : brand))
        : [...prev, saved].sort((a, b) => a.name.localeCompare(b.name))
    );
    toast.success(editingId ? "Brand updated" : "Brand created");
    resetForm();
    setActiveTab("catalog");
    setSaving(false);
  };

  const handleEdit = (brand: BrandRecord) => {
    setEditingId(brand.id);
    setForm({
      name: brand.name,
      category: brand.category,
      region: brand.region,
      size: brand.size,
      wealthTier: brand.wealth_tier,
      wealthScore: brand.wealth_score ?? 0,
      availableBudget: brand.available_budget ?? 0,
      minFame: brand.min_fame_threshold ?? brand.min_fame_required,
      active: brand.is_active,
      exclusivity: Boolean(brand.exclusivity_pref),
      targetingFlags: (brand.targeting_flags ?? []).join(", "),
    });
    setActiveTab("form");
  };

  const handleDelete = async (brand: BrandRecord) => {
    if (!window.confirm(`Delete ${brand.name}? Existing sponsorship records may prevent deletion.`)) return;

    const { error } = await supabase.from("sponsorship_brands").delete().eq("id", brand.id);
    if (error) {
      toast.error(`Could not delete brand: ${error.message}`);
      return;
    }

    setBrands((prev) => prev.filter((item) => item.id !== brand.id));
    if (editingId === brand.id) resetForm();
    toast.success("Brand deleted");
  };

  const categoryOptions = useMemo(
    () => Array.from(new Set([...defaultCategories, ...brands.map((brand) => brand.category)])).sort(),
    [brands]
  );
  const regionOptions = useMemo(
    () => Array.from(new Set([...defaultRegions, ...brands.map((brand) => brand.region)])).sort(),
    [brands]
  );
  const sizeOptions = useMemo(
    () => Array.from(new Set([...defaultSizes, ...brands.map((brand) => brand.size)])).sort(),
    [brands]
  );

  const filteredBrands = useMemo(() => {
    const search = filters.search.trim().toLowerCase();
    return brands.filter((brand) => {
      const matchesSearch =
        !search ||
        brand.name.toLowerCase().includes(search) ||
        brand.category.toLowerCase().includes(search) ||
        brand.region.toLowerCase().includes(search);
      const matchesCategory = filters.category === "all" || brand.category === filters.category;
      const matchesRegion = filters.region === "all" || brand.region === filters.region;
      const matchesActive =
        filters.active === "all" ||
        (filters.active === "active" ? brand.is_active : !brand.is_active);
      return matchesSearch && matchesCategory && matchesRegion && matchesActive;
    });
  }, [brands, filters]);

  const activeCount = brands.filter((brand) => brand.is_active).length;
  const totalBudget = brands.reduce((sum, brand) => sum + Number(brand.available_budget ?? 0), 0);

  return (
    <AdminRoute>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold">Brand Administration</h1>
            <p className="text-muted-foreground">
              Manage the live sponsorship brand catalog used by offers, modeling, and festival sponsorships.
            </p>
          </div>
          <Button variant="outline" onClick={() => void loadBrands()} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2"><CardDescription>Total brands</CardDescription></CardHeader>
            <CardContent><p className="text-3xl font-bold">{brands.length}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardDescription>Active brands</CardDescription></CardHeader>
            <CardContent><p className="text-3xl font-bold">{activeCount}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardDescription>Available sponsorship budget</CardDescription></CardHeader>
            <CardContent><p className="text-3xl font-bold">{formatMoney(totalBudget)}</p></CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList>
            <TabsTrigger value="catalog">Brand catalog</TabsTrigger>
            <TabsTrigger value="form">{editingId ? "Edit brand" : "Create brand"}</TabsTrigger>
          </TabsList>

          <TabsContent value="catalog" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Filters</CardTitle>
                <CardDescription>{filteredBrands.length} of {brands.length} brands shown.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-4">
                <Input
                  value={filters.search}
                  onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
                  placeholder="Search name, category or region"
                />
                <Select value={filters.category} onValueChange={(value) => setFilters((prev) => ({ ...prev, category: value }))}>
                  <SelectTrigger><SelectValue placeholder="All categories" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All categories</SelectItem>
                    {categoryOptions.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={filters.region} onValueChange={(value) => setFilters((prev) => ({ ...prev, region: value }))}>
                  <SelectTrigger><SelectValue placeholder="All regions" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All regions</SelectItem>
                    {regionOptions.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={filters.active} onValueChange={(value) => setFilters((prev) => ({ ...prev, active: value }))}>
                  <SelectTrigger><SelectValue placeholder="All states" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All states</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Live brand catalog</CardTitle>
                <CardDescription>Changes here are persisted directly to the sponsorship system.</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex items-center justify-center py-12 text-muted-foreground">
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading brands…
                  </div>
                ) : (
                  <div className="max-h-[70vh] overflow-auto rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Size</TableHead>
                          <TableHead>Category</TableHead>
                          <TableHead>Region</TableHead>
                          <TableHead>Fame</TableHead>
                          <TableHead>Budget</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredBrands.map((brand) => (
                          <TableRow key={brand.id}>
                            <TableCell className="font-semibold">{brand.name}</TableCell>
                            <TableCell>{brand.size}</TableCell>
                            <TableCell>{brand.category}</TableCell>
                            <TableCell>{brand.region}</TableCell>
                            <TableCell>{brand.min_fame_threshold ?? brand.min_fame_required}</TableCell>
                            <TableCell>{formatMoney(brand.available_budget)}</TableCell>
                            <TableCell>
                              <Badge variant={brand.is_active ? "default" : "secondary"}>
                                {brand.is_active ? "Active" : "Inactive"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex justify-end gap-2">
                                <Button variant="outline" size="sm" onClick={() => handleEdit(brand)}>Edit</Button>
                                <Button variant="destructive" size="sm" onClick={() => void handleDelete(brand)}>
                                  <Trash2 className="mr-1 h-4 w-4" /> Delete
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    {filteredBrands.length === 0 && (
                      <p className="p-6 text-sm text-muted-foreground">No brands match the current filters.</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="form">
            <Card>
              <CardHeader>
                <CardTitle>{editingId ? "Edit brand" : "Create brand"}</CardTitle>
                <CardDescription>
                  These values feed the live offer generator. Minimum fame is kept in sync across legacy and current matching fields.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="brand-name">Name</Label>
                    <Input id="brand-name" value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Category</Label>
                    <Select value={form.category} onValueChange={(value) => setForm((prev) => ({ ...prev, category: value }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {categoryOptions.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Region</Label>
                    <Select value={form.region} onValueChange={(value) => setForm((prev) => ({ ...prev, region: value }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {regionOptions.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Size</Label>
                    <Select value={form.size} onValueChange={(value) => setForm((prev) => ({ ...prev, size: value }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {sizeOptions.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="wealth-tier">Wealth tier (1–5)</Label>
                    <Input id="wealth-tier" type="number" min={1} max={5} value={form.wealthTier} onChange={(e) => setForm((prev) => ({ ...prev, wealthTier: Number(e.target.value) }))} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="wealth-score">Wealth score (0–100)</Label>
                    <Input id="wealth-score" type="number" min={0} max={100} value={form.wealthScore} onChange={(e) => setForm((prev) => ({ ...prev, wealthScore: Number(e.target.value) }))} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="budget">Available budget</Label>
                    <Input id="budget" type="number" min={0} value={form.availableBudget} onChange={(e) => setForm((prev) => ({ ...prev, availableBudget: Number(e.target.value) }))} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="min-fame">Minimum fame</Label>
                    <Input id="min-fame" type="number" min={0} value={form.minFame} onChange={(e) => setForm((prev) => ({ ...prev, minFame: Number(e.target.value) }))} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="targeting">Targeting flags</Label>
                    <Input id="targeting" value={form.targetingFlags} onChange={(e) => setForm((prev) => ({ ...prev, targetingFlags: e.target.value }))} placeholder="rock, touring, festival (comma separated)" />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="flex items-center justify-between rounded-lg border p-4">
                    <div>
                      <Label>Active</Label>
                      <p className="text-xs text-muted-foreground">Inactive brands are excluded from automated offers.</p>
                    </div>
                    <Switch checked={form.active} onCheckedChange={(checked) => setForm((prev) => ({ ...prev, active: checked }))} />
                  </div>
                  <div className="flex items-center justify-between rounded-lg border p-4">
                    <div>
                      <Label>Prefers exclusivity</Label>
                      <p className="text-xs text-muted-foreground">Used by the automated sponsorship offer generator.</p>
                    </div>
                    <Switch checked={form.exclusivity} onCheckedChange={(checked) => setForm((prev) => ({ ...prev, exclusivity: checked }))} />
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={resetForm}>Clear</Button>
                  <Button onClick={() => void handleSubmit()} disabled={saving}>
                    {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : editingId ? <Save className="mr-2 h-4 w-4" /> : <Plus className="mr-2 h-4 w-4" />}
                    {editingId ? "Save changes" : "Create brand"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AdminRoute>
  );
};

export default BrandsAdmin;
