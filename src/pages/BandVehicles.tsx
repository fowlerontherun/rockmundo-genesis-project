import { useState, useContext } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AuthContext } from "@/hooks/use-auth-context";
import { toast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Truck,
  Bus,
  Car,
  Package,
  DollarSign,
  Gauge,
  Users,
  Wrench,
  ShoppingCart,
  Calendar,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";

interface VehicleCatalogItem {
  id: string;
  name: string;
  vehicle_type: string;
  capacity_units: number;
  purchase_cost: number;
  rental_daily_cost: number;
  lease_monthly_cost: number;
  comfort_rating: number;
  speed_modifier: number;
  fuel_cost_per_km: number;
  description: string;
}

interface BandVehicle {
  id: string;
  band_id: string;
  name: string;
  vehicle_type: string;
  capacity_units: number;
  condition_percent: number;
  is_owned: boolean;
  is_leased: boolean;
  lease_payments_made: number;
  lease_payments_total: number;
  comfort_rating: number;
  total_km_traveled: number;
  breakdown_risk: number;
}

const VEHICLE_ICONS: Record<string, typeof Car> = {
  van: Car,
  sprinter: Car,
  tour_bus: Bus,
  sleeper_bus: Bus,
  truck: Truck,
};

export default function BandVehicles() {
  const { user } = useContext(AuthContext);
  const queryClient = useQueryClient();
  const [selectedVehicle, setSelectedVehicle] = useState<VehicleCatalogItem | null>(null);
  const [purchaseType, setPurchaseType] = useState<"buy" | "rent" | "lease">("buy");
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);

  // Fetch user's band
  const { data: band } = useQuery({
    queryKey: ["user-band", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data: membership } = await supabase
        .from("band_members")
        .select("band_id")
        .eq("user_id", user.id)
        .limit(1)
        .single();
      
      if (!membership?.band_id) return null;
      
      const { data: bandData } = await supabase
        .from("bands")
        .select("id, name, band_balance, leader_id")
        .eq("id", membership.band_id)
        .single();
      
      return bandData || null;
    },
    enabled: !!user,
  });

  // Fetch vehicle catalog
  const { data: catalog = [] } = useQuery({
    queryKey: ["vehicle-catalog"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vehicle_catalog")
        .select("*")
        .order("purchase_cost", { ascending: true });
      if (error) throw error;
      return data as VehicleCatalogItem[];
    },
  });

  // Fetch band's vehicles
  const { data: bandVehicles = [] } = useQuery({
    queryKey: ["band-vehicles", band?.id],
    queryFn: async () => {
      if (!band?.id) return [];
      const { data, error } = await supabase
        .from("band_vehicles")
        .select("*")
        .eq("band_id", band.id);
      if (error) throw error;
      return data as BandVehicle[];
    },
    enabled: !!band?.id,
  });

  // Fetch band's equipment total size
  const { data: equipmentSize = 0 } = useQuery({
    queryKey: ["band-equipment-size", band?.id],
    queryFn: async () => {
      if (!band?.id) return 0;
      const { data, error } = await supabase
        .from("band_stage_equipment")
        .select("size_units")
        .eq("band_id", band.id);
      if (error) throw error;
      return data.reduce((sum, item) => sum + (item.size_units || 10), 0);
    },
    enabled: !!band?.id,
  });

  const purchaseVehicleMutation = useMutation({
    mutationFn: async ({
      vehicleId,
      type,
    }: {
      vehicleId: string;
      type: "buy" | "rent" | "lease";
    }) => {
      if (!band?.id || !user) throw new Error("No band found");

      const vehicle = catalog.find((v) => v.id === vehicleId);
      if (!vehicle) throw new Error("Vehicle not found");

      const cost =
        type === "buy"
          ? vehicle.purchase_cost
          : type === "lease"
          ? vehicle.lease_monthly_cost
          : vehicle.rental_daily_cost * 7; // 1 week rental

      if ((band.band_balance || 0) < cost) {
        throw new Error(`Insufficient funds. Need $${cost.toLocaleString()}`);
      }

      // Deduct cost from band balance
      const { error: balanceError } = await supabase
        .from("bands")
        .update({ band_balance: (band.band_balance || 0) - cost })
        .eq("id", band.id);

      if (balanceError) throw balanceError;

      // Create vehicle record
      const { error: vehicleError } = await supabase.from("band_vehicles").insert({
        band_id: band.id,
        vehicle_catalog_id: vehicleId,
        name: vehicle.name,
        vehicle_type: vehicle.vehicle_type,
        capacity_units: vehicle.capacity_units,
        is_owned: type === "buy",
        is_leased: type === "lease",
        comfort_rating: vehicle.comfort_rating,
        speed_modifier: vehicle.speed_modifier,
        rental_daily_cost: type === "rent" ? vehicle.rental_daily_cost : 0,
        rental_start_date: type === "rent" ? new Date().toISOString() : null,
        rental_end_date:
          type === "rent"
            ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
            : null,
        purchase_date: type === "buy" ? new Date().toISOString() : null,
      });

      if (vehicleError) throw vehicleError;

      return { cost, type };
    },
    onSuccess: ({ cost, type }) => {
      toast({
        title: "Vehicle Acquired!",
        description: `You ${type === "buy" ? "purchased" : type === "lease" ? "leased" : "rented"} the vehicle for $${cost.toLocaleString()}`,
      });
      queryClient.invalidateQueries({ queryKey: ["band-vehicles"] });
      queryClient.invalidateQueries({ queryKey: ["user-band"] });
      setConfirmDialogOpen(false);
      setSelectedVehicle(null);
    },
    onError: (error) => {
      toast({
        title: "Transaction Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const totalCapacity = bandVehicles.reduce((sum, v) => sum + v.capacity_units, 0);
  const hasCapacityIssue = equipmentSize > totalCapacity && bandVehicles.length > 0;

  const getVehicleIcon = (type: string) => {
    const Icon = VEHICLE_ICONS[type] || Car;
    return <Icon className="h-5 w-5" />;
  };

  const getConditionColor = (percent: number) => {
    if (percent >= 75) return "text-green-500";
    if (percent >= 50) return "text-yellow-500";
    if (percent >= 25) return "text-orange-500";
    return "text-red-500";
  };

  if (!band) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>No Band Found</AlertTitle>
          <AlertDescription>
            You need to be in a band to manage vehicles. Create or join a band first.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Band Vehicles</h1>
        <p className="text-muted-foreground">
          Manage your band's transportation for tours and gigs
        </p>
      </header>

      {/* Capacity Overview */}
      <Card className={hasCapacityIssue ? "border-destructive" : ""}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Equipment Capacity
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-between text-sm">
            <span>Equipment Size: {equipmentSize} units</span>
            <span>Vehicle Capacity: {totalCapacity} units</span>
          </div>
          <Progress
            value={totalCapacity > 0 ? Math.min(100, (equipmentSize / totalCapacity) * 100) : 0}
            className={hasCapacityIssue ? "bg-destructive/20" : ""}
          />
          {hasCapacityIssue && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Capacity Exceeded</AlertTitle>
              <AlertDescription>
                Your equipment ({equipmentSize} units) exceeds your vehicle capacity ({totalCapacity}{" "}
                units). You need to rent or buy additional vehicles for tours.
              </AlertDescription>
            </Alert>
          )}
          {bandVehicles.length === 0 && (
            <Alert>
              <Truck className="h-4 w-4" />
              <AlertTitle>No Vehicles</AlertTitle>
              <AlertDescription>
                You don't have any vehicles yet. Browse the catalog below to get started.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="owned">
        <TabsList>
          <TabsTrigger value="owned">
            <CheckCircle2 className="h-4 w-4 mr-2" />
            Your Vehicles ({bandVehicles.length})
          </TabsTrigger>
          <TabsTrigger value="catalog">
            <ShoppingCart className="h-4 w-4 mr-2" />
            Vehicle Catalog
          </TabsTrigger>
        </TabsList>

        <TabsContent value="owned" className="space-y-4">
          {bandVehicles.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Truck className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No vehicles yet. Check out the catalog!</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {bandVehicles.map((vehicle) => (
                <Card key={vehicle.id}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      {getVehicleIcon(vehicle.vehicle_type)}
                      {vehicle.name}
                    </CardTitle>
                    <CardDescription className="flex gap-2">
                      {vehicle.is_owned && <Badge variant="default">Owned</Badge>}
                      {vehicle.is_leased && (
                        <Badge variant="secondary">
                          Leased ({vehicle.lease_payments_made}/{vehicle.lease_payments_total})
                        </Badge>
                      )}
                      {!vehicle.is_owned && !vehicle.is_leased && (
                        <Badge variant="outline">Rented</Badge>
                      )}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <Package className="h-4 w-4 text-muted-foreground" />
                        <span>{vehicle.capacity_units} units</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span>{vehicle.comfort_rating}% comfort</span>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span>Condition</span>
                        <span className={getConditionColor(vehicle.condition_percent)}>
                          {vehicle.condition_percent}%
                        </span>
                      </div>
                      <Progress value={vehicle.condition_percent} />
                    </div>

                    {vehicle.breakdown_risk > 0.1 && (
                      <Alert variant="destructive">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>
                          High breakdown risk ({Math.round(vehicle.breakdown_risk * 100)}%). Schedule
                          maintenance!
                        </AlertDescription>
                      </Alert>
                    )}

                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="flex-1">
                        <Wrench className="h-4 w-4 mr-1" />
                        Maintain
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="catalog" className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">
              Band Balance: <span className="font-bold">${(band.band_balance || 0).toLocaleString()}</span>
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {catalog.map((vehicle) => (
              <Card key={vehicle.id} className="flex flex-col">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    {getVehicleIcon(vehicle.vehicle_type)}
                    {vehicle.name}
                  </CardTitle>
                  <CardDescription>{vehicle.description}</CardDescription>
                </CardHeader>
                <CardContent className="flex-1 space-y-4">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="flex items-center gap-1">
                      <Package className="h-3 w-3 text-muted-foreground" />
                      <span>{vehicle.capacity_units} units</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Users className="h-3 w-3 text-muted-foreground" />
                      <span>{vehicle.comfort_rating}% comfort</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Gauge className="h-3 w-3 text-muted-foreground" />
                      <span>{vehicle.speed_modifier}x speed</span>
                    </div>
                  </div>

                  <div className="space-y-2 pt-2 border-t">
                    <div className="flex justify-between text-sm">
                      <span>Buy</span>
                      <span className="font-bold">${vehicle.purchase_cost.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Lease</span>
                      <span>${vehicle.lease_monthly_cost.toLocaleString()}/mo</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Rent</span>
                      <span>${vehicle.rental_daily_cost.toLocaleString()}/day</span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="flex-1"
                      onClick={() => {
                        setSelectedVehicle(vehicle);
                        setPurchaseType("buy");
                        setConfirmDialogOpen(true);
                      }}
                      disabled={(band.band_balance || 0) < vehicle.purchase_cost}
                    >
                      Buy
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      onClick={() => {
                        setSelectedVehicle(vehicle);
                        setPurchaseType("rent");
                        setConfirmDialogOpen(true);
                      }}
                      disabled={(band.band_balance || 0) < vehicle.rental_daily_cost * 7}
                    >
                      Rent
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Confirm Purchase Dialog */}
      <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm {purchaseType === "buy" ? "Purchase" : purchaseType === "lease" ? "Lease" : "Rental"}</DialogTitle>
            <DialogDescription>
              {selectedVehicle && (
                <>
                  You are about to {purchaseType === "buy" ? "purchase" : purchaseType === "lease" ? "lease" : "rent"}{" "}
                  <strong>{selectedVehicle.name}</strong>.
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          {selectedVehicle && (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg space-y-2">
                <div className="flex justify-between">
                  <span>Vehicle</span>
                  <span className="font-semibold">{selectedVehicle.name}</span>
                </div>
                <div className="flex justify-between">
                  <span>Capacity</span>
                  <span>{selectedVehicle.capacity_units} units</span>
                </div>
                <div className="flex justify-between">
                  <span>Cost</span>
                  <span className="font-bold text-primary">
                    $
                    {(purchaseType === "buy"
                      ? selectedVehicle.purchase_cost
                      : purchaseType === "lease"
                      ? selectedVehicle.lease_monthly_cost
                      : selectedVehicle.rental_daily_cost * 7
                    ).toLocaleString()}
                    {purchaseType === "rent" && " (7 days)"}
                  </span>
                </div>
                <div className="flex justify-between text-muted-foreground text-sm">
                  <span>Band Balance After</span>
                  <span>
                    $
                    {(
                      (band.band_balance || 0) -
                      (purchaseType === "buy"
                        ? selectedVehicle.purchase_cost
                        : purchaseType === "lease"
                        ? selectedVehicle.lease_monthly_cost
                        : selectedVehicle.rental_daily_cost * 7)
                    ).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (selectedVehicle) {
                  purchaseVehicleMutation.mutate({
                    vehicleId: selectedVehicle.id,
                    type: purchaseType,
                  });
                }
              }}
              disabled={purchaseVehicleMutation.isPending}
            >
              {purchaseVehicleMutation.isPending ? "Processing..." : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
