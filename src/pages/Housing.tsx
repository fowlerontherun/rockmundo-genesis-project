// @ts-nocheck
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/ui/empty-state";
import { useGameData } from "@/hooks/useGameData";
import {
  useHousingTypes,
  useRentalTypes,
  usePlayerProperties,
  usePlayerRental,
  useBuyProperty,
  useStartRental,
  useEndRental,
  calculateWeeklyRent,
} from "@/hooks/useHousing";
import { Home, Building2, Key, DollarSign, Bed, MapPin, Loader2, ImageIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth-context";

const Housing = () => {
  const { currentCity } = useGameData();
  const { user } = useAuth();
  const country = currentCity?.country ?? null;
  const costOfLiving = currentCity?.cost_of_living ?? 50;

  const { data: housingTypes, isLoading: loadingHousing } = useHousingTypes(country);
  const { data: rentalTypes, isLoading: loadingRentals } = useRentalTypes();
  const { data: playerProperties, isLoading: loadingProperties } = usePlayerProperties();
  const { data: activeRental, isLoading: loadingRental } = usePlayerRental();

  const buyProperty = useBuyProperty();
  const startRental = useStartRental();
  const endRental = useEndRental();

  const [generatingImage, setGeneratingImage] = useState<string | null>(null);

  const handleGenerateImage = async (housingTypeId: string) => {
    setGeneratingImage(housingTypeId);
    try {
      const { data, error } = await supabase.functions.invoke("generate-housing-image", {
        body: { housing_type_id: housingTypeId, country },
      });
      if (error) throw error;
    } catch (e) {
      console.error("Image generation failed:", e);
    } finally {
      setGeneratingImage(null);
    }
  };

  const ownedInCountry = playerProperties?.filter(p => p.country === country) ?? [];
  const ownedIds = new Set(playerProperties?.map(p => p.housing_type_id) ?? []);

  const formatPrice = (amount: number) => `$${amount.toLocaleString()}`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Home className="h-6 w-6 text-primary" />
          Housing
        </h1>
        <p className="text-muted-foreground">
          {country ? `Browse properties in ${country}` : "Travel to a city to view available properties"}
        </p>
      </div>

      <Tabs defaultValue="buy">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="buy">
            <Building2 className="h-4 w-4 mr-1" /> Buy Property
          </TabsTrigger>
          <TabsTrigger value="rent">
            <Key className="h-4 w-4 mr-1" /> Rent
          </TabsTrigger>
          <TabsTrigger value="owned">
            <Home className="h-4 w-4 mr-1" /> My Properties ({playerProperties?.length ?? 0})
          </TabsTrigger>
        </TabsList>

        {/* BUY TAB */}
        <TabsContent value="buy" className="space-y-4">
          {!country ? (
            <EmptyState icon={MapPin} title="No City Selected" description="Travel to a city to see available properties." />
          ) : loadingHousing ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {housingTypes?.map((ht) => {
                const owned = ownedIds.has(ht.id);
                return (
                  <Card key={ht.id} className={owned ? "border-primary/50 bg-primary/5" : ""}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <Badge variant="outline" className="text-xs">Tier {ht.tier}</Badge>
                        <Badge className="text-xs">{ht.bedrooms} <Bed className="h-3 w-3 ml-0.5" /></Badge>
                      </div>
                      <CardTitle className="text-base mt-1">{ht.name}</CardTitle>
                      <CardDescription className="text-xs">{ht.description}</CardDescription>
                    </CardHeader>
                    <CardContent className="pb-2">
                      {ht.image_url ? (
                        <img src={ht.image_url} alt={ht.name} className="w-full h-32 object-cover rounded-md" />
                      ) : (
                        <div className="w-full h-32 bg-muted rounded-md flex items-center justify-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleGenerateImage(ht.id)}
                            disabled={generatingImage === ht.id}
                          >
                            {generatingImage === ht.id ? (
                              <Loader2 className="h-4 w-4 animate-spin mr-1" />
                            ) : (
                              <ImageIcon className="h-4 w-4 mr-1" />
                            )}
                            Generate Image
                          </Button>
                        </div>
                      )}
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-lg font-bold text-primary">{formatPrice(ht.base_price)}</span>
                        <span className="text-xs text-muted-foreground">{country}</span>
                      </div>
                    </CardContent>
                    <CardFooter>
                      {owned ? (
                        <Badge variant="secondary" className="w-full justify-center">Owned</Badge>
                      ) : (
                        <Button
                          className="w-full"
                          size="sm"
                          onClick={() => buyProperty.mutate({ housingType: ht, country: country! })}
                          disabled={buyProperty.isPending}
                        >
                          {buyProperty.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <DollarSign className="h-4 w-4 mr-1" />}
                          Buy Property
                        </Button>
                      )}
                    </CardFooter>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* RENT TAB */}
        <TabsContent value="rent" className="space-y-4">
          {activeRental && (
            <Card className="border-primary/50 bg-primary/5">
              <CardHeader>
                <CardTitle className="text-base">Current Rental</CardTitle>
                <CardDescription>
                  {activeRental.rental_types?.name} in {activeRental.country} — {formatPrice(activeRental.weekly_cost)}/week
                </CardDescription>
              </CardHeader>
              <CardFooter>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => endRental.mutate(activeRental.id)}
                  disabled={endRental.isPending}
                >
                  End Lease
                </Button>
              </CardFooter>
            </Card>
          )}

          {!country ? (
            <EmptyState icon={MapPin} title="No City Selected" description="Travel to a city to see rental options." />
          ) : loadingRentals ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {rentalTypes?.map((rt) => {
                const weeklyCost = calculateWeeklyRent(rt.base_weekly_cost, costOfLiving);
                const isCurrentRental = activeRental?.rental_type_id === rt.id && activeRental?.country === country;
                return (
                  <Card key={rt.id} className={isCurrentRental ? "border-primary/50 bg-primary/5" : ""}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <Badge variant="outline" className="text-xs">Tier {rt.tier}</Badge>
                      </div>
                      <CardTitle className="text-base">{rt.name}</CardTitle>
                      <CardDescription className="text-xs">{rt.description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between">
                        <span className="text-lg font-bold text-primary">{formatPrice(weeklyCost)}/week</span>
                        <span className="text-xs text-muted-foreground">Base: {formatPrice(rt.base_weekly_cost)}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Daily: {formatPrice(Math.round(weeklyCost / 7))}
                      </p>
                    </CardContent>
                    <CardFooter>
                      {isCurrentRental ? (
                        <Badge variant="secondary" className="w-full justify-center">Current Rental</Badge>
                      ) : (
                        <Button
                          className="w-full"
                          size="sm"
                          onClick={() => startRental.mutate({ rentalType: rt, country: country!, weeklyCost })}
                          disabled={startRental.isPending || !!activeRental}
                        >
                          {startRental.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Key className="h-4 w-4 mr-1" />}
                          Start Renting
                        </Button>
                      )}
                    </CardFooter>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* OWNED TAB */}
        <TabsContent value="owned" className="space-y-4">
          {loadingProperties ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : !playerProperties?.length ? (
            <EmptyState icon={Home} title="No Properties" description="You don't own any properties yet." />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {playerProperties.map((pp) => (
                <Card key={pp.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="text-xs">{pp.country}</Badge>
                      {pp.is_primary && <Badge className="text-xs">Primary</Badge>}
                    </div>
                    <CardTitle className="text-base">{pp.housing_types?.name ?? "Property"}</CardTitle>
                    <CardDescription className="text-xs">
                      Purchased for {formatPrice(pp.purchase_price)}
                    </CardDescription>
                  </CardHeader>
                  {pp.housing_types?.image_url && (
                    <CardContent className="pb-2">
                      <img src={pp.housing_types.image_url} alt={pp.housing_types.name} className="w-full h-32 object-cover rounded-md" />
                    </CardContent>
                  )}
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Housing;
