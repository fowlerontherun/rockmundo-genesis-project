import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Car, Bike, DollarSign, Gauge, CalendarDays } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

type VehicleCategory = "car" | "motorbike";

interface PersonalVehicleCatalogItem {
  id: string;
  name: string;
  category: VehicleCategory;
  description: string;
  topSpeedKmh: number;
  upkeepDaily: number;
  price: number;
}

interface OwnedPersonalVehicle extends PersonalVehicleCatalogItem {
  purchasePrice: number;
  purchasedAt: string;
}

const VEHICLE_CATALOG: PersonalVehicleCatalogItem[] = [
  { id: "city-scooter", name: "City Scooter 125", category: "motorbike", description: "Cheap and reliable for quick trips around town.", topSpeedKmh: 95, upkeepDaily: 14, price: 1800 },
  { id: "street-racer", name: "Street Racer 650", category: "motorbike", description: "Fast street bike with sharp handling and style.", topSpeedKmh: 210, upkeepDaily: 48, price: 16500 },
  { id: "vintage-cruiser", name: "Vintage Cruiser", category: "motorbike", description: "Classic motorbike that turns heads everywhere.", topSpeedKmh: 165, upkeepDaily: 35, price: 9800 },
  { id: "compact-hatch", name: "Compact Hatchback", category: "car", description: "A practical car for city life and short touring hops.", topSpeedKmh: 170, upkeepDaily: 30, price: 7500 },
  { id: "luxury-sedan", name: "Luxury Sedan", category: "car", description: "Comfortable premium ride for image and long travel.", topSpeedKmh: 245, upkeepDaily: 120, price: 62500 },
  { id: "supercar-x", name: "Supercar X", category: "car", description: "Top-tier status symbol with brutal acceleration.", topSpeedKmh: 340, upkeepDaily: 280, price: 240000 },
];

const PROFILE_QUERY_FIELDS = "cash, weekly_bonus_metadata";

