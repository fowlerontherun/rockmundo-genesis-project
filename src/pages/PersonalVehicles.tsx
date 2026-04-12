import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Car, Bike, DollarSign, Gauge, CalendarDays, Shield, Anchor } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

type VehicleCategory = "car" | "motorbike" | "boat";

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
  { id: "vespa-gts", name: "Vespa GTS 300", category: "motorbike", description: "Iconic Italian scooter with timeless style. Perfect for Mediterranean city cruising.", topSpeedKmh: 130, upkeepDaily: 10, insuranceDaily: 7, price: 7500, image: "/vehicles/vespa-gts.jpg" },
  { id: "ktm-duke-390", name: "KTM 390 Duke", category: "motorbike", description: "Aggressive naked streetfighter. Sharp handling and punchy single-cylinder power.", topSpeedKmh: 167, upkeepDaily: 15, insuranceDaily: 10, price: 5500, image: "/vehicles/ktm-duke-390.jpg" },
  { id: "kawasaki-ninja-400", name: "Kawasaki Ninja 400", category: "motorbike", description: "Lightweight sport bike with sharp handling — a great first performance ride.", topSpeedKmh: 191, upkeepDaily: 18, insuranceDaily: 12, price: 5800, image: "/vehicles/kawasaki-ninja-400.jpg" },
  { id: "yamaha-mt09", name: "Yamaha MT-09", category: "motorbike", description: "Triple-cylinder naked bike with explosive power. The dark side of Japan.", topSpeedKmh: 210, upkeepDaily: 20, insuranceDaily: 14, price: 9800, image: "/vehicles/yamaha-mt09.jpg" },
  { id: "triumph-bonneville", name: "Triumph Bonneville T120", category: "motorbike", description: "Timeless British classic with modern reliability. Turns heads at every gig.", topSpeedKmh: 177, upkeepDaily: 22, insuranceDaily: 15, price: 12500, image: "/vehicles/triumph-bonneville.jpg" },
  { id: "indian-scout", name: "Indian Scout Bobber", category: "motorbike", description: "Classic American cruiser with a blacked-out bobber attitude. Pure cool.", topSpeedKmh: 185, upkeepDaily: 24, insuranceDaily: 16, price: 14000, image: "/vehicles/indian-scout.jpg" },
  { id: "harley-street-bob", name: "Harley-Davidson Street Bob 114", category: "motorbike", description: "Iconic American cruiser with a thunderous 114 cubic inch Milwaukee-Eight engine.", topSpeedKmh: 177, upkeepDaily: 28, insuranceDaily: 20, price: 16500, image: "/vehicles/harley-street-bob.jpg" },
  { id: "honda-goldwing", name: "Honda Gold Wing", category: "motorbike", description: "The ultimate luxury touring motorcycle. A two-wheeled limousine for the open road.", topSpeedKmh: 180, upkeepDaily: 35, insuranceDaily: 25, price: 28000, image: "/vehicles/honda-goldwing.jpg" },
  { id: "bmw-s1000rr", name: "BMW S1000RR", category: "motorbike", description: "German-engineered superbike perfection. 205 HP of surgical precision.", topSpeedKmh: 303, upkeepDaily: 40, insuranceDaily: 30, price: 22000, image: "/vehicles/bmw-s1000rr.jpg" },
  { id: "ducati-panigale-v4", name: "Ducati Panigale V4", category: "motorbike", description: "Italian superbike masterpiece. 214 HP of pure race-bred adrenaline.", topSpeedKmh: 299, upkeepDaily: 45, insuranceDaily: 35, price: 28000, image: "/vehicles/ducati-panigale-v4.jpg" },

  // ── Cars ──
  { id: "mini-cooper-s", name: "MINI Cooper S", category: "car", description: "British icon with go-kart handling. Compact fun with bags of personality.", topSpeedKmh: 235, upkeepDaily: 18, insuranceDaily: 14, price: 32000, image: "/vehicles/mini-cooper-s.jpg" },
  { id: "toyota-gr86", name: "Toyota GR86", category: "car", description: "Lightweight rear-wheel-drive sports coupe. Pure driving joy on a budget.", topSpeedKmh: 226, upkeepDaily: 20, insuranceDaily: 16, price: 30000, image: "/vehicles/toyota-gr86.jpg" },
  { id: "vw-golf-gti", name: "Volkswagen Golf GTI", category: "car", description: "The definitive hot hatch. Practical, fun, and affordable to run.", topSpeedKmh: 250, upkeepDaily: 22, insuranceDaily: 18, price: 35000, image: "/vehicles/vw-golf-gti.jpg" },
  { id: "ford-mustang-gt", name: "Ford Mustang GT", category: "car", description: "All-American muscle with a 5.0L V8. Nothing sounds quite like it.", topSpeedKmh: 250, upkeepDaily: 30, insuranceDaily: 22, price: 42000, image: "/vehicles/ford-mustang-gt.jpg" },
  { id: "tesla-model-3", name: "Tesla Model 3", category: "car", description: "Electric performance sedan. Silent speed, autopilot, and zero emissions.", topSpeedKmh: 261, upkeepDaily: 15, insuranceDaily: 20, price: 45000, image: "/vehicles/tesla-model-3.jpg" },
  { id: "bmw-3-series", name: "BMW 3 Series", category: "car", description: "The benchmark sports sedan. Refined luxury meets spirited driving dynamics.", topSpeedKmh: 250, upkeepDaily: 35, insuranceDaily: 28, price: 48000, image: "/vehicles/bmw-3-series.jpg" },
  { id: "jeep-wrangler", name: "Jeep Wrangler Rubicon", category: "car", description: "Go-anywhere rugged SUV. Remove the doors and roof for festival season.", topSpeedKmh: 175, upkeepDaily: 32, insuranceDaily: 24, price: 55000, image: "/vehicles/jeep-wrangler.jpg" },
  { id: "mercedes-amg-c63", name: "Mercedes-AMG C63", category: "car", description: "Hand-built AMG bi-turbo V8 power in a sleek sedan. 503 HP of authority.", topSpeedKmh: 290, upkeepDaily: 55, insuranceDaily: 45, price: 82000, image: "/vehicles/mercedes-amg-c63.jpg" },
  { id: "audi-rs6", name: "Audi RS6 Avant", category: "car", description: "600 HP twin-turbo V8 estate. Haul your gear at supercar speed.", topSpeedKmh: 305, upkeepDaily: 60, insuranceDaily: 48, price: 120000, image: "/vehicles/audi-rs6.jpg" },
  { id: "range-rover-sport", name: "Range Rover Sport", category: "car", description: "Commanding luxury SUV. Arrive at any venue with rockstar presence.", topSpeedKmh: 242, upkeepDaily: 65, insuranceDaily: 50, price: 95000, image: "/vehicles/range-rover-sport.jpg" },
  { id: "porsche-911", name: "Porsche 911 Carrera", category: "car", description: "The iconic sports car. Six decades of engineering excellence in every curve.", topSpeedKmh: 308, upkeepDaily: 75, insuranceDaily: 60, price: 120000, image: "/vehicles/porsche-911.jpg" },
  { id: "nissan-gtr", name: "Nissan GT-R Nismo", category: "car", description: "Godzilla. 600 HP twin-turbo V6 with legendary all-wheel-drive grip.", topSpeedKmh: 315, upkeepDaily: 80, insuranceDaily: 65, price: 215000, image: "/vehicles/nissan-gtr.jpg" },
  { id: "bentley-continental", name: "Bentley Continental GT", category: "car", description: "Handcrafted British grand tourer. W12 power wrapped in opulent luxury.", topSpeedKmh: 333, upkeepDaily: 120, insuranceDaily: 95, price: 250000, image: "/vehicles/bentley-continental.jpg" },
  { id: "ferrari-f8", name: "Ferrari F8 Tributo", category: "car", description: "Mid-engine Italian masterpiece. 710 HP V8 twin-turbo — automotive art.", topSpeedKmh: 340, upkeepDaily: 140, insuranceDaily: 110, price: 300000, image: "/vehicles/ferrari-f8.jpg" },
  { id: "lamborghini-huracan", name: "Lamborghini Huracán EVO", category: "car", description: "V10 supercar with 640 HP. The ultimate rockstar statement vehicle.", topSpeedKmh: 325, upkeepDaily: 150, insuranceDaily: 120, price: 280000, image: "/vehicles/lamborghini-huracan.jpg" },
  { id: "rolls-royce-ghost", name: "Rolls-Royce Ghost", category: "car", description: "The pinnacle of automotive luxury. A moving sanctuary of opulence.", topSpeedKmh: 250, upkeepDaily: 180, insuranceDaily: 140, price: 350000, image: "/vehicles/rolls-royce-ghost.jpg" },
  { id: "bugatti-chiron", name: "Bugatti Chiron", category: "car", description: "1,500 HP W16 quad-turbo hypercar. The ultimate status symbol — if you can afford it.", topSpeedKmh: 420, upkeepDaily: 500, insuranceDaily: 380, price: 3200000, image: "/vehicles/bugatti-chiron.jpg" },

  // ── Boats & Yachts ──
  { id: "jet-ski", name: "Yamaha WaveRunner", category: "boat", description: "Personal watercraft for adrenaline on the water. Perfect for lake days between gigs.", topSpeedKmh: 105, upkeepDaily: 15, insuranceDaily: 10, price: 12000, image: "/vehicles/jet-ski.jpg" },
  { id: "speedboat", name: "Scarab 195 Speedboat", category: "boat", description: "Compact jet-powered speedboat. Thrilling water fun without the complexity.", topSpeedKmh: 80, upkeepDaily: 30, insuranceDaily: 20, price: 38000, image: "/vehicles/speedboat.jpg" },
  { id: "fishing-boat", name: "Boston Whaler 230", category: "boat", description: "Legendary unsinkable center console. Perfect for ocean fishing getaways.", topSpeedKmh: 65, upkeepDaily: 35, insuranceDaily: 25, price: 85000, image: "/vehicles/fishing-boat.jpg" },
  { id: "sailboat", name: "Beneteau Oceanis 40", category: "boat", description: "Classic sailing yacht. Catch the wind and escape the music industry chaos.", topSpeedKmh: 18, upkeepDaily: 45, insuranceDaily: 35, price: 180000, image: "/vehicles/sailboat.jpg" },
  { id: "cabin-cruiser", name: "Sea Ray Sundancer 320", category: "boat", description: "Luxury cabin cruiser with sleeping quarters. Your floating penthouse.", topSpeedKmh: 55, upkeepDaily: 65, insuranceDaily: 50, price: 250000, image: "/vehicles/cabin-cruiser.jpg" },
  { id: "catamaran", name: "Lagoon 42 Catamaran", category: "boat", description: "Twin-hull sailing yacht with spacious deck. Host parties on the ocean.", topSpeedKmh: 20, upkeepDaily: 80, insuranceDaily: 60, price: 450000, image: "/vehicles/catamaran.jpg" },
  { id: "superyacht", name: "Azimut Grande 27M", category: "boat", description: "Luxury superyacht with multiple cabins, flybridge, and tender garage.", topSpeedKmh: 48, upkeepDaily: 350, insuranceDaily: 250, price: 4500000, image: "/vehicles/superyacht.jpg" },
  { id: "megayacht", name: "Benetti Oasis 40M", category: "boat", description: "Ultra-luxury megayacht with infinity pool, helipad, and full crew quarters. Peak fame.", topSpeedKmh: 32, upkeepDaily: 800, insuranceDaily: 600, price: 18000000, image: "/vehicles/megayacht.jpg" },
];

