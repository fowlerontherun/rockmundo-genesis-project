// @ts-nocheck
import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/ui/empty-state";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import { Home, Building2, Key, DollarSign, Bed, MapPin, Loader2, ImageIcon, Wand2, Globe } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth-context";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient, useQuery } from "@tanstack/react-query";

function useCountriesWithHousing() {
  return useQuery({
    queryKey: ["housing-countries"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("housing_types")
        .select("country")
        .eq("is_active", true);
      if (error) throw error;
      const unique = [...new Set((data ?? []).map(d => d.country))].sort();
      return unique as string[];
    },
  });
}

function useCitiesInCountry(country: string | null) {
  return useQuery({
    queryKey: ["cities-in-country", country],
    queryFn: async () => {
      if (!country) return [];
      const { data, error } = await supabase
        .from("cities")
        .select("id, name, cost_of_living")
        .eq("country", country)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!country,
  });
}

const Housing = () => {
  const { currentCity } = useGameData();
  const { user } = useAuth();

  // Filter state — defaults to player's current location
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [selectedCityId, setSelectedCityId] = useState<string | null>(null);

  const { data: countries = [] } = useCountriesWithHousing();
  const activeCountry = selectedCountry ?? currentCity?.country ?? null;
  const { data: citiesInCountry = [] } = useCitiesInCountry(activeCountry);

  // Determine effective city for cost_of_living
  const effectiveCity = useMemo(() => {
    if (selectedCityId) return citiesInCountry.find(c => c.id === selectedCityId) ?? null;
    if (!selectedCountry && currentCity?.country === activeCountry) return currentCity;
    return citiesInCountry[0] ?? null;
  }, [selectedCityId, selectedCountry, citiesInCountry, currentCity, activeCountry]);

  const costOfLiving = effectiveCity?.cost_of_living ?? 50;

  const { data: housingTypes, isLoading: loadingHousing } = useHousingTypes(activeCountry);
  const { data: rentalTypes, isLoading: loadingRentals } = useRentalTypes();
  const { data: playerProperties, isLoading: loadingProperties } = usePlayerProperties();
  const { data: activeRental, isLoading: loadingRental } = usePlayerRental();

  const buyProperty = useBuyProperty();
  const startRental = useStartRental();
  const endRental = useEndRental();

  const [generatingImage, setGeneratingImage] = useState<string | null>(null);
  const [batchGenerating, setBatchGenerating] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{ processed: number; remaining: number } | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleGenerateImage = async (housingTypeId: string) => {
    setGeneratingImage(housingTypeId);
    try {
      const { data, error } = await supabase.functions.invoke("generate-housing-image", {
        body: { housing_type_id: housingTypeId, country: activeCountry },
      });
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["housing-types"] });
    } catch (e) {
      console.error("Image generation failed:", e);
    } finally {
      setGeneratingImage(null);
    }
  };

  const handleBatchGenerate = async () => {
    setBatchGenerating(true);
    setBatchProgress(null);
    toast({ title: "Batch Generation Started", description: "Generating images for all housing types. This will take a while..." });
    
    let totalProcessed = 0;
    let remaining = 1;
    
    while (remaining > 0) {
      try {
        const { data, error } = await supabase.functions.invoke("generate-housing-image", {
          body: { batch: true, batch_size: 5, delay_ms: 4000 },
        });
        if (error) throw error;
        
        totalProcessed += data.processed || 0;
        remaining = data.remaining || 0;
        setBatchProgress({ processed: totalProcessed, remaining });
        queryClient.invalidateQueries({ queryKey: ["housing-types"] });
        
        if (data.processed === 0 && remaining > 0) {
          await new Promise(r => setTimeout(r, 30000));
        }
        
        if (remaining === 0) {
          toast({ title: "All Done!", description: `Generated ${totalProcessed} housing images.` });
        }
      } catch (e) {
        console.error("Batch generation error:", e);
        toast({ title: "Batch Error", description: "Will retry in 30 seconds...", variant: "destructive" });
        await new Promise(r => setTimeout(r, 30000));
      }
    }
    
    setBatchGenerating(false);
  };

  const ownedInCountry = playerProperties?.filter(p => p.country === activeCountry) ?? [];
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
          {activeCountry ? `Browse properties in ${activeCountry}` : "Select a country to view available properties"}
        </p>
      </div>

      {/* Country & City Filters */}
      <Card className="bg-muted/30">
        <CardContent className="py-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex-1 min-w-[200px]">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                <Globe className="h-3 w-3 inline mr-1" />Country
              </label>
              <Select
                value={activeCountry ?? ""}
                onValueChange={(val) => {
                  setSelectedCountry(val);
                  setSelectedCityId(null);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select country..." />
                </SelectTrigger>
                <SelectContent>
                  {countries.map(c => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex-1 min-w-[200px]">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                <MapPin className="h-3 w-3 inline mr-1" />City (affects rental pricing)
              </label>
              <Select
                value={selectedCityId ?? effectiveCity?.id ?? ""}
                onValueChange={(val) => setSelectedCityId(val)}
                disabled={!activeCountry || citiesInCountry.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select city..." />
                </SelectTrigger>
                <SelectContent>
                  {citiesInCountry.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} (CoL: {c.cost_of_living})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {currentCity && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedCountry(null);
                  setSelectedCityId(null);
                }}
              >
                <MapPin className="h-4 w-4 mr-1" />
                My Location
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {housingTypes && housingTypes.some(h => !h.image_url) && (
        <div className="flex items-center gap-3">
          <Button
            size="sm"
            variant="outline"
            onClick={handleBatchGenerate}
            disabled={batchGenerating}
          >
            {batchGenerating ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Wand2 className="h-4 w-4 mr-1" />}
            {batchGenerating ? "Generating..." : "Generate All Missing Images"}
          </Button>
          {batchProgress && (
            <span className="text-xs text-muted-foreground">
              {batchProgress.processed} done, {batchProgress.remaining} remaining
            </span>
          )}
        </div>
      )}

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
          {!activeCountry ? (
            <EmptyState icon={MapPin} title="No Country Selected" description="Select a country above to see available properties." />
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
                        <span className="text-xs text-muted-foreground">{activeCountry}</span>
                      </div>
                    </CardContent>
                    <CardFooter>
                      {owned ? (
                        <Badge variant="secondary" className="w-full justify-center">Owned</Badge>
                      ) : (
                        <Button
                          className="w-full"
                          size="sm"
                          onClick={() => buyProperty.mutate({ housingType: ht, country: activeCountry! })}
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

          {!activeCountry ? (
            <EmptyState icon={MapPin} title="No Country Selected" description="Select a country above to see rental options." />
          ) : loadingRentals ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : (
            <>
              {effectiveCity && (
                <p className="text-xs text-muted-foreground">
                  Prices based on {effectiveCity.name} cost of living ({costOfLiving})
                </p>
              )}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {rentalTypes?.map((rt) => {
                  const weeklyCost = calculateWeeklyRent(rt.base_weekly_cost, costOfLiving);
                  const isCurrentRental = activeRental?.rental_type_id === rt.id && activeRental?.country === activeCountry;
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
                            onClick={() => startRental.mutate({ rentalType: rt, country: activeCountry!, weeklyCost })}
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
            </>
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
