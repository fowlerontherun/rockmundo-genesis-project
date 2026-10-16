import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { User, Plus, Star, Truck, AlertTriangle } from "lucide-react";
import { useLogisticsDrivers, useHireDriver } from "@/hooks/useLogisticsBusiness";
import { toast } from "sonner";

interface LogisticsDriversManagerProps {
  logisticsCompanyId: string;
}

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-success/10 text-success',
  on_trip: 'bg-warning/10 text-warning',
  off_duty: 'bg-muted text-muted-foreground',
  terminated: 'bg-destructive/10 text-destructive',
};

export function LogisticsDriversManager({ logisticsCompanyId }: LogisticsDriversManagerProps) {
  const { data: drivers = [], isLoading } = useLogisticsDrivers(logisticsCompanyId);
  const hireDriver = useHireDriver();

  const [isHireDialogOpen, setIsHireDialogOpen] = useState(false);
  const [newDriver, setNewDriver] = useState({ name: "" });
  const [pendingHireRequestId, setPendingHireRequestId] = useState<string | null>(null);

  const handleHireDriver = async () => {
    if (!newDriver.name) {
      toast.error("Please enter a driver name");
      return;
    }

    const requestId = pendingHireRequestId ?? crypto.randomUUID();
    setPendingHireRequestId(requestId);
    try {
      await hireDriver.mutateAsync({
        logistics_company_id: logisticsCompanyId,
        name: newDriver.name.trim(),
        request_id: requestId,
      });
      toast.success("Driver hired successfully!");
      setIsHireDialogOpen(false);
      setNewDriver({ name: "" });
      setPendingHireRequestId(null);
    } catch (error) {
      toast.error("Failed to hire driver");
    }
  };

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">Loading drivers...</div>;
  }

  const activeDrivers = drivers.filter(d => d.status !== 'terminated');

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Drivers
            </CardTitle>
            <CardDescription>
              {activeDrivers.length} active drivers
            </CardDescription>
          </div>
          <Dialog open={isHireDialogOpen} onOpenChange={setIsHireDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-1" />
                Hire Driver
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Hire New Driver</DialogTitle>
                <DialogDescription>
                  Add a professional driver to your logistics team.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="driverName">Driver Name</Label>
                  <Input
                    id="driverName"
                    placeholder="e.g., John Smith"
                    value={newDriver.name}
                    onChange={(e) => { setNewDriver({ name: e.target.value }); setPendingHireRequestId(null); }}
                  />
                </div>
                <p className="text-sm text-muted-foreground">
                  New NPC drivers start with a standard licence, skill 1 and a $150 daily salary.
                  The initial hiring charge is $4,500.
                </p>
                <Button onClick={handleHireDriver} className="w-full" disabled={hireDriver.isPending}>
                  {hireDriver.isPending ? "Hiring..." : "Hire Driver"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {drivers.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <User className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No drivers hired yet</p>
            <p className="text-sm">Hire drivers to operate your fleet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {drivers.map((driver) => (
              <div
                key={driver.id}
                className="flex items-center justify-between p-3 rounded-lg border bg-card"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-full bg-muted">
                    <User className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="font-medium">{driver.name}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="capitalize">{driver.license_type} License</span>
                      <span>•</span>
                      <span>{driver.experience_years} yrs exp</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {/* Stats */}
                  <div className="text-right text-sm hidden sm:block">
                    <div className="flex items-center gap-1 text-warning">
                      <Star className="h-3 w-3" />
                      <span>{driver.skill_level}/10</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {driver.total_trips_completed} trips
                    </p>
                  </div>
                  {/* Accidents Warning */}
                  {driver.accidents > 0 && (
                    <div className="p-1 rounded bg-destructive/10">
                      <AlertTriangle className="h-4 w-4 text-destructive" />
                    </div>
                  )}
                  {/* Status Badge */}
                  <Badge className={STATUS_COLORS[driver.status] || ''}>
                    {driver.status.replace('_', ' ')}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
