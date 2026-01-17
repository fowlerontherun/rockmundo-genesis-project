import { useState } from "react";
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

const VEHICLE_TYPES = [
  { value: 'van', label: 'Cargo Van', capacity: 80, cost: 15000 },
  { value: 'sprinter', label: 'Sprinter Van', capacity: 120, cost: 35000 },
  { value: 'box_truck', label: 'Box Truck', capacity: 200, cost: 45000 },
  { value: 'semi', label: 'Semi-Trailer', capacity: 500, cost: 120000 },
  { value: 'flatbed', label: 'Flatbed Truck', capacity: 400, cost: 80000 },
];

const STATUS_COLORS: Record<string, string> = {
  available: 'bg-success/10 text-success',
  in_transit: 'bg-warning/10 text-warning',
  maintenance: 'bg-info/10 text-info',
  retired: 'bg-destructive/10 text-destructive',
};

export function LogisticsFleetManager({ logisticsCompanyId, fleetCapacity }: LogisticsFleetManagerProps) {
  const { data: fleet = [], isLoading } = useLogisticsFleet(logisticsCompanyId);
  const addVehicle = useAddFleetVehicle();

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newVehicle, setNewVehicle] = useState({
    name: '',
    vehicle_type: 'van',
  });

  const handleAddVehicle = async () => {
    if (!newVehicle.name) {
      toast.error("Please enter a vehicle name");
      return;
    }

    const vehicleConfig = VEHICLE_TYPES.find(v => v.value === newVehicle.vehicle_type);

    try {
      await addVehicle.mutateAsync({
        logistics_company_id: logisticsCompanyId,
        name: newVehicle.name,
        vehicle_type: newVehicle.vehicle_type,
        capacity_units: vehicleConfig?.capacity || 100,
        purchase_cost: vehicleConfig?.cost || 15000,
        purchase_date: new Date().toISOString(),
        condition_percent: 100,
        status: 'available',
      });
      toast.success("Vehicle added to fleet!");
      setIsAddDialogOpen(false);
      setNewVehicle({ name: '', vehicle_type: 'van' });
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
                    onChange={(e) => setNewVehicle({ ...newVehicle, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Vehicle Type</Label>
                  <Select
                    value={newVehicle.vehicle_type}
                    onValueChange={(value) => setNewVehicle({ ...newVehicle, vehicle_type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {VEHICLE_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          <div className="flex justify-between items-center w-full gap-4">
                            <span>{type.label}</span>
                            <span className="text-muted-foreground text-xs">
                              {type.capacity} units • ${type.cost.toLocaleString()}
                            </span>
                          </div>
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
