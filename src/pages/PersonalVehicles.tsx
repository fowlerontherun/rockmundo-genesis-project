import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Car, Bike, DollarSign, Gauge, CalendarDays, Shield } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

type VehicleCategory = "car" | "motorbike";

interface PersonalVehicleCatalogItem {
  id: string;
  name: string;
  category: VehicleCategory;
  description: string;
  topSpeedKmh: number;
  upkeepDaily: number;
  insuranceDaily: number;
  price: number;
  image: string;
}

interface OwnedPersonalVehicle extends PersonalVehicleCatalogItem {
  purchasePrice: number;
  purchasedAt: string;
}

const VEHICLE_CATALOG: PersonalVehicleCatalogItem[] = [
  // ── Motorbikes ──
  { id: "honda-pcx-125", name: "Honda PCX 125", category: "motorbike", description: "Reliable commuter scooter, perfect for city errands and saving on travel costs.", topSpeedKmh: 110, upkeepDaily: 8, insuranceDaily: 5, price: 3500, image: "/vehicles/honda-pcx-125.jpg" },
  { id: "kawasaki-ninja-400", name: "Kawasaki Ninja 400", category: "motorbike", description: "Lightweight sport bike with sharp handling — a great first performance ride.", topSpeedKmh: 191, upkeepDaily: 18, insuranceDaily: 12, price: 5800, image: "/vehicles/kawasaki-ninja-400.jpg" },
  { id: "triumph-bonneville", name: "Triumph Bonneville T120", category: "motorbike", description: "Timeless British classic with modern reliability. Turns heads at every gig.", topSpeedKmh: 177, upkeepDaily: 22, insuranceDaily: 15, price: 12500, image: "/vehicles/triumph-bonneville.jpg" },
  { id: "harley-street-bob", name: "Harley-Davidson Street Bob 114", category: "motorbike", description: "Iconic American cruiser with a thunderous 114 cubic inch Milwaukee-Eight engine.", topSpeedKmh: 177, upkeepDaily: 28, insuranceDaily: 20, price: 16500, image: "/vehicles/harley-street-bob.jpg" },
  { id: "ducati-panigale-v4", name: "Ducati Panigale V4", category: "motorbike", description: "Italian superbike masterpiece. 214 HP of pure race-bred adrenaline.", topSpeedKmh: 299, upkeepDaily: 45, insuranceDaily: 35, price: 28000, image: "/vehicles/ducati-panigale-v4.jpg" },

  // ── Cars ──
  { id: "vw-golf-gti", name: "Volkswagen Golf GTI", category: "car", description: "The definitive hot hatch. Practical, fun, and affordable to run.", topSpeedKmh: 250, upkeepDaily: 22, insuranceDaily: 18, price: 35000, image: "/vehicles/vw-golf-gti.jpg" },
  { id: "toyota-gr86", name: "Toyota GR86", category: "car", description: "Lightweight rear-wheel-drive sports coupe. Pure driving joy on a budget.", topSpeedKmh: 226, upkeepDaily: 20, insuranceDaily: 16, price: 30000, image: "/vehicles/toyota-gr86.jpg" },
  { id: "bmw-3-series", name: "BMW 3 Series", category: "car", description: "The benchmark sports sedan. Refined luxury meets spirited driving dynamics.", topSpeedKmh: 250, upkeepDaily: 35, insuranceDaily: 28, price: 48000, image: "/vehicles/bmw-3-series.jpg" },
  { id: "mercedes-amg-c63", name: "Mercedes-AMG C63", category: "car", description: "Hand-built AMG bi-turbo V8 power in a sleek sedan. 503 HP of authority.", topSpeedKmh: 290, upkeepDaily: 55, insuranceDaily: 45, price: 82000, image: "/vehicles/mercedes-amg-c63.jpg" },
  { id: "range-rover-sport", name: "Range Rover Sport", category: "car", description: "Commanding luxury SUV. Arrive at any venue with rockstar presence.", topSpeedKmh: 242, upkeepDaily: 65, insuranceDaily: 50, price: 95000, image: "/vehicles/range-rover-sport.jpg" },
  { id: "porsche-911", name: "Porsche 911 Carrera", category: "car", description: "The iconic sports car. Six decades of engineering excellence in every curve.", topSpeedKmh: 308, upkeepDaily: 75, insuranceDaily: 60, price: 120000, image: "/vehicles/porsche-911.jpg" },
  { id: "lamborghini-huracan", name: "Lamborghini Huracán EVO", category: "car", description: "V10 supercar with 640 HP. The ultimate rockstar statement vehicle.", topSpeedKmh: 325, upkeepDaily: 150, insuranceDaily: 120, price: 280000, image: "/vehicles/lamborghini-huracan.jpg" },
  { id: "rolls-royce-ghost", name: "Rolls-Royce Ghost", category: "car", description: "The pinnacle of automotive luxury. A moving sanctuary of opulence.", topSpeedKmh: 250, upkeepDaily: 180, insuranceDaily: 140, price: 350000, image: "/vehicles/rolls-royce-ghost.jpg" },
  { id: "bugatti-chiron", name: "Bugatti Chiron", category: "car", description: "1,500 HP W16 quad-turbo hypercar. The ultimate status symbol — if you can afford it.", topSpeedKmh: 420, upkeepDaily: 500, insuranceDaily: 380, price: 3200000, image: "/vehicles/bugatti-chiron.jpg" },
];

