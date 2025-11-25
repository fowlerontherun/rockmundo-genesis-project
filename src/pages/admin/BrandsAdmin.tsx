import { useMemo, useState } from "react";
import { AdminRoute } from "@/components/AdminRoute";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Plus, Save, Trash2, Wand2 } from "lucide-react";
import { nanoid } from "nanoid";

const eligibilityKeys = ["character", "tour", "venue", "festival", "band"] as const;

interface BrandEligibility {
  character: boolean;
  tour: boolean;
  venue: boolean;
  festival: boolean;
  band: boolean;
}

interface BrandRecord {
  id: string;
  name: string;
  size: string;
  fsm: string;
  wealth: number;
  minFame: number;
  active: boolean;
  eligibility: BrandEligibility;
  category: string;
  region: string;
  defaultTerms: string;
}

const defaultBrands: BrandRecord[] = [
  {
    id: "volt-cola",
    name: "Volt Cola",
    size: "Global conglomerate",
    fsm: "CPG / Beverage",
    wealth: 75000000,
    minFame: 45,
    active: true,
    eligibility: {
      character: true,
      tour: true,
      venue: true,
      festival: true,
      band: true,
    },
    category: "Beverage",
    region: "North America",
    defaultTerms: "12-month exclusivity, co-branded merch capsule, quarterly PR lifts",
  },
  {
    id: "aurora-tech",
    name: "Aurora Tech",
    size: "High-growth scale-up",
    fsm: "Devices / Gaming",
    wealth: 32000000,
    minFame: 30,
    active: true,
    eligibility: {
      character: true,
      tour: true,
      venue: false,
      festival: true,
      band: true,
    },
    category: "Technology",
    region: "Europe",
    defaultTerms: "Performance stream overlays, gear loaners, quarterly creator kits",
  },
  {
    id: "ember-studios",
    name: "Ember Studios",
    size: "Indie collective",
    fsm: "Media / Story",
    wealth: 8600000,
    minFame: 18,
    active: false,
    eligibility: {
      character: true,
      tour: false,
      venue: true,
      festival: false,
      band: true,
    },
    category: "Media",
    region: "APAC",
    defaultTerms: "Short-run creative sprint, limited licensing, social lift clauses",
  },
];

const blankEligibility: BrandEligibility = {
  character: false,
  tour: false,
  venue: false,
  festival: false,
  band: false,
};

const brandSizes = [
  "Indie collective",
  "Regional challenger",
  "National leader",
  "Global conglomerate",
];

const brandCategories = ["Beverage", "Technology", "Fashion", "Media", "Finance", "Lifestyle"];
const brandRegions = ["North America", "Europe", "Latin America", "APAC", "Middle East", "Africa"];

