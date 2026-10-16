import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Truck, Plus, Wrench, MapPin, Fuel, AlertTriangle } from "lucide-react";
import { useLogisticsFleet, useAddFleetVehicle } from "@/hooks/useLogisticsBusiness";
import type { LogisticsFleetVehicle } from "@/types/logistics-business";
import { toast } from "sonner";

interface LogisticsFleetManagerProps {
  logisticsCompanyId: string;
  fleetCapacity: number;
}

const STATUS_COLORS: Record<string, string> = {
  available: 'bg-success/10 text-success',
  in_transit: 'bg-warning/10 text-warning',
  maintenance: 'bg-info/10 text-info',
  retired: 'bg-destructive/10 text-destructive',
};

export function LogisticsFleetManager({ logisticsCompanyId, fleetCapacity }: LogisticsFleetManagerProps) {
  const { data: fleet = [], isLoading } = useLogisticsFleet(logisticsCompanyId);
  const addVehicle = useAddFleetVehicle();
  const { data: vehicleCatalog = [] } = useQuery({
    queryKey: ["logistics-vehicle-catalog"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vehicle_catalog")
        .select("id, name, vehicle_type, capacity_units, purchase_cost")
        .gt("purchase_cost", 0)
        .order("purchase_cost");
      if (error) throw error;
      return data ?? [];
    },
  });

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newVehicle, setNewVehicle] = useState({ name: "", vehicle_catalog_id: "" });
  const [pendingPurchaseRequestId, setPendingPurchaseRequestId] = useState<string | null>(null);

  const handleAddVehicle = async () => {
    if (!newVehicle.name.trim() || !newVehicle.vehicle_catalog_id) {
      toast.error("Please enter a name and select a catalog vehicle");
      return;
    }
    const requestId = pendingPurchaseRequestId ?? crypto.randomUUID();
    setPendingPurchaseRequestId(requestId);

    try {
      await addVehicle.mutateAsync({
        logistics_company_id: logisticsCompanyId,
        name: newVehicle.name.trim(),
        vehicle_catalog_id: newVehicle.vehicle_catalog_id,
        request_id: requestId,
      });
      toast.success("Vehicle added to fleet!");
      setIsAddDialogOpen(false);
      setNewVehicle({ name: "", vehicle_catalog_id: "" });
      setPendingPurchaseRequestId(null);
    } catch (error) {
      toast.error("Failed to add vehicle");
    }
  };

  const getMaintenanceStatus = (vehicle: LogisticsFleetVehicle) => {
    const kmSinceMaintenance = vehicle.total_km_traveled - vehicle.last_maintenance_km;
    if (kmSinceMaintenance > 10000) return 'overdue';
    if (kmSinceMaintenance > 8000) return 'due_soon';
    return 'good';
  };

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">Loading fleet...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5" />
              Fleet Vehicles
            </CardTitle>
            <CardDescription>
              {fleet.length} / {fleetCapacity} vehicles in fleet
            </CardDescription>
          </div>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" disabled={fleet.length >= fleetCapacity}>
                <Plus className="h-4 w-4 mr-1" />
                Add Vehicle
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Fleet Vehicle</DialogTitle>
                <DialogDescription>
                  Purchase a new vehicle for your logistics fleet.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Vehicle Name</Label>
                  <Input
                    id="name"
                    placeholder="e.g., Truck Alpha-1"
                    value={newVehicle.name}
                    onChange={(e) => { setNewVehicle({ ...newVehicle, name: e.target.value }); setPendingPurchaseRequestId(null); }}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Vehicle Catalog</Label>
                  <Select
                    value={newVehicle.vehicle_catalog_id}
                    onValueChange={(value) => { setNewVehicle({ ...newVehicle, vehicle_catalog_id: value }); setPendingPurchaseRequestId(null); }}
                  >
                    <SelectTrigger><SelectValue placeholder="Choose a vehicle" /></SelectTrigger>
                    <SelectContent>
                      {vehicleCatalog.map((vehicle) => (
                        <SelectItem key={vehicle.id} value={vehicle.id}>
                          {vehicle.name} — {vehicle.capacity_units} units · ${Number(vehicle.purchase_cost).toLocaleString()}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleAddVehicle} className="w-full" disabled={addVehicle.isPending}>
                  {addVehicle.isPending ? "Adding..." : "Purchase Vehicle"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {fleet.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Truck className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No vehicles in fleet yet</p>
            <p className="text-sm">Add vehicles to start taking contracts</p>
          </div>
        ) : (
          <div className="space-y-3">
            {fleet.map((vehicle) => {
              const maintenanceStatus = getMaintenanceStatus(vehicle);
              return (
                <div
                  key={vehicle.id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-card"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded bg-muted">
                      <Truck className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="font-medium">{vehicle.name}</p>
                      <p className="text-xs text-muted-foreground capitalize">
                        {vehicle.vehicle_type.replace('_', ' ')} • {vehicle.capacity_units} units
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {/* Condition */}
                    <div className="text-right text-sm">
                      <p className="text-muted-foreground">Condition</p>
                      <Progress value={vehicle.condition_percent} className="h-1.5 w-16" />
                    </div>
                    {/* Maintenance Warning */}
                    {maintenanceStatus !== 'good' && (
                      <div className={`p-1 rounded ${maintenanceStatus === 'overdue' ? 'bg-destructive/10' : 'bg-warning/10'}`}>
                        <Wrench className={`h-4 w-4 ${maintenanceStatus === 'overdue' ? 'text-destructive' : 'text-warning'}`} />
                      </div>
                    )}
                    {/* Status Badge */}
                    <Badge className={STATUS_COLORS[vehicle.status] || ''}>
                      {vehicle.status.replace('_', ' ')}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
