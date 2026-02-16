import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Crown, UserCheck, UserX, Settings2, Loader2 } from "lucide-react";
import { VipGate } from "@/components/company/VipGate";
import { useMerchManager } from "@/hooks/useMerchManager";
import { useState } from "react";

interface MerchManagerCardProps {
  bandId: string;
}

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
            A dedicated manager automates restocking, reduces logistics fees from 5% to 3%, and keeps your merch operation running smoothly.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-lg bg-muted/50 p-3 text-sm space-y-1">
            <div className="flex justify-between"><span>Monthly salary:</span><span className="font-medium">$2,000/month</span></div>
            <div className="flex justify-between"><span>Logistics discount:</span><span className="font-medium text-green-500">5% → 3%</span></div>
            <div className="flex justify-between"><span>Auto-restock:</span><span className="font-medium">Enabled</span></div>
          </div>
          <Button onClick={() => hireManager()} disabled={isHiring} className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-black font-semibold">
            {isHiring ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Hiring...</> : <><UserCheck className="h-4 w-4 mr-2" />Hire Manager — $2,000/mo</>}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
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
          <Label htmlFor="auto-restock" className="text-sm">Auto-Restock</Label>
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
                min={10}
                value={manager.restock_quantity}
                onChange={(e) => updateSettings({ restock_quantity: parseInt(e.target.value) || 50 })}
                className="h-8 text-sm"
              />
            </div>
          </div>
        )}

        <Button variant="destructive" size="sm" onClick={() => fireManager()} disabled={isFiring} className="w-full">
          {isFiring ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Firing...</> : <><UserX className="h-4 w-4 mr-2" />Fire Manager</>}
        </Button>
      </CardContent>
    </Card>
  );
};