const CATEGORY_IMAGES: Record<VehicleCategory, string> = {
  car: "/vehicles/category-cars.jpg",
  motorbike: "/vehicles/category-motorbikes.jpg",
};

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
      if (!profileId) throw new Error("No active character");
      const { data: currentProfile, error: profileError } = await supabase
        .from("profiles")
        .select(PROFILE_QUERY_FIELDS)
        .eq("id", profileId)
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
        .eq("id", profileId);

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
      if (!profileId) throw new Error("No active character");
      const { data: currentProfile, error: profileError } = await supabase
        .from("profiles")
        .select(PROFILE_QUERY_FIELDS)
        .eq("id", profileId)
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
        .eq("id", profileId);

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
        <p className="text-muted-foreground">Buy real vehicles with realistic pricing. Insurance is charged daily alongside upkeep.</p>
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

        <TabsContent value="market" className="space-y-6">
          {/* Category banners */}
          <div className="grid gap-4 md:grid-cols-2">
            {(["car", "motorbike"] as VehicleCategory[]).map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat === categoryFilter ? "all" : cat)}
                className={`relative overflow-hidden rounded-xl border-2 transition-all ${
                  categoryFilter === cat ? "border-primary ring-2 ring-primary/30" : "border-border hover:border-primary/50"
                }`}
              >
                <img
                  src={CATEGORY_IMAGES[cat]}
                  alt={cat === "car" ? "Cars" : "Motorbikes"}
                  className="h-32 w-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/40 to-transparent" />
                <div className="absolute bottom-3 left-4 flex items-center gap-2">
                  {cat === "car" ? <Car className="h-5 w-5 text-primary" /> : <Bike className="h-5 w-5 text-primary" />}
                  <span className="text-lg font-bold">{cat === "car" ? "Cars" : "Motorbikes"}</span>
                </div>
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            <Button variant={categoryFilter === "all" ? "default" : "outline"} size="sm" onClick={() => setCategoryFilter("all")}>All ({VEHICLE_CATALOG.length})</Button>
            <Button variant={categoryFilter === "car" ? "default" : "outline"} size="sm" onClick={() => setCategoryFilter("car")}>
              <Car className="h-4 w-4 mr-1" /> Cars ({VEHICLE_CATALOG.filter(v => v.category === "car").length})
            </Button>
            <Button variant={categoryFilter === "motorbike" ? "default" : "outline"} size="sm" onClick={() => setCategoryFilter("motorbike")}>
              <Bike className="h-4 w-4 mr-1" /> Motorbikes ({VEHICLE_CATALOG.filter(v => v.category === "motorbike").length})
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredCatalog.map((vehicle) => {
              const owned = ownedIds.has(vehicle.id);
              const Icon = vehicle.category === "car" ? Car : Bike;
              const totalDaily = vehicle.upkeepDaily + vehicle.insuranceDaily;
              return (
                <Card key={vehicle.id} className="overflow-hidden">
                  <div className="relative h-44 overflow-hidden">
                    <img
                      src={vehicle.image}
                      alt={vehicle.name}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                    <div className="absolute top-2 right-2">
                      <Badge variant="secondary" className="capitalize backdrop-blur-sm bg-background/70">
                        {vehicle.category}
                      </Badge>
                    </div>
                    {owned && (
                      <div className="absolute top-2 left-2">
                        <Badge className="bg-primary text-primary-foreground">Owned</Badge>
                      </div>
                    )}
                  </div>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Icon className="h-5 w-5 shrink-0" />
                      {vehicle.name}
                    </CardTitle>
                    <CardDescription>{vehicle.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="flex items-center gap-1.5">
                        <Gauge className="h-4 w-4 text-muted-foreground" />
                        <span>{vehicle.topSpeedKmh} km/h</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                        <span>${vehicle.upkeepDaily}/day upkeep</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Shield className="h-4 w-4 text-muted-foreground" />
                        <span>${vehicle.insuranceDaily}/day insurance</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <span className="text-xs">Total: ${totalDaily}/day</span>
                      </div>
                    </div>
                    <div className="pt-2 flex items-center justify-between border-t">
                      <span className="text-lg font-bold">${vehicle.price.toLocaleString()}</span>
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
                const totalDaily = (vehicle.upkeepDaily || 0) + (vehicle.insuranceDaily || 0);
                return (
                  <Card key={`${vehicle.id}-${vehicle.purchasedAt}`} className="overflow-hidden">
                    {vehicle.image && (
                      <div className="relative h-40 overflow-hidden">
                        <img
                          src={vehicle.image}
                          alt={vehicle.name}
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      </div>
                    )}
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
                        <span className="text-muted-foreground">Daily costs</span>
                        <span>${totalDaily}/day</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Sell value (70%)</span>
                        <span className="font-semibold">${sellPrice.toLocaleString()}</span>
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
