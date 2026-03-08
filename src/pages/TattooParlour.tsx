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
import { Star, AlertTriangle, Palette, ShieldAlert, Sparkles, Type } from "lucide-react";
import { TattooBodyPreview } from "@/components/tattoo/TattooBodyPreview";
import { TattooDesignCard } from "@/components/tattoo/TattooDesignCard";
import { TattooInfectionAlert } from "@/components/tattoo/TattooInfectionAlert";
import { TattooArtistCard, type TattooArtist } from "@/components/tattoo/TattooArtistCard";
import { CustomTattooDialog } from "@/components/tattoo/CustomTattooDialog";
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
  const [selectedArtist, setSelectedArtist] = useState<TattooArtist | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<TattooCategory | 'all'>('all');
  const [selectedSlot, setSelectedSlot] = useState<BodySlot | null>(null);
  const [customDialogOpen, setCustomDialogOpen] = useState(false);
  const [customArtist, setCustomArtist] = useState<TattooArtist | null>(null);

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

  // Fetch artists for selected parlour
  const { data: artists } = useQuery({
    queryKey: ['tattoo-artists', selectedParlour],
    queryFn: async () => {
      const { data } = await supabase
        .from('tattoo_artists')
        .select('*')
        .eq('parlour_id', selectedParlour!)
        .order('fame_level', { ascending: false });
      return (data || []) as TattooArtist[];
    },
    enabled: !!selectedParlour,
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
        .select('*, tattoo_designs(*), tattoo_artists(*)')
        .eq('user_id', user!.id);
      return (data || []).map((t: any) => ({
        ...t,
        design: t.tattoo_designs,
        artist: t.tattoo_artists,
      })) as (PlayerTattoo & { artist?: TattooArtist })[];
    },
    enabled: !!user,
  });

  // Fetch custom requests
  const { data: customRequests } = useQuery({
    queryKey: ['custom-tattoo-requests', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('custom_tattoo_requests')
        .select('*, tattoo_artists(*)')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false });
      return data || [];
    },
    enabled: !!user,
  });

  const currentParlour = parlours?.find(p => p.id === selectedParlour);
  const occupiedSlots = new Set(playerTattoos?.map(t => t.body_slot) || []);

  const filteredDesigns = useMemo(() => {
    if (!designs) return [];
    let filtered = designs;
    if (categoryFilter !== 'all') {
      filtered = filtered.filter(d => d.category === categoryFilter);
    }
    return filtered.filter(d => !occupiedSlots.has(d.body_slot));
  }, [designs, categoryFilter, playerTattoos]);

  // Price with artist premium
  const getPrice = (basePrice: number) => {
    if (!currentParlour) return basePrice;
    const artistMultiplier = selectedArtist?.price_premium || 1.0;
    return Math.round(basePrice * currentParlour.price_multiplier * artistMultiplier);
  };

  // Purchase tattoo mutation
  const purchaseMutation = useMutation({
    mutationFn: async () => {
      if (!selectedDesign || !currentParlour || !user) throw new Error('Missing data');
      
      const price = getPrice(selectedDesign.base_price);
      if ((profile?.cash || 0) < price) throw new Error('Insufficient funds');

      const artistBonus = selectedArtist?.quality_bonus || 0;
      const specialtyBonus = selectedArtist?.specialty === selectedDesign.category ? 5 : 0;
      const qualityScore = Math.min(100, calculateTattooQuality(currentParlour.quality_tier) + artistBonus + specialtyBonus);
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
          artist_id: selectedArtist?.id || null,
          body_slot: selectedDesign.body_slot,
          quality_score: qualityScore,
          ink_color: selectedDesign.ink_color_primary,
          price_paid: price,
          is_infected: isInfected,
        });
      if (tattooError) throw tattooError;

      // Increment artist tattoo count
      if (selectedArtist) {
        await supabase
          .from('tattoo_artists')
          .update({ total_tattoos_done: selectedArtist.total_tattoos_done + 1 })
          .eq('id', selectedArtist.id);
      }

      return { qualityScore, isInfected, price };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['player-tattoos'] });
      queryClient.invalidateQueries({ queryKey: ['profile-city'] });
      queryClient.invalidateQueries({ queryKey: ['tattoo-artists'] });
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

  // Custom tattoo mutation
  const customMutation = useMutation({
    mutationFn: async (data: { description: string; bodySlot: BodySlot; quotedPrice: number; estimatedQuality: number }) => {
      if (!customArtist || !currentParlour || !user) throw new Error('Missing data');
      if ((profile?.cash || 0) < data.quotedPrice) throw new Error('Insufficient funds');

      // Deduct cash
      await supabase.from('profiles').update({ cash: (profile?.cash || 0) - data.quotedPrice }).eq('user_id', user.id);

      // Calculate quality with custom boost
      const baseQuality = calculateTattooQuality(currentParlour.quality_tier);
      const qualityScore = Math.min(100, baseQuality + customArtist.quality_bonus + 10); // +10% custom boost

      // Create the tattoo directly (instant completion for MVP)
      const { data: tattoo, error: tattooError } = await supabase
        .from('player_tattoos')
        .insert({
          user_id: user.id,
          tattoo_design_id: null,
          parlour_id: currentParlour.id,
          artist_id: customArtist.id,
          body_slot: data.bodySlot,
          quality_score: qualityScore,
          ink_color: '#1a1a2e',
          price_paid: data.quotedPrice,
          is_infected: false, // Custom artists don't cause infections
        })
        .select()
        .single();
      if (tattooError) throw tattooError;

      // Create the request record
      await supabase.from('custom_tattoo_requests').insert({
        user_id: user.id,
        artist_id: customArtist.id,
        description: data.description,
        body_slot: data.bodySlot,
        status: 'completed',
        quoted_price: data.quotedPrice,
        estimated_quality: qualityScore,
        completed_tattoo_id: tattoo.id,
      });

      // Increment artist count
      await supabase
        .from('tattoo_artists')
        .update({ total_tattoos_done: customArtist.total_tattoos_done + 1 })
        .eq('id', customArtist.id);

      return { qualityScore, price: data.quotedPrice };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['player-tattoos'] });
      queryClient.invalidateQueries({ queryKey: ['profile-city'] });
      queryClient.invalidateQueries({ queryKey: ['custom-tattoo-requests'] });
      queryClient.invalidateQueries({ queryKey: ['tattoo-artists'] });
      setCustomDialogOpen(false);
      toast.success(`Custom tattoo complete! Quality: ${result.qualityScore}/100. Paid $${result.price}`);
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

  const qualityEstimate = () => {
    if (!currentParlour) return '';
    const base = currentParlour.quality_tier >= 4 ? '80-100' : currentParlour.quality_tier >= 3 ? '50-80' : '20-50';
    if (selectedArtist) {
      const bonus = selectedArtist.quality_bonus;
      return `${base} +${bonus}`;
    }
    return base;
  };

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
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="shop">🏪 Shop</TabsTrigger>
          <TabsTrigger value="my-tattoos">🎨 My Tattoos ({playerTattoos?.length || 0})</TabsTrigger>
          <TabsTrigger value="custom">✨ Custom ({customRequests?.length || 0})</TabsTrigger>
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
                  onClick={() => { setSelectedParlour(p.id); setSelectedArtist(null); setSelectedDesign(null); }}
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
                      <Badge variant="outline" className="text-[10px]">Price: x{p.price_multiplier}</Badge>
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
                        {p.specialties.map((s: string) => (
                          <Badge key={s} variant="secondary" className="text-[10px]">{s}</Badge>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Artist Selection */}
          {currentParlour && artists && artists.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                Artists at {currentParlour.name}
                <span className="text-muted-foreground font-normal">— select an artist for quality & price bonuses</span>
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {artists.map(a => (
                  <TattooArtistCard
                    key={a.id}
                    artist={a}
                    selected={selectedArtist?.id === a.id}
                    onSelect={setSelectedArtist}
                    onBookCustom={(artist) => {
                      setCustomArtist(artist);
                      setCustomDialogOpen(true);
                    }}
                  />
                ))}
              </div>
              {selectedArtist && (
                <div className="flex items-center gap-2">
                  <Badge className="text-xs">Artist: {selectedArtist.name}</Badge>
                  <Badge variant="outline" className="text-xs text-green-400 border-green-400/30">+{selectedArtist.quality_bonus} Quality</Badge>
                  <Badge variant="outline" className="text-xs">x{selectedArtist.price_premium} Price</Badge>
                  <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setSelectedArtist(null)}>Clear</Button>
                </div>
              )}
            </div>
          )}

          {/* Design Browser */}
          {currentParlour && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
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
                      parlourPriceMultiplier={currentParlour.price_multiplier * (selectedArtist?.price_premium || 1.0)}
                      selected={selectedDesign?.id === d.id}
                      onSelect={setSelectedDesign}
                      artistSpecialty={selectedArtist?.specialty || undefined}
                    />
                  ))}
                  {filteredDesigns.length === 0 && (
                    <p className="col-span-full text-center text-muted-foreground text-sm py-8">
                      No designs available. You may already have tattoos in all slots.
                    </p>
                  )}
                </div>

                {/* Purchase confirmation */}
                {selectedDesign && (
                  <Card className="border-primary/50">
                    <CardContent className="p-4 space-y-3">
                      <h3 className="font-semibold">Confirm: {selectedDesign.name}</h3>
                      {selectedArtist && (
                        <p className="text-xs text-muted-foreground">
                          Artist: <span className="text-foreground font-medium">{selectedArtist.name}</span>
                          {selectedArtist.specialty === selectedDesign.category && (
                            <Badge variant="secondary" className="ml-2 text-[10px] bg-primary/20 text-primary">Specialty Match +5</Badge>
                          )}
                        </p>
                      )}
                      <div className="grid grid-cols-3 gap-2 text-sm">
                        <div>
                          <span className="text-muted-foreground">Price:</span>
                          <p className="font-bold">${getPrice(selectedDesign.base_price)}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Quality Est:</span>
                          <p className="font-bold">{qualityEstimate()}</p>
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
                          <h4 className="font-semibold text-sm">{t.design?.name || 'Custom Tattoo'}</h4>
                          <div className="flex gap-1">
                            {!t.design && <Badge variant="secondary" className="text-[10px] bg-primary/20 text-primary">Custom</Badge>}
                            {t.is_infected && <Badge variant="destructive" className="text-[10px]">🦠 Infected</Badge>}
                          </div>
                        </div>
                        {(t as any).artist && (
                          <p className="text-[10px] text-muted-foreground">
                            by <span className="text-foreground">{(t as any).artist.name}</span>
                          </p>
                        )}
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

        <TabsContent value="custom" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                Custom Design Commissions
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!customRequests?.length ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  No custom designs yet. Find a famous artist (fame 46+) and book a custom piece!
                </p>
              ) : (
                <div className="space-y-3">
                  {customRequests.map((req: any) => (
                    <Card key={req.id}>
                      <CardContent className="p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <h4 className="font-semibold text-sm">
                            {req.tattoo_artists?.name || 'Unknown Artist'}
                          </h4>
                          <Badge variant={req.status === 'completed' ? 'default' : 'secondary'} className="text-[10px]">
                            {req.status}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground italic">"{req.description}"</p>
                        <div className="flex gap-2">
                          <Badge variant="outline" className="text-[10px]">
                            {BODY_SLOTS[req.body_slot as BodySlot]?.label || req.body_slot}
                          </Badge>
                          <Badge variant="outline" className="text-[10px]">
                            ${req.quoted_price}
                          </Badge>
                          <Badge variant="outline" className="text-[10px] text-green-400 border-green-400/30">
                            Quality: {req.estimated_quality}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Custom Design Dialog */}
      <CustomTattooDialog
        open={customDialogOpen}
        onOpenChange={setCustomDialogOpen}
        artist={customArtist}
        parlourTier={currentParlour?.quality_tier || 3}
        parlourPriceMultiplier={currentParlour?.price_multiplier || 1.0}
        occupiedSlots={occupiedSlots}
        onSubmit={(data) => customMutation.mutate(data)}
        isPending={customMutation.isPending}
      />
    </div>
  );
}