const BrandsAdmin = () => {
  const [brands, setBrands] = useState<BrandRecord[]>(defaultBrands);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [eligibility, setEligibility] = useState<BrandEligibility>(blankEligibility);
  const [filters, setFilters] = useState({ search: "", category: "all", region: "all", active: "all" });
  const [form, setForm] = useState({
    name: "",
    size: brandSizes[0],
    fsm: "",
    wealth: 1000000,
    minFame: 10,
    active: true,
    category: brandCategories[0],
    region: brandRegions[0],
    defaultTerms: "",
  });

  const resetForm = () => {
    setForm({
      name: "",
      size: brandSizes[0],
      fsm: "",
      wealth: 1000000,
      minFame: 10,
      active: true,
      category: brandCategories[0],
      region: brandRegions[0],
      defaultTerms: "",
    });
    setEligibility(blankEligibility);
    setEditingId(null);
  };

  const handleSubmit = () => {
    if (!form.name.trim()) {
      toast.error("Brand name is required");
      return;
    }

    const payload: BrandRecord = {
      ...form,
      id: editingId ?? nanoid(),
      eligibility,
    };

    if (editingId) {
      setBrands((prev) => prev.map((brand) => (brand.id === editingId ? payload : brand)));
      toast.success("Brand updated");
    } else {
      setBrands((prev) => [payload, ...prev]);
      toast.success("Brand created");
    }

    resetForm();
  };

  const handleEdit = (brand: BrandRecord) => {
    setEditingId(brand.id);
    setForm({
      name: brand.name,
      size: brand.size,
      fsm: brand.fsm,
      wealth: brand.wealth,
      minFame: brand.minFame,
      active: brand.active,
      category: brand.category,
      region: brand.region,
      defaultTerms: brand.defaultTerms,
    });
    setEligibility(brand.eligibility);
  };

  const handleDelete = (id: string) => {
    setBrands((prev) => prev.filter((brand) => brand.id !== id));
    toast("Brand removed");
    if (editingId === id) {
      resetForm();
    }
  };

  const filteredBrands = useMemo(() => {
    return brands.filter((brand) => {
      const matchesSearch = brand.name.toLowerCase().includes(filters.search.toLowerCase());
      const matchesCategory = filters.category === "all" || brand.category === filters.category;
      const matchesRegion = filters.region === "all" || brand.region === filters.region;
      const matchesActive =
        filters.active === "all" || (filters.active === "active" ? brand.active : !brand.active);
      return matchesSearch && matchesCategory && matchesRegion && matchesActive;
    });
  }, [brands, filters]);

  return (
    <AdminRoute>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold">Brand Administration</h1>
            <p className="text-muted-foreground">
              Create, edit, and filter sponsorship-ready brands with eligibility controls.
            </p>
          </div>
          <Button variant="outline" onClick={resetForm}>
            <Wand2 className="mr-2 h-4 w-4" />
            Reset form
          </Button>
        </div>

        <Tabs defaultValue="form" className="space-y-4">
          <TabsList>
            <TabsTrigger value="form">Brand form</TabsTrigger>
            <TabsTrigger value="catalog">Brand catalog</TabsTrigger>
          </TabsList>

          <TabsContent value="form" className="grid gap-4 md:grid-cols-3">
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>{editingId ? "Edit brand" : "Create brand"}</CardTitle>
                <CardDescription>Core profile fields drive offer matching and eligibility.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="name">Name</Label>
                    <Input
                      id="name"
                      value={form.name}
                      onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                      placeholder="Pulse Beverages"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="size">Size</Label>
                    <Select
                      value={form.size}
                      onValueChange={(value) => setForm((prev) => ({ ...prev, size: value }))}
                    >
                      <SelectTrigger id="size">
                        <SelectValue placeholder="Select size" />
                      </SelectTrigger>
                      <SelectContent>
                        {brandSizes.map((size) => (
                          <SelectItem key={size} value={size}>
                            {size}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="fsm">FSM</Label>
                    <Input
                      id="fsm"
                      value={form.fsm}
                      onChange={(e) => setForm((prev) => ({ ...prev, fsm: e.target.value }))}
                      placeholder="Consumer stack / activation lanes"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="wealth">Wealth</Label>
                    <Input
                      id="wealth"
                      type="number"
                      min={0}
                      value={form.wealth}
                      onChange={(e) => setForm((prev) => ({ ...prev, wealth: Number(e.target.value) }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="minFame">Minimum fame</Label>
                    <Input
                      id="minFame"
                      type="number"
                      min={0}
                      max={100}
                      value={form.minFame}
                      onChange={(e) => setForm((prev) => ({ ...prev, minFame: Number(e.target.value) }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="category">Category</Label>
                    <Select
                      value={form.category}
                      onValueChange={(value) => setForm((prev) => ({ ...prev, category: value }))}
                    >
                      <SelectTrigger id="category">
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        {brandCategories.map((category) => (
                          <SelectItem key={category} value={category}>
                            {category}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="region">Region</Label>
                    <Select
                      value={form.region}
                      onValueChange={(value) => setForm((prev) => ({ ...prev, region: value }))}
                    >
                      <SelectTrigger id="region">
                        <SelectValue placeholder="Select region" />
                      </SelectTrigger>
                      <SelectContent>
                        {brandRegions.map((region) => (
                          <SelectItem key={region} value={region}>
                            {region}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <Label htmlFor="active">Active</Label>
                      <p className="text-xs text-muted-foreground">Toggle to include in sponsorship surfacing.</p>
                    </div>
                    <Switch
                      id="active"
                      checked={form.active}
                      onCheckedChange={(checked) => setForm((prev) => ({ ...prev, active: checked }))}
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <Label>Eligibility</Label>
                  <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                    {eligibilityKeys.map((key) => (
                      <label key={key} className="flex items-center gap-2 rounded-md border p-2">
                        <Checkbox
                          checked={eligibility[key]}
                          onCheckedChange={(checked) =>
                            setEligibility((prev) => ({ ...prev, [key]: Boolean(checked) }))
                          }
                        />
                        <span className="capitalize">{key}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="terms">Default terms</Label>
                  <Textarea
                    id="terms"
                    value={form.defaultTerms}
                    onChange={(e) => setForm((prev) => ({ ...prev, defaultTerms: e.target.value }))}
                    placeholder="Contra mix, approvals, co-marketing cadence, reporting cadence"
                    rows={4}
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={resetForm}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Clear
                  </Button>
                  <Button onClick={handleSubmit}>
                    {editingId ? <Save className="mr-2 h-4 w-4" /> : <Plus className="mr-2 h-4 w-4" />} 
                    {editingId ? "Save changes" : "Create brand"}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Filters</CardTitle>
                <CardDescription>Target brands by eligibility and geography.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="search">Search</Label>
                  <Input
                    id="search"
                    value={filters.search}
                    onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
                    placeholder="Search brands"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select
                    value={filters.category}
                    onValueChange={(value) => setFilters((prev) => ({ ...prev, category: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All categories" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      {brandCategories.map((category) => (
                        <SelectItem key={category} value={category}>
                          {category}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Region</Label>
                  <Select
                    value={filters.region}
                    onValueChange={(value) => setFilters((prev) => ({ ...prev, region: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All regions" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      {brandRegions.map((region) => (
                        <SelectItem key={region} value={region}>
                          {region}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Activation state</Label>
                  <Select
                    value={filters.active}
                    onValueChange={(value) => setFilters((prev) => ({ ...prev, active: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All brands" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="catalog">
            <Card>
              <CardHeader>
                <CardTitle>Brand catalog</CardTitle>
                <CardDescription>Review configured brands and jump into edits.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Size</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Region</TableHead>
                        <TableHead>Min Fame</TableHead>
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
                          <TableCell>{brand.minFame}</TableCell>
                          <TableCell>
                            <Badge variant={brand.active ? "default" : "secondary"}>
                              {brand.active ? "Active" : "Inactive"}
                            </Badge>
                          </TableCell>
                          <TableCell className="flex justify-end gap-2">
                            <Button variant="outline" size="sm" onClick={() => handleEdit(brand)}>
                              Edit
                            </Button>
                            <Button variant="destructive" size="sm" onClick={() => handleDelete(brand.id)}>
                              <Trash2 className="mr-1 h-4 w-4" />
                              Delete
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {filteredBrands.length === 0 && (
                    <p className="p-4 text-sm text-muted-foreground">No brands match the current filters.</p>
                  )}
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
