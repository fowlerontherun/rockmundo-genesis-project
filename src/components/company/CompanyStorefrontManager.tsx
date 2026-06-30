import { useEffect, useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Plus, Trash2, Package, Wrench, Coins, Settings, Minus, AlertTriangle, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";

interface Props {
  companyId: string;
  isOwner: boolean;
}

const fmt = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const DAYS = [
  { id: "mon", label: "Mon" }, { id: "tue", label: "Tue" }, { id: "wed", label: "Wed" },
  { id: "thu", label: "Thu" }, { id: "fri", label: "Fri" }, { id: "sat", label: "Sat" }, { id: "sun", label: "Sun" },
];
const SOLD_OUT_OPTIONS = [
  { value: "hide", label: "Hide from shelf", help: "Out-of-stock items disappear from public storefront" },
  { value: "show_unavailable", label: "Show as unavailable", help: "Listed with a sold-out badge, no checkout" },
  { value: "backorder", label: "Accept backorders", help: "Customers can still order; fulfillment delayed" },
  { value: "substitute", label: "Suggest substitutes", help: "Promote a featured alternative when empty" },
];

export function CompanyStorefrontManager({ companyId, isOwner }: Props) {
  const qc = useQueryClient();

  const inventory = useQuery({
    queryKey: ["company-inventory", companyId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("company_inventory").select("*").eq("company_id", companyId).order("created_at", { ascending: false });
      if (error) throw error; return data ?? [];
    },
  });

  const services = useQuery({
    queryKey: ["company-services", companyId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("company_services").select("*").eq("company_id", companyId).order("created_at", { ascending: false });
      if (error) throw error; return data ?? [];
    },
  });

  const storefront = useQuery({
    queryKey: ["company-storefront", companyId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("company_storefront").select("*").eq("company_id", companyId).maybeSingle();
      if (error) throw error; return data;
    },
  });

  const addItem = useMutation({
    mutationFn: async (v: any) => {
      const { error } = await (supabase as any).from("company_inventory").insert({ ...v, company_id: companyId });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Item added to shelf"); qc.invalidateQueries({ queryKey: ["company-inventory", companyId] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const updateItem = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: any }) => {
      const { error } = await (supabase as any).from("company_inventory").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["company-inventory", companyId] }),
    onError: (e: any) => toast.error(e.message),
  });

  const addService = useMutation({
    mutationFn: async (v: any) => {
      const { error } = await (supabase as any).from("company_services").insert({ ...v, company_id: companyId });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Service added to menu"); qc.invalidateQueries({ queryKey: ["company-services", companyId] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const removeItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("company_inventory").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["company-inventory", companyId] }),
  });

  const removeService = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("company_services").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["company-services", companyId] }),
  });

  const saveStorefront = useMutation({
    mutationFn: async (patch: any) => {
      const { error } = await (supabase as any).from("company_storefront").update(patch).eq("company_id", companyId);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Storefront settings saved"); qc.invalidateQueries({ queryKey: ["company-storefront", companyId] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const payDividends = useMutation({
    mutationFn: async (total: number) => {
      const { data, error } = await (supabase as any).rpc("pay_company_dividends", { p_company_id: companyId, p_total: total });
      if (error) throw error; return data;
    },
    onSuccess: (d: any) => {
      toast.success(`Paid ${fmt.format(d?.total ?? 0)} to ${d?.shares ?? 0} shares`);
      qc.invalidateQueries({ queryKey: ["company", companyId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const lowStockCount = (inventory.data ?? []).filter((i: any) => i.stock <= (i.restock_level ?? 0) && i.is_active).length;
  const outOfStockCount = (inventory.data ?? []).filter((i: any) => i.stock === 0 && i.is_active).length;

  return (
    <Tabs defaultValue="inventory" className="space-y-4">
      <TabsList>
        <TabsTrigger value="inventory">
          <Package className="h-4 w-4 mr-2" />Inventory ({inventory.data?.length ?? 0})
          {lowStockCount > 0 && <Badge variant="destructive" className="ml-2">{lowStockCount} low</Badge>}
        </TabsTrigger>
        <TabsTrigger value="services"><Wrench className="h-4 w-4 mr-2" />Services ({services.data?.length ?? 0})</TabsTrigger>
        <TabsTrigger value="settings"><Settings className="h-4 w-4 mr-2" />Storefront settings</TabsTrigger>
        <TabsTrigger value="dividends"><Coins className="h-4 w-4 mr-2" />Dividends</TabsTrigger>
      </TabsList>

      <TabsContent value="inventory" className="space-y-3">
        {outOfStockCount > 0 && (
          <Card className="border-destructive/50 bg-destructive/5">
            <CardContent className="p-3 flex items-center gap-2 text-sm">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              <span><strong>{outOfStockCount}</strong> active item{outOfStockCount === 1 ? "" : "s"} sold out — current behavior: <strong>{SOLD_OUT_OPTIONS.find(o => o.value === (storefront.data?.sold_out_behavior ?? "hide"))?.label}</strong></span>
            </CardContent>
          </Card>
        )}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Shelf inventory</CardTitle>
              <CardDescription>Manage stock levels and restock thresholds per SKU</CardDescription>
            </div>
            {isOwner && <AddItemDialog onAdd={(v) => addItem.mutate(v)} />}
          </CardHeader>
          <CardContent className="space-y-2">
            {inventory.isLoading ? <p className="text-sm text-muted-foreground">Loading…</p>
              : inventory.data?.length === 0 ? <p className="text-sm text-muted-foreground">No items yet. Add your first product.</p>
              : inventory.data?.map((it: any) => (
                <InventoryRow
                  key={it.id}
                  item={it}
                  isOwner={isOwner}
                  onPatch={(patch) => updateItem.mutate({ id: it.id, patch })}
                  onRemove={() => removeItem.mutate(it.id)}
                />
              ))}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="services" className="space-y-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Service menu</CardTitle>
              <CardDescription>Bookable services for walk-in customers</CardDescription>
            </div>
            {isOwner && <AddServiceDialog onAdd={(v) => addService.mutate(v)} />}
          </CardHeader>
          <CardContent className="space-y-2">
            {services.isLoading ? <p className="text-sm text-muted-foreground">Loading…</p>
              : services.data?.length === 0 ? <p className="text-sm text-muted-foreground">No services yet. Build your menu.</p>
              : services.data?.map((s: any) => (
                <div key={s.id} className="flex items-center justify-between p-3 border rounded-md">
                  <div>
                    <div className="font-medium">{s.name} <Badge variant="outline" className="ml-2">Q{s.quality_tier}</Badge></div>
                    <div className="text-xs text-muted-foreground">{s.duration_minutes} min · {s.category ?? "General"}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="font-medium">{fmt.format(s.price)}</div>
                    {isOwner && <Button variant="ghost" size="sm" onClick={() => removeService.mutate(s.id)}><Trash2 className="h-4 w-4" /></Button>}
                  </div>
                </div>
              ))}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="settings">
        <StorefrontSettings
          isOwner={isOwner}
          loading={storefront.isLoading}
          data={storefront.data}
          onSave={(patch) => saveStorefront.mutate(patch)}
          pending={saveStorefront.isPending}
        />
      </TabsContent>

      <TabsContent value="dividends">
        <Card>
          <CardHeader>
            <CardTitle>Pay shareholder dividends</CardTitle>
            <CardDescription>Distribute a pot of cash from company balance, pro-rata to every shareholder</CardDescription>
          </CardHeader>
          <CardContent>
            {!isOwner ? <p className="text-sm text-muted-foreground">Only the company owner can declare dividends.</p>
              : <DividendForm onPay={(n) => payDividends.mutate(n)} pending={payDividends.isPending} />}
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}

function InventoryRow({ item, isOwner, onPatch, onRemove }: { item: any; isOwner: boolean; onPatch: (p: any) => void; onRemove: () => void }) {
  const [stock, setStock] = useState<number>(item.stock);
  const [restock, setRestock] = useState<number>(item.restock_level ?? 0);
  useEffect(() => { setStock(item.stock); setRestock(item.restock_level ?? 0); }, [item.stock, item.restock_level]);

  const low = stock <= restock;
  const out = stock === 0;

  return (
    <div className="p-3 border rounded-md space-y-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="min-w-0">
          <div className="font-medium flex items-center gap-2 flex-wrap">
            {item.name}
            {item.is_featured && <Badge variant="secondary">Featured</Badge>}
            {out ? <Badge variant="destructive">Sold out</Badge> : low ? <Badge variant="outline" className="text-amber-600 border-amber-600">Low</Badge> : null}
            {!item.is_active && <Badge variant="outline">Disabled</Badge>}
          </div>
          <div className="text-xs text-muted-foreground">{item.category ?? "Misc"} · Cost {fmt.format(item.unit_cost)} · Price {fmt.format(item.unit_price)}</div>
        </div>
        {isOwner && (
          <div className="flex items-center gap-2">
            <Label className="text-xs">Active</Label>
            <Switch checked={item.is_active} onCheckedChange={(v) => onPatch({ is_active: v })} />
            <Button variant="ghost" size="sm" onClick={onRemove}><Trash2 className="h-4 w-4" /></Button>
          </div>
        )}
      </div>
      {isOwner && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t">
          <div>
            <Label className="text-xs">Stock on hand</Label>
            <div className="flex items-center gap-1 mt-1">
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => onPatch({ stock: Math.max(0, stock - 1) })}><Minus className="h-3 w-3" /></Button>
              <Input
                type="number" min={0} value={stock}
                onChange={(e) => setStock(Math.max(0, +e.target.value || 0))}
                onBlur={() => stock !== item.stock && onPatch({ stock })}
                className="h-8 text-center"
              />
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => onPatch({ stock: stock + 1 })}><Plus className="h-3 w-3" /></Button>
              <Button variant="outline" size="sm" className="h-8 ml-1" onClick={() => onPatch({ stock: stock + 10 })}>+10</Button>
              <Button variant="outline" size="sm" className="h-8" onClick={() => onPatch({ stock: stock + 100 })}>+100</Button>
            </div>
          </div>
          <div>
            <Label className="text-xs">Restock alert at</Label>
            <Input
              type="number" min={0} value={restock} className="h-8 mt-1"
              onChange={(e) => setRestock(Math.max(0, +e.target.value || 0))}
              onBlur={() => restock !== (item.restock_level ?? 0) && onPatch({ restock_level: restock })}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function StorefrontSettings({ isOwner, loading, data, onSave, pending }: { isOwner: boolean; loading: boolean; data: any; onSave: (p: any) => void; pending: boolean }) {
  const [openHour, setOpenHour] = useState<number>(9);
  const [closeHour, setCloseHour] = useState<number>(21);
  const [openDays, setOpenDays] = useState<string[]>(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]);
  const [soldOut, setSoldOut] = useState<string>("hide");
  const [isPublic, setIsPublic] = useState<boolean>(true);

  useEffect(() => {
    if (!data) return;
    setOpenHour(data.open_hour ?? 9);
    setCloseHour(data.close_hour ?? 21);
    setOpenDays(data.open_days ?? ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]);
    setSoldOut(data.sold_out_behavior ?? "hide");
    setIsPublic(data.is_public ?? true);
  }, [data]);

  if (loading) return <Card><CardContent className="p-6 text-sm text-muted-foreground">Loading storefront…</CardContent></Card>;
  if (!data) return <Card><CardContent className="p-6 text-sm text-muted-foreground">No storefront record yet for this company.</CardContent></Card>;

  const hoursOpen = closeHour > openHour ? closeHour - openHour : (24 - openHour) + closeHour;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Clock className="h-4 w-4" />Service hours</CardTitle>
          <CardDescription>Customers and shift workers are turned away outside these hours</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">Opens at</Label>
              <Select value={String(openHour)} onValueChange={(v) => setOpenHour(+v)} disabled={!isOwner}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{Array.from({ length: 24 }, (_, i) => (<SelectItem key={i} value={String(i)}>{String(i).padStart(2, "0")}:00</SelectItem>))}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Closes at</Label>
              <Select value={String(closeHour)} onValueChange={(v) => setCloseHour(+v)} disabled={!isOwner}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{Array.from({ length: 24 }, (_, i) => (<SelectItem key={i} value={String(i)}>{String(i).padStart(2, "0")}:00</SelectItem>))}</SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <div className="text-sm text-muted-foreground">Open <strong>{hoursOpen}h/day</strong> across {openDays.length} day{openDays.length === 1 ? "" : "s"}</div>
            </div>
          </div>
          <div>
            <Label className="text-xs">Operating days</Label>
            <ToggleGroup
              type="multiple" value={openDays}
              onValueChange={(v) => v.length && setOpenDays(v)}
              disabled={!isOwner}
              className="mt-2 justify-start flex-wrap"
            >
              {DAYS.map(d => <ToggleGroupItem key={d.id} value={d.id} className="w-12">{d.label}</ToggleGroupItem>)}
            </ToggleGroup>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><AlertTriangle className="h-4 w-4" />Sold-out behavior</CardTitle>
          <CardDescription>What customers see when a shelf item hits zero stock</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {SOLD_OUT_OPTIONS.map(opt => (
            <label key={opt.value} className={`flex items-start gap-3 p-3 border rounded-md cursor-pointer transition ${soldOut === opt.value ? "border-primary bg-primary/5" : "hover:bg-muted/50"} ${!isOwner ? "opacity-60 cursor-not-allowed" : ""}`}>
              <input
                type="radio" name="soldout" value={opt.value} checked={soldOut === opt.value}
                disabled={!isOwner}
                onChange={() => setSoldOut(opt.value)} className="mt-1"
              />
              <div>
                <div className="font-medium text-sm">{opt.label}</div>
                <div className="text-xs text-muted-foreground">{opt.help}</div>
              </div>
            </label>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Visibility</CardTitle>
          <CardDescription>Public storefronts appear in the World Companies directory</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-between">
          <Label htmlFor="ispublic" className="text-sm">List this company publicly</Label>
          <Switch id="ispublic" checked={isPublic} onCheckedChange={setIsPublic} disabled={!isOwner} />
        </CardContent>
      </Card>

      {isOwner && (
        <div className="flex justify-end">
          <Button
            disabled={pending}
            onClick={() => onSave({ open_hour: openHour, close_hour: closeHour, open_days: openDays, sold_out_behavior: soldOut, is_public: isPublic })}
          >
            {pending ? "Saving…" : "Save storefront settings"}
          </Button>
        </div>
      )}
    </div>
  );
}

function AddItemDialog({ onAdd }: { onAdd: (v: any) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(""); const [price, setPrice] = useState("10"); const [cost, setCost] = useState("4");
  const [stock, setStock] = useState("100"); const [restock, setRestock] = useState("10");
  const [cat, setCat] = useState(""); const [desc, setDesc] = useState("");
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" />Add item</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>New shelf item</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Name</Label><Input value={name} onChange={e => setName(e.target.value)} /></div>
          <div><Label>Category</Label><Input value={cat} onChange={e => setCat(e.target.value)} placeholder="Drinks, Food, Apparel…" /></div>
          <div><Label>Description</Label><Textarea value={desc} onChange={e => setDesc(e.target.value)} rows={2} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>Price</Label><Input type="number" value={price} onChange={e => setPrice(e.target.value)} /></div>
            <div><Label>Unit cost</Label><Input type="number" value={cost} onChange={e => setCost(e.target.value)} /></div>
            <div><Label>Starting stock</Label><Input type="number" value={stock} onChange={e => setStock(e.target.value)} /></div>
            <div><Label>Restock alert at</Label><Input type="number" value={restock} onChange={e => setRestock(e.target.value)} /></div>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => { onAdd({ name, category: cat, description: desc, unit_price: +price, unit_cost: +cost, stock: +stock, restock_level: +restock }); setOpen(false); }}>Add</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddServiceDialog({ onAdd }: { onAdd: (v: any) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(""); const [price, setPrice] = useState("25"); const [duration, setDuration] = useState("30");
  const [tier, setTier] = useState("3"); const [cat, setCat] = useState(""); const [desc, setDesc] = useState("");
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" />Add service</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>New service</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Name</Label><Input value={name} onChange={e => setName(e.target.value)} /></div>
          <div><Label>Category</Label><Input value={cat} onChange={e => setCat(e.target.value)} /></div>
          <div><Label>Description</Label><Textarea value={desc} onChange={e => setDesc(e.target.value)} rows={2} /></div>
          <div className="grid grid-cols-3 gap-2">
            <div><Label>Price</Label><Input type="number" value={price} onChange={e => setPrice(e.target.value)} /></div>
            <div><Label>Minutes</Label><Input type="number" value={duration} onChange={e => setDuration(e.target.value)} /></div>
            <div><Label>Quality 1–5</Label><Input type="number" min={1} max={5} value={tier} onChange={e => setTier(e.target.value)} /></div>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => { onAdd({ name, category: cat, description: desc, price: +price, duration_minutes: +duration, quality_tier: +tier }); setOpen(false); }}>Add</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DividendForm({ onPay, pending }: { onPay: (n: number) => void; pending: boolean }) {
  const [total, setTotal] = useState("10000");
  return (
    <div className="flex items-end gap-3">
      <div className="flex-1"><Label>Total to distribute</Label><Input type="number" value={total} onChange={e => setTotal(e.target.value)} /></div>
      <Button disabled={pending} onClick={() => onPay(+total)}><Coins className="h-4 w-4 mr-2" />Pay dividend</Button>
    </div>
  );
}
