import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Package, Wrench, Plus, Trash2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

interface InventoryRow {
  id: string;
  name: string;
  category: string | null;
  unit_price: number;
  unit_cost: number;
  stock: number;
  restock_level: number;
  is_active: boolean;
}

interface ServiceRow {
  id: string;
  name: string;
  category: string | null;
  price: number;
  duration_minutes: number;
  quality_tier: number;
  is_active: boolean;
}

const money = (value: number) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(
    Number(value ?? 0),
  );

export function CompanyOperationsPanel({ companyId, isOwner }: { companyId: string; isOwner: boolean }) {
  const queryClient = useQueryClient();
  const [item, setItem] = useState({ name: "", category: "", unit_price: "", unit_cost: "", stock: "" });
  const [service, setService] = useState({ name: "", category: "", price: "", duration_minutes: "60" });

  const inventoryKey = ["company-inventory", companyId];
  const servicesKey = ["company-services", companyId];

  const { data: inventory = [], isLoading: loadingInventory } = useQuery({
    queryKey: inventoryKey,
    queryFn: async (): Promise<InventoryRow[]> => {
      const { data, error } = await supabase
        .from("company_inventory")
        .select("id, name, category, unit_price, unit_cost, stock, restock_level, is_active")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as InventoryRow[];
    },
    enabled: !!companyId,
  });

  const { data: services = [], isLoading: loadingServices } = useQuery({
    queryKey: servicesKey,
    queryFn: async (): Promise<ServiceRow[]> => {
      const { data, error } = await supabase
        .from("company_services")
        .select("id, name, category, price, duration_minutes, quality_tier, is_active")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ServiceRow[];
    },
    enabled: !!companyId,
  });

  const addItem = useMutation({
    mutationFn: async () => {
      if (!item.name.trim()) throw new Error("Give the product a name");
      const { error } = await supabase.from("company_inventory").insert({
        company_id: companyId,
        name: item.name.trim(),
        category: item.category.trim() || null,
        unit_price: Math.round(Number(item.unit_price || 0) * 100) / 100,
        unit_cost: Math.round(Number(item.unit_cost || 0) * 100) / 100,
        stock: Math.max(0, Math.round(Number(item.stock || 0))),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Product added to inventory");
      setItem({ name: "", category: "", unit_price: "", unit_cost: "", stock: "" });
      queryClient.invalidateQueries({ queryKey: inventoryKey });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addService = useMutation({
    mutationFn: async () => {
      if (!service.name.trim()) throw new Error("Give the service a name");
      const { error } = await supabase.from("company_services").insert({
        company_id: companyId,
        name: service.name.trim(),
        category: service.category.trim() || null,
        price: Math.round(Number(service.price || 0) * 100) / 100,
        duration_minutes: Math.max(5, Math.round(Number(service.duration_minutes || 60))),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Service published");
      setService({ name: "", category: "", price: "", duration_minutes: "60" });
      queryClient.invalidateQueries({ queryKey: servicesKey });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleItem = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("company_inventory").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: inventoryKey }),
    onError: (e: Error) => toast.error(e.message),
  });

  const restock = useMutation({
    mutationFn: async ({ id, stock }: { id: string; stock: number }) => {
      const { error } = await supabase.from("company_inventory").update({ stock }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Stock updated");
      queryClient.invalidateQueries({ queryKey: inventoryKey });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("company_inventory").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: inventoryKey }),
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleService = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("company_services").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: servicesKey }),
    onError: (e: Error) => toast.error(e.message),
  });

  const removeService = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("company_services").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: servicesKey }),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Package className="h-4 w-4" /> Inventory ({inventory.length})
          </CardTitle>
          <CardDescription>
            Stocked products sold through your storefront. Items with no stock stop selling until you restock them.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {isOwner && (
            <div className="grid gap-2 rounded-lg border p-3 md:grid-cols-6">
              <div className="md:col-span-2">
                <Label className="text-[11px]">Product</Label>
                <Input value={item.name} onChange={(e) => setItem({ ...item, name: e.target.value })} placeholder="T-shirt" />
              </div>
              <div>
                <Label className="text-[11px]">Category</Label>
                <Input value={item.category} onChange={(e) => setItem({ ...item, category: e.target.value })} placeholder="merch" />
              </div>
              <div>
                <Label className="text-[11px]">Price</Label>
                <Input type="number" value={item.unit_price} onChange={(e) => setItem({ ...item, unit_price: e.target.value })} />
              </div>
              <div>
                <Label className="text-[11px]">Unit cost</Label>
                <Input type="number" value={item.unit_cost} onChange={(e) => setItem({ ...item, unit_cost: e.target.value })} />
              </div>
              <div className="flex items-end gap-2">
                <div>
                  <Label className="text-[11px]">Stock</Label>
                  <Input type="number" value={item.stock} onChange={(e) => setItem({ ...item, stock: e.target.value })} />
                </div>
                <Button size="icon" onClick={() => addItem.mutate()} disabled={addItem.isPending}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {loadingInventory ? (
            <Skeleton className="h-14 w-full" />
          ) : inventory.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No products yet. Add stock so your storefront has something to sell.
            </p>
          ) : (
            inventory.map((row) => (
              <div key={row.id} className="flex items-center justify-between gap-3 rounded-lg border p-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{row.name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {row.category ?? "general"} • sells {money(row.unit_price)} • costs {money(row.unit_cost)} • margin{" "}
                    {money(Number(row.unit_price) - Number(row.unit_cost))}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {row.stock <= row.restock_level && (
                    <Badge variant="destructive" className="text-[10px]">
                      <AlertTriangle className="mr-1 h-3 w-3" /> low
                    </Badge>
                  )}
                  <Badge variant="outline" className="text-[10px]">{row.stock} in stock</Badge>
                  {isOwner && (
                    <>
                      <Button size="sm" variant="outline" onClick={() => restock.mutate({ id: row.id, stock: row.stock + 50 })}>
                        +50
                      </Button>
                      <Switch
                        checked={row.is_active}
                        onCheckedChange={(checked) => toggleItem.mutate({ id: row.id, is_active: checked })}
                      />
                      <Button size="icon" variant="ghost" onClick={() => removeItem.mutate(row.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Wrench className="h-4 w-4" /> Services ({services.length})
          </CardTitle>
          <CardDescription>
            Bookable services other players and companies can buy from you. Only active services appear publicly.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {isOwner && (
            <div className="grid gap-2 rounded-lg border p-3 md:grid-cols-5">
              <div className="md:col-span-2">
                <Label className="text-[11px]">Service</Label>
                <Input value={service.name} onChange={(e) => setService({ ...service, name: e.target.value })} placeholder="Mixing session" />
              </div>
              <div>
                <Label className="text-[11px]">Category</Label>
                <Input value={service.category} onChange={(e) => setService({ ...service, category: e.target.value })} placeholder="studio" />
              </div>
              <div>
                <Label className="text-[11px]">Price</Label>
                <Input type="number" value={service.price} onChange={(e) => setService({ ...service, price: e.target.value })} />
              </div>
              <div className="flex items-end gap-2">
                <div>
                  <Label className="text-[11px]">Minutes</Label>
                  <Input
                    type="number"
                    value={service.duration_minutes}
                    onChange={(e) => setService({ ...service, duration_minutes: e.target.value })}
                  />
                </div>
                <Button size="icon" onClick={() => addService.mutate()} disabled={addService.isPending}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {loadingServices ? (
            <Skeleton className="h-14 w-full" />
          ) : services.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No services published yet. Add one so clients can hire this business.
            </p>
          ) : (
            services.map((row) => (
              <div key={row.id} className="flex items-center justify-between gap-3 rounded-lg border p-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{row.name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {row.category ?? "general"} • {money(row.price)} • {row.duration_minutes} min • tier {row.quality_tier}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge variant={row.is_active ? "default" : "outline"} className="text-[10px]">
                    {row.is_active ? "live" : "paused"}
                  </Badge>
                  {isOwner && (
                    <>
                      <Switch
                        checked={row.is_active}
                        onCheckedChange={(checked) => toggleService.mutate({ id: row.id, is_active: checked })}
                      />
                      <Button size="icon" variant="ghost" onClick={() => removeService.mutate(row.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