const CATEGORY_IMAGES: Record<VehicleCategory, string> = {
  car: "/vehicles/category-cars.jpg",
  motorbike: "/vehicles/category-motorbikes.jpg",
  boat: "/vehicles/category-boats.jpg",
};

const CATEGORY_ICON: Record<VehicleCategory, typeof Car> = {
  car: Car,
  motorbike: Bike,
  boat: Anchor,
};

const CATEGORY_LABEL: Record<VehicleCategory, string> = {
  car: "Cars",
  motorbike: "Motorbikes",
  boat: "Boats & Yachts",
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

  const getCategoryIcon = (cat: VehicleCategory) => CATEGORY_ICON[cat];
  const speedLabel = (cat: VehicleCategory) => cat === "boat" ? "knots" : "km/h";
  const displaySpeed = (cat: VehicleCategory, kmh: number) => cat === "boat" ? Math.round(kmh * 0.54) : kmh;

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold">Vehicles & Vessels</h1>
        <p className="text-muted-foreground">Buy cars, motorbikes, boats and yachts. Insurance & upkeep charged daily.</p>
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
          <div className="grid gap-4 md:grid-cols-3">
            {(["car", "motorbike", "boat"] as VehicleCategory[]).map((cat) => {
              const Icon = getCategoryIcon(cat);
              return (
                <button
                  key={cat}
                  onClick={() => setCategoryFilter(cat === categoryFilter ? "all" : cat)}
                  className={`relative overflow-hidden rounded-xl border-2 transition-all ${
                    categoryFilter === cat ? "border-primary ring-2 ring-primary/30" : "border-border hover:border-primary/50"
                  }`}
                >
                  <img
                    src={CATEGORY_IMAGES[cat]}
                    alt={CATEGORY_LABEL[cat]}
                    className="h-32 w-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/40 to-transparent" />
                  <div className="absolute bottom-3 left-4 flex items-center gap-2">
                    <Icon className="h-5 w-5 text-primary" />
                    <span className="text-lg font-bold">{CATEGORY_LABEL[cat]}</span>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant={categoryFilter === "all" ? "default" : "outline"} size="sm" onClick={() => setCategoryFilter("all")}>All ({VEHICLE_CATALOG.length})</Button>
            {(["car", "motorbike", "boat"] as VehicleCategory[]).map((cat) => {
              const Icon = getCategoryIcon(cat);
              return (
                <Button key={cat} variant={categoryFilter === cat ? "default" : "outline"} size="sm" onClick={() => setCategoryFilter(cat)}>
                  <Icon className="h-4 w-4 mr-1" /> {CATEGORY_LABEL[cat]} ({VEHICLE_CATALOG.filter(v => v.category === cat).length})
                </Button>
              );
            })}
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredCatalog.map((vehicle) => {
              const owned = ownedIds.has(vehicle.id);
              const Icon = getCategoryIcon(vehicle.category);
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
                        {vehicle.category === "boat" ? "boat" : vehicle.category}
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
                        <span>{displaySpeed(vehicle.category, vehicle.topSpeedKmh)} {speedLabel(vehicle.category)}</span>
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
                const Icon = getCategoryIcon(vehicle.category) || Car;
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
