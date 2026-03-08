import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Star, AlertTriangle, Palette, ShieldAlert } from "lucide-react";
import { TattooBodyPreview } from "@/components/tattoo/TattooBodyPreview";
import { TattooDesignCard } from "@/components/tattoo/TattooDesignCard";
import { TattooInfectionAlert } from "@/components/tattoo/TattooInfectionAlert";
import {
  BODY_SLOTS,
  TATTOO_CATEGORIES,
  CATEGORY_LABELS,
  calculateTattooQuality,
  rollForInfection,
  type BodySlot,
  type TattooDesign,
  type PlayerTattoo,
  type TattooCategory,
} from "@/data/tattooDesigns";

export default function TattooParlour() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedParlour, setSelectedParlour] = useState<string | null>(null);
  const [selectedDesign, setSelectedDesign] = useState<TattooDesign | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<TattooCategory | 'all'>('all');
  const [selectedSlot, setSelectedSlot] = useState<BodySlot | null>(null);

  // Fetch player's current city
  const { data: profile } = useQuery({
    queryKey: ['profile-city', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('current_city_id, cash')
        .eq('user_id', user!.id)
        .single();
      return data;
    },
    enabled: !!user,
  });

  // Fetch parlours in current city
  const { data: parlours } = useQuery({
    queryKey: ['tattoo-parlours', profile?.current_city_id],
    queryFn: async () => {
      const { data } = await supabase
        .from('tattoo_parlours')
        .select('*')
        .eq('city_id', profile!.current_city_id);
      return data || [];
    },
    enabled: !!profile?.current_city_id,
  });

  // Fetch all designs
  const { data: designs } = useQuery({
    queryKey: ['tattoo-designs'],
    queryFn: async () => {
      const { data } = await supabase.from('tattoo_designs').select('*');
      return (data || []) as TattooDesign[];
    },
  });

  // Fetch player tattoos
  const { data: playerTattoos } = useQuery({
    queryKey: ['player-tattoos', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('player_tattoos')
        .select('*, tattoo_designs(*)')
        .eq('user_id', user!.id);
      return (data || []).map((t: any) => ({
        ...t,
        design: t.tattoo_designs,
      })) as PlayerTattoo[];
    },
    enabled: !!user,
  });

  const currentParlour = parlours?.find(p => p.id === selectedParlour);

  const filteredDesigns = useMemo(() => {
    if (!designs) return [];
    let filtered = designs;
    if (categoryFilter !== 'all') {
      filtered = filtered.filter(d => d.category === categoryFilter);
    }
    // Filter out designs for slots player already has tattooed
    const occupiedSlots = new Set(playerTattoos?.map(t => t.body_slot) || []);
    return filtered.filter(d => !occupiedSlots.has(d.body_slot));
  }, [designs, categoryFilter, playerTattoos]);

  // Purchase tattoo mutation
  const purchaseMutation = useMutation({
    mutationFn: async () => {
      if (!selectedDesign || !currentParlour || !user) throw new Error('Missing data');
      
      const price = Math.round(selectedDesign.base_price * currentParlour.price_multiplier);
      if ((profile?.cash || 0) < price) throw new Error('Insufficient funds');

      const qualityScore = calculateTattooQuality(currentParlour.quality_tier);
      const isInfected = rollForInfection(currentParlour.infection_risk);

      // Deduct cash
      const { error: cashError } = await supabase
        .from('profiles')
        .update({ cash: (profile?.cash || 0) - price })
        .eq('user_id', user.id);
      if (cashError) throw cashError;

      // Insert tattoo
      const { error: tattooError } = await supabase
        .from('player_tattoos')
        .insert({
          user_id: user.id,
          tattoo_design_id: selectedDesign.id,
          parlour_id: currentParlour.id,
          body_slot: selectedDesign.body_slot,
          quality_score: qualityScore,
          ink_color: selectedDesign.ink_color_primary,
          price_paid: price,
          is_infected: isInfected,
        });
      if (tattooError) throw tattooError;

      return { qualityScore, isInfected, price };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['player-tattoos'] });
      queryClient.invalidateQueries({ queryKey: ['profile-city'] });
      setSelectedDesign(null);
      
      if (result.isInfected) {
        toast.error(`Tattoo applied but got INFECTED! Quality: ${result.qualityScore}/100. Visit a hospital!`);
      } else {
        toast.success(`Tattoo applied! Quality: ${result.qualityScore}/100. Paid $${result.price}`);
      }
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  // Treat infection
  const treatMutation = useMutation({
    mutationFn: async (tattooId: string) => {
      if ((profile?.cash || 0) < 200) throw new Error('Need $200 for treatment');
      
      await supabase.from('profiles').update({ cash: (profile?.cash || 0) - 200 }).eq('user_id', user!.id);
      await supabase.from('player_tattoos').update({ is_infected: false, infection_cleared_at: new Date().toISOString() }).eq('id', tattooId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['player-tattoos'] });
      queryClient.invalidateQueries({ queryKey: ['profile-city'] });
      toast.success('Infection treated! $200 paid.');
    },
  });

  return (
    <div className="space-y-6 p-4 max-w-6xl mx-auto">
      <div className="flex items-center gap-3">
        <Palette className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Tattoo Parlour</h1>
          <p className="text-sm text-muted-foreground">Get inked. Build sleeves. Boost your stage presence.</p>
        </div>
        {profile?.cash != null && (
          <Badge variant="outline" className="ml-auto text-sm">${profile.cash.toLocaleString()}</Badge>
        )}
      </div>

      {playerTattoos && <TattooInfectionAlert tattoos={playerTattoos} onTreat={(id) => treatMutation.mutate(id)} />}

      <Tabs defaultValue="shop">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="shop">🏪 Shop</TabsTrigger>
          <TabsTrigger value="my-tattoos">🎨 My Tattoos ({playerTattoos?.length || 0})</TabsTrigger>
        </TabsList>

        <TabsContent value="shop" className="space-y-4">
          {/* Parlour Selection */}
          {!parlours?.length ? (
            <Card>
              <CardContent className="p-6 text-center text-muted-foreground">
                No tattoo parlours in your current city. Travel to a bigger city!
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {parlours.map(p => (
                <Card 
                  key={p.id}
                  className={`cursor-pointer transition-all ${selectedParlour === p.id ? 'ring-2 ring-primary' : 'hover:bg-muted/30'}`}
                  onClick={() => setSelectedParlour(p.id)}
                >
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-sm">{p.name}</h3>
                      <div className="flex">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star key={i} className={`h-3.5 w-3.5 ${i < p.quality_tier ? 'text-yellow-400 fill-yellow-400' : 'text-muted'}`} />
                        ))}
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">{p.description}</p>
                    <div className="flex gap-2">
                      <Badge variant="outline" className="text-[10px]">
                        Price: x{p.price_multiplier}
                      </Badge>
                      <Badge 
                        variant="outline" 
                        className={`text-[10px] ${p.infection_risk > 0.15 ? 'text-destructive border-destructive/50' : p.infection_risk > 0.05 ? 'text-yellow-500 border-yellow-500/50' : 'text-green-500 border-green-500/50'}`}
                      >
                        <ShieldAlert className="h-3 w-3 mr-1" />
                        Infection: {Math.round(p.infection_risk * 100)}%
                      </Badge>
                    </div>
                    {p.specialties?.length > 0 && (
                      <div className="flex gap-1 flex-wrap">
                        {p.specialties.map(s => (
                          <Badge key={s} variant="secondary" className="text-[10px]">{s}</Badge>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Design Browser */}
          {currentParlour && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Body preview */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Your Body</CardTitle>
                </CardHeader>
                <CardContent>
                  <TattooBodyPreview 
                    tattoos={playerTattoos || []} 
                    selectedSlot={selectedSlot}
                    onSlotClick={setSelectedSlot}
                  />
                </CardContent>
              </Card>

              {/* Design catalog */}
              <div className="lg:col-span-2 space-y-3">
                <ScrollArea className="w-full">
                  <div className="flex gap-1.5 pb-2">
                    <Badge
                      variant={categoryFilter === 'all' ? 'default' : 'outline'}
                      className="cursor-pointer text-xs"
                      onClick={() => setCategoryFilter('all')}
                    >All</Badge>
                    {TATTOO_CATEGORIES.map(cat => (
                      <Badge
                        key={cat}
                        variant={categoryFilter === cat ? 'default' : 'outline'}
                        className="cursor-pointer text-xs whitespace-nowrap"
                        onClick={() => setCategoryFilter(cat)}
                      >{CATEGORY_LABELS[cat]}</Badge>
                    ))}
                  </div>
                </ScrollArea>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {filteredDesigns.map(d => (
                    <TattooDesignCard
                      key={d.id}
                      design={d}
                      parlourPriceMultiplier={currentParlour.price_multiplier}
                      selected={selectedDesign?.id === d.id}
                      onSelect={setSelectedDesign}
                    />
                  ))}
                  {filteredDesigns.length === 0 && (
                    <p className="col-span-full text-center text-muted-foreground text-sm py-8">
                      No designs available for this filter. You may already have tattoos in all available slots.
                    </p>
                  )}
                </div>

                {/* Purchase confirmation */}
                {selectedDesign && (
                  <Card className="border-primary/50">
                    <CardContent className="p-4 space-y-3">
                      <h3 className="font-semibold">Confirm: {selectedDesign.name}</h3>
                      <div className="grid grid-cols-3 gap-2 text-sm">
                        <div>
                          <span className="text-muted-foreground">Price:</span>
                          <p className="font-bold">${Math.round(selectedDesign.base_price * currentParlour.price_multiplier)}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Quality Est:</span>
                          <p className="font-bold">{currentParlour.quality_tier >= 4 ? '80-100' : currentParlour.quality_tier >= 3 ? '50-80' : '20-50'}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Infection Risk:</span>
                          <p className={`font-bold ${currentParlour.infection_risk > 0.15 ? 'text-destructive' : 'text-muted-foreground'}`}>
                            {Math.round(currentParlour.infection_risk * 100)}%
                          </p>
                        </div>
                      </div>
                      {currentParlour.infection_risk > 0.15 && (
                        <div className="flex items-center gap-2 text-xs text-destructive">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          High infection risk! Consider a better parlour.
                        </div>
                      )}
                      <div className="flex gap-2">
                        <Button 
                          onClick={() => purchaseMutation.mutate()} 
                          disabled={purchaseMutation.isPending}
                          className="flex-1"
                        >
                          {purchaseMutation.isPending ? 'Getting inked...' : 'Get Tattooed'}
                        </Button>
                        <Button variant="outline" onClick={() => setSelectedDesign(null)}>Cancel</Button>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="my-tattoos" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Body Map</CardTitle>
              </CardHeader>
              <CardContent>
                <TattooBodyPreview tattoos={playerTattoos || []} />
              </CardContent>
            </Card>

            <div className="lg:col-span-2">
              {!playerTattoos?.length ? (
                <Card>
                  <CardContent className="p-6 text-center text-muted-foreground">
                    No tattoos yet. Visit a parlour to get your first ink!
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {playerTattoos.map(t => (
                    <Card key={t.id} className={t.is_infected ? 'border-destructive/50' : ''}>
                      <CardContent className="p-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <h4 className="font-semibold text-sm">{t.design?.name || 'Tattoo'}</h4>
                          {t.is_infected && <Badge variant="destructive" className="text-[10px]">🦠 Infected</Badge>}
                        </div>
                        <div className="flex gap-2 flex-wrap">
                          <Badge variant="outline" className="text-[10px]">
                            {BODY_SLOTS[t.body_slot as BodySlot]?.label || t.body_slot}
                          </Badge>
                          <Badge 
                            variant="outline" 
                            className={`text-[10px] ${t.quality_score >= 80 ? 'text-green-400' : t.quality_score >= 50 ? 'text-yellow-400' : 'text-orange-400'}`}
                          >
                            Quality: {t.quality_score}/100
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 rounded-full border" style={{ backgroundColor: t.ink_color }} />
                          <span className="text-xs text-muted-foreground">Paid ${t.price_paid}</span>
                        </div>
                        {/* Genre effects */}
                        {t.design?.genre_affinity && (
                          <div className="flex flex-wrap gap-1">
                            {Object.entries(t.design.genre_affinity)
                              .filter(([_, v]) => (v as number) !== 0)
                              .sort((a, b) => Math.abs(b[1] as number) - Math.abs(a[1] as number))
                              .slice(0, 3)
                              .map(([genre, value]) => (
                                <Badge 
                                  key={genre}
                                  variant="secondary" 
                                  className={`text-[10px] ${(value as number) > 0 ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}
                                >
                                  {genre}: {(value as number) > 0 ? '+' : ''}{Math.round((value as number) * (t.quality_score / 100) * 100)}%
                                </Badge>
                              ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
