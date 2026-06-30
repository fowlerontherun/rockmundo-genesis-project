import { useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Plus, Trash2, Package, Wrench, Coins } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";

interface Props {
  companyId: string;
  isOwner: boolean;
}

const fmt = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

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

  const addItem = useMutation({
    mutationFn: async (v: any) => {
      const { error } = await (supabase as any).from("company_inventory").insert({ ...v, company_id: companyId });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Item added to shelf"); qc.invalidateQueries({ queryKey: ["company-inventory", companyId] }); },
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

  return (
    <Tabs defaultValue="inventory" className="space-y-4">
      <TabsList>
        <TabsTrigger value="inventory"><Package className="h-4 w-4 mr-2" />Inventory ({inventory.data?.length ?? 0})</TabsTrigger>
        <TabsTrigger value="services"><Wrench className="h-4 w-4 mr-2" />Service menu ({services.data?.length ?? 0})</TabsTrigger>
        <TabsTrigger value="dividends"><Coins className="h-4 w-4 mr-2" />Dividends</TabsTrigger>
      </TabsList>

      <TabsContent value="inventory" className="space-y-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Shelf inventory</CardTitle>
              <CardDescription>Items customers can buy in your storefront</CardDescription>
            </div>
            {isOwner && <AddItemDialog onAdd={(v) => addItem.mutate(v)} />}
          </CardHeader>
          <CardContent className="space-y-2">
            {inventory.isLoading ? <p className="text-sm text-muted-foreground">Loading…</p>
              : inventory.data?.length === 0 ? <p className="text-sm text-muted-foreground">No items yet. Add your first product.</p>
              : inventory.data?.map((it: any) => (
                <div key={it.id} className="flex items-center justify-between p-3 border rounded-md">
                  <div>
                    <div className="font-medium flex items-center gap-2">{it.name} {it.is_featured && <Badge variant="secondary">Featured</Badge>}</div>
                    <div className="text-xs text-muted-foreground">{it.category ?? "Misc"} · Stock {it.stock} · Cost {fmt.format(it.unit_cost)}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="font-medium">{fmt.format(it.unit_price)}</div>
                    {isOwner && <Button variant="ghost" size="sm" onClick={() => removeItem.mutate(it.id)}><Trash2 className="h-4 w-4" /></Button>}
                  </div>
                </div>
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

function AddItemDialog({ onAdd }: { onAdd: (v: any) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(""); const [price, setPrice] = useState("10"); const [cost, setCost] = useState("4");
  const [stock, setStock] = useState("100"); const [cat, setCat] = useState(""); const [desc, setDesc] = useState("");
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" />Add item</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>New shelf item</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Name</Label><Input value={name} onChange={e => setName(e.target.value)} /></div>
          <div><Label>Category</Label><Input value={cat} onChange={e => setCat(e.target.value)} placeholder="Drinks, Food, Apparel…" /></div>
          <div><Label>Description</Label><Textarea value={desc} onChange={e => setDesc(e.target.value)} rows={2} /></div>
          <div className="grid grid-cols-3 gap-2">
            <div><Label>Price</Label><Input type="number" value={price} onChange={e => setPrice(e.target.value)} /></div>
            <div><Label>Unit cost</Label><Input type="number" value={cost} onChange={e => setCost(e.target.value)} /></div>
            <div><Label>Stock</Label><Input type="number" value={stock} onChange={e => setStock(e.target.value)} /></div>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => { onAdd({ name, category: cat, description: desc, unit_price: +price, unit_cost: +cost, stock: +stock }); setOpen(false); }}>Add</Button>
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
