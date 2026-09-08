import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Clock3, Crown, Loader2, Package, UserCheck, UserX, Zap } from "lucide-react";
import { VipGate } from "@/components/company/VipGate";
import { useMerchManager } from "@/hooks/useMerchManager";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface MerchManagerCardProps {
  bandId: string;
}

type PendingProduction = {
  id: string;
  design_name: string | null;
  item_type: string | null;
  pending_quantity: number | null;
  production_ready_at: string | null;
  is_rush_order: boolean | null;
  production_discount_pct: number | null;
  production_total_cost: number | null;
};

const formatReadyTime = (readyAt: string | null) => {
  if (!readyAt) return "Ready time pending";
  const ready = new Date(readyAt);
  const diffMs = ready.getTime() - Date.now();
  if (diffMs <= 0) return "Completing shortly";

  const hours = Math.ceil(diffMs / (60 * 60 * 1000));
  if (hours < 24) return `About ${hours}h remaining`;
  const days = Math.ceil(hours / 24);
  return `About ${days} day${days === 1 ? "" : "s"} remaining`;
};

export const MerchManagerCard = ({ bandId }: MerchManagerCardProps) => {
  return (
    <VipGate feature="Merchandise Manager" description="Hire an NPC manager to automate restocking, optimize pricing, and reduce logistics fees.">
      <MerchManagerContent bandId={bandId} />
    </VipGate>
  );
};

const MerchManagerContent = ({ bandId }: { bandId: string }) => {
  const { manager, isLoading, logisticsRate, hireManager, isHiring, fireManager, isFiring, updateSettings } = useMerchManager(bandId);
  const [showSettings, setShowSettings] = useState(false);

  const { data: pendingProduction = [], isLoading: loadingProduction } = useQuery<PendingProduction[]>({
    queryKey: ["merch-manager-production", bandId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("player_merchandise")
        .select("id, design_name, item_type, pending_quantity, production_ready_at, is_rush_order, production_discount_pct, production_total_cost")
        .eq("band_id", bandId)
        .gt("pending_quantity", 0)
        .in("production_status", ["ordered", "in_production"])
        .order("production_ready_at", { ascending: true });
      if (error) throw error;
      return (data || []) as PendingProduction[];
    },
    enabled: !!bandId,
    refetchInterval: 60 * 1000,
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!manager) {
    return (
      <Card className="border-amber-500/30 bg-gradient-to-br from-amber-500/5 to-transparent">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Crown className="h-5 w-5 text-amber-500" />
            Hire a Merch Manager
          </CardTitle>
          <CardDescription>
            A dedicated manager automatically places supplier restock orders, reduces logistics fees from 5% to 3%, and keeps your merch operation moving. Production still uses normal lead times and band funds.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-lg bg-muted/50 p-3 text-sm space-y-1">
            <div className="flex justify-between"><span>Monthly salary:</span><span className="font-medium">$2,000/month</span></div>
            <div className="flex justify-between"><span>Logistics discount:</span><span className="font-medium text-green-500">5% → 3%</span></div>
            <div className="flex justify-between"><span>Auto-restock:</span><span className="font-medium">Hourly stock checks</span></div>
          </div>
          <Button onClick={() => hireManager()} disabled={isHiring} className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-black font-semibold">
            {isHiring ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Hiring...</> : <><UserCheck className="h-4 w-4 mr-2" />Hire Manager — $2,000/mo</>}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="border-amber-500/30">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <UserCheck className="h-5 w-5 text-green-500" />
              {manager.manager_name}
            </CardTitle>
            <Badge variant="outline" className="text-green-500 border-green-500/30">Active</Badge>
          </div>
          <CardDescription>
            Merch Manager · Hired {new Date(manager.hired_at).toLocaleDateString()}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg bg-muted/50 p-2">
              <p className="text-xs text-muted-foreground">Salary</p>
              <p className="font-medium">${manager.monthly_salary.toLocaleString()}/mo</p>
            </div>
            <div className="rounded-lg bg-muted/50 p-2">
              <p className="text-xs text-muted-foreground">Logistics Rate</p>
              <p className="font-medium text-green-500">{(logisticsRate * 100).toFixed(0)}%</p>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="auto-restock" className="text-sm">Auto-Restock</Label>
              <p className="text-xs text-muted-foreground">Checks hourly. Existing pending orders prevent duplicate restocks.</p>
            </div>
            <Switch
              id="auto-restock"
              checked={manager.auto_restock_enabled}
              onCheckedChange={(checked) => updateSettings({ auto_restock_enabled: checked })}
            />
          </div>

          {manager.auto_restock_enabled && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Threshold</Label>
                <Input
                  type="number"
                  min={1}
                  value={manager.restock_threshold}
                  onChange={(e) => updateSettings({ restock_threshold: parseInt(e.target.value) || 10 })}
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Order Qty</Label>
                <Input
                  type="number"
                  min={1}
                  value={manager.restock_quantity}
                  onChange={(e) => updateSettings({ restock_quantity: parseInt(e.target.value) || 50 })}
                  className="h-8 text-sm"
                />
                <p className="text-[10px] text-muted-foreground">Raised automatically to the product MOQ when needed.</p>
              </div>
            </div>
          )}

          <Button variant="destructive" size="sm" onClick={() => fireManager()} disabled={isFiring} className="w-full">
            {isFiring ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Firing...</> : <><UserX className="h-4 w-4 mr-2" />Fire Manager</>}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Package className="h-4 w-4" /> Production Pipeline
          </CardTitle>
          <CardDescription>
            Supplier orders currently being manufactured. Completed runs move into sellable stock automatically.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {loadingProduction ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading production orders…
            </div>
          ) : pendingProduction.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing is currently in production.</p>
          ) : (
            pendingProduction.map((order) => (
              <div key={order.id} className="rounded-lg border bg-muted/30 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-sm">{order.design_name || order.item_type || "Merchandise"}</p>
                    <p className="text-xs text-muted-foreground">{(order.pending_quantity || 0).toLocaleString()} units in production</p>
                  </div>
                  <div className="flex flex-wrap justify-end gap-1">
                    {order.is_rush_order ? (
                      <Badge variant="secondary" className="gap-1"><Zap className="h-3 w-3" /> Rush</Badge>
                    ) : null}
                    {(order.production_discount_pct || 0) > 0 ? (
                      <Badge variant="outline">{Math.round((order.production_discount_pct || 0) * 100)}% bulk</Badge>
                    ) : null}
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Clock3 className="h-3 w-3" /> {formatReadyTime(order.production_ready_at)}</span>
                  <span>${Number(order.production_total_cost || 0).toLocaleString()} production cost</span>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
};