export default function PersonalVehicles() {
  const { profileId } = useActiveProfile();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [categoryFilter, setCategoryFilter] = useState<VehicleCategory | "all">("all");

  const { data: profile } = useQuery({
    queryKey: ["personal-vehicles-profile", profileId],
    queryFn: async () => {
      if (!profileId) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select(PROFILE_QUERY_FIELDS)
        .eq("id", profileId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!profileId,
  });

  const ownedVehicles = useMemo(() => {
    const metadata = profile?.weekly_bonus_metadata as Record<string, unknown> | null | undefined;
    const raw = metadata?.personal_vehicles;
    return Array.isArray(raw) ? (raw as OwnedPersonalVehicle[]) : [];
  }, [profile?.weekly_bonus_metadata]);

  const buyVehicle = useMutation({
    mutationFn: async (vehicle: PersonalVehicleCatalogItem) => {
      if (!user) throw new Error("Not authenticated");
      const { data: currentProfile, error: profileError } = await supabase
        .from("profiles")
        .select(PROFILE_QUERY_FIELDS)
        .eq("user_id", user.id)
        .single();
      if (profileError) throw profileError;

      const cash = currentProfile.cash ?? 0;
      if (cash < vehicle.price) throw new Error("Not enough cash for this vehicle");

      const metadata = (currentProfile.weekly_bonus_metadata as Record<string, unknown> | null) ?? {};
      const existingVehicles = Array.isArray(metadata.personal_vehicles)
        ? (metadata.personal_vehicles as OwnedPersonalVehicle[])
        : [];

      if (existingVehicles.some((v) => v.id === vehicle.id)) {
        throw new Error("You already own this model");
      }

      const updatedVehicles: OwnedPersonalVehicle[] = [
        ...existingVehicles,
        {
          ...vehicle,
          purchasePrice: vehicle.price,
          purchasedAt: new Date().toISOString(),
        },
      ];

      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          cash: cash - vehicle.price,
          weekly_bonus_metadata: { ...metadata, personal_vehicles: updatedVehicles } as any,
        })
        .eq("user_id", user.id);

      if (updateError) throw updateError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["personal-vehicles-profile"] });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast({ title: "Vehicle Purchased", description: "Your new vehicle has been added to your garage." });
    },
    onError: (error: Error) => {
      toast({ title: "Purchase Failed", description: error.message, variant: "destructive" });
    },
  });

  const sellVehicle = useMutation({
    mutationFn: async (vehicleId: string) => {
      if (!user) throw new Error("Not authenticated");
      const { data: currentProfile, error: profileError } = await supabase
        .from("profiles")
        .select(PROFILE_QUERY_FIELDS)
        .eq("user_id", user.id)
        .single();
      if (profileError) throw profileError;

      const metadata = (currentProfile.weekly_bonus_metadata as Record<string, unknown> | null) ?? {};
      const existingVehicles = Array.isArray(metadata.personal_vehicles)
        ? (metadata.personal_vehicles as OwnedPersonalVehicle[])
        : [];
      const vehicle = existingVehicles.find((v) => v.id === vehicleId);
      if (!vehicle) throw new Error("Vehicle not found in your garage");

      const sellPrice = Math.round(vehicle.purchasePrice * 0.7);
      const updatedVehicles = existingVehicles.filter((v) => v.id !== vehicleId);

      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          cash: (currentProfile.cash ?? 0) + sellPrice,
          weekly_bonus_metadata: { ...metadata, personal_vehicles: updatedVehicles } as any,
        })
        .eq("user_id", user.id);

      if (updateError) throw updateError;
      return sellPrice;
    },
    onSuccess: (sellPrice) => {
      queryClient.invalidateQueries({ queryKey: ["personal-vehicles-profile"] });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast({ title: "Vehicle Sold", description: `You received $${sellPrice.toLocaleString()}.` });
    },
    onError: (error: Error) => {
      toast({ title: "Sale Failed", description: error.message, variant: "destructive" });
    },
  });

  const filteredCatalog = VEHICLE_CATALOG.filter((vehicle) =>
    categoryFilter === "all" ? true : vehicle.category === categoryFilter,
  );
  const ownedIds = new Set(ownedVehicles.map((vehicle) => vehicle.id));

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold">Cars & Motorbikes</h1>
        <p className="text-muted-foreground">Buy and sell personal vehicles, just like housing ownership.</p>
        <div className="inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm">
          <DollarSign className="h-4 w-4" />
          <span>Cash: ${Number(profile?.cash ?? 0).toLocaleString()}</span>
        </div>
      </header>

      <Tabs defaultValue="market" className="space-y-4">
        <TabsList>
          <TabsTrigger value="market">Vehicle Market</TabsTrigger>
          <TabsTrigger value="garage">My Garage ({ownedVehicles.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="market" className="space-y-4">
          <div className="flex gap-2">
            <Button variant={categoryFilter === "all" ? "default" : "outline"} size="sm" onClick={() => setCategoryFilter("all")}>All</Button>
            <Button variant={categoryFilter === "car" ? "default" : "outline"} size="sm" onClick={() => setCategoryFilter("car")}>Cars</Button>
            <Button variant={categoryFilter === "motorbike" ? "default" : "outline"} size="sm" onClick={() => setCategoryFilter("motorbike")}>Motorbikes</Button>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredCatalog.map((vehicle) => {
              const owned = ownedIds.has(vehicle.id);
              const Icon = vehicle.category === "car" ? Car : Bike;
              return (
                <Card key={vehicle.id}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Icon className="h-5 w-5" />
                      {vehicle.name}
                    </CardTitle>
                    <CardDescription>{vehicle.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Type</span>
                      <Badge variant="secondary" className="capitalize">{vehicle.category}</Badge>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground flex items-center gap-1"><Gauge className="h-4 w-4" />Top speed</span>
                      <span>{vehicle.topSpeedKmh} km/h</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Daily upkeep</span>
                      <span>${vehicle.upkeepDaily.toLocaleString()}</span>
                    </div>
                    <div className="pt-2 flex items-center justify-between">
                      <span className="font-semibold">${vehicle.price.toLocaleString()}</span>
                      <Button disabled={owned || buyVehicle.isPending} onClick={() => buyVehicle.mutate(vehicle)}>
                        {owned ? "Owned" : "Buy"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="garage" className="space-y-4">
          {ownedVehicles.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground">
                You don't own any vehicles yet.
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {ownedVehicles.map((vehicle) => {
                const Icon = vehicle.category === "car" ? Car : Bike;
                const sellPrice = Math.round(vehicle.purchasePrice * 0.7);
                return (
                  <Card key={`${vehicle.id}-${vehicle.purchasedAt}`}>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <Icon className="h-5 w-5" />
                        {vehicle.name}
                      </CardTitle>
                      <CardDescription className="flex items-center gap-1">
                        <CalendarDays className="h-4 w-4" />
                        Bought {new Date(vehicle.purchasedAt).toLocaleDateString()}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Bought for</span>
                        <span>${vehicle.purchasePrice.toLocaleString()}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Sell now</span>
                        <span>${sellPrice.toLocaleString()}</span>
                      </div>
                      <Button variant="outline" className="w-full" disabled={sellVehicle.isPending} onClick={() => sellVehicle.mutate(vehicle.id)}>
                        Sell Vehicle
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
