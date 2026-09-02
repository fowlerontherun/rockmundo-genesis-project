import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { AlertTriangle, Crosshair, Palette, ShieldAlert, Sparkles, Star, Type } from "lucide-react";
import { FMPageScaffold } from "@/components/fm/FMPageScaffold";
import { TattooBodyPreview } from "@/components/tattoo/TattooBodyPreview";
import { TattooDesignCard } from "@/components/tattoo/TattooDesignCard";
import { TattooInfectionAlert } from "@/components/tattoo/TattooInfectionAlert";
import { TattooArtistCard, type TattooArtist } from "@/components/tattoo/TattooArtistCard";
import { CustomTattooDialog } from "@/components/tattoo/CustomTattooDialog";
import { TextTattooCreator } from "@/components/tattoo/TextTattooCreator";
import { TattooArtistMinigame, type TattooMinigameResult } from "@/components/tattoo/TattooArtistMinigame";
import { getFontCss } from "@/data/tattooFonts";
import {
  BODY_SLOTS,
  TATTOO_CATEGORIES,
  CATEGORY_LABELS,
  calculateTattooQuality,
  getTattooDifficulty,
  rollForInfection,
  type BodySlot,
  type TattooCategory,
  type TattooDesign,
  type PlayerTattoo,
} from "@/data/tattooDesigns";

type PurchaseResult = {
  tattoo_id: string;
  price: number;
  quality_score: number;
  is_infected: boolean;
  cash_remaining: number;
};

export default function TattooParlour() {
  const { profileId } = useActiveProfile();
  const queryClient = useQueryClient();
  const [selectedParlour, setSelectedParlour] = useState<string | null>(null);
  const [selectedDesign, setSelectedDesign] = useState<TattooDesign | null>(null);
  const [selectedArtist, setSelectedArtist] = useState<TattooArtist | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<TattooCategory | "all">("all");
  const [selectedSlot, setSelectedSlot] = useState<BodySlot | null>(null);
  const [customDialogOpen, setCustomDialogOpen] = useState(false);
  const [customArtist, setCustomArtist] = useState<TattooArtist | null>(null);
  const [tattooingSession, setTattooingSession] = useState(false);

  const { data: profile } = useQuery({
    queryKey: ["profile-city", profileId],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("current_city_id, cash, user_id").eq("id", profileId!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!profileId,
  });

  const { data: tattooSkillProgress } = useQuery({
    queryKey: ["tattoo-skill-progress", profileId],
    queryFn: async () => {
      const { data } = await (supabase as any).from("skill_progress").select("skill_slug,current_level,current_xp").eq("profile_id", profileId!).like("skill_slug", "tattooing_%");
      return data || [];
    },
    enabled: !!profileId,
  });

  const tattooSkillLevel = useMemo(() => Math.max(0, ...(tattooSkillProgress || []).map((row: any) => Number(row.current_level || 0))), [tattooSkillProgress]);
  const tattooSkillValue = Math.min(1000, Math.round((tattooSkillLevel / 30) * 1000));

  const { data: parlours } = useQuery({
    queryKey: ["tattoo-parlours", profile?.current_city_id],
    queryFn: async () => {
      const { data, error } = await supabase.from("tattoo_parlours").select("*").eq("city_id", profile!.current_city_id);
      if (error) throw error;
      return data || [];
    },
    enabled: !!profile?.current_city_id,
  });

  useEffect(() => {
    if (!selectedParlour && parlours?.length === 1) setSelectedParlour(parlours[0].id);
  }, [parlours, selectedParlour]);

  const { data: artists } = useQuery({
    queryKey: ["tattoo-artists", selectedParlour],
    queryFn: async () => {
      const { data, error } = await supabase.from("tattoo_artists").select("*").eq("parlour_id", selectedParlour!).order("fame_level", { ascending: false });
      if (error) throw error;
      return (data || []) as TattooArtist[];
    },
    enabled: !!selectedParlour,
  });

  const { data: designs } = useQuery({
    queryKey: ["tattoo-designs"],
    queryFn: async () => {
      const { data, error } = await supabase.from("tattoo_designs").select("*");
      if (error) throw error;
      return (data || []) as TattooDesign[];
    },
  });

  const { data: playerTattoos } = useQuery({
    queryKey: ["player-tattoos", profileId],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("player_tattoos").select("*, tattoo_designs(*), tattoo_artists(*)").eq("profile_id", profileId!);
      if (error) throw error;
      return (data || []).map((tattoo: any) => ({ ...tattoo, design: tattoo.tattoo_designs, artist: tattoo.tattoo_artists })) as (PlayerTattoo & { artist?: TattooArtist })[];
    },
    enabled: !!profileId,
  });

  const { data: customRequests } = useQuery({
    queryKey: ["custom-tattoo-requests", profileId],
    queryFn: async () => {
      const { data } = await (supabase as any).from("custom_tattoo_requests").select("*, tattoo_artists(*)").eq("profile_id", profileId!).order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!profileId,
  });

  const currentParlour = parlours?.find((parlour) => parlour.id === selectedParlour);
  const occupiedSlots = new Set(playerTattoos?.map((tattoo) => tattoo.body_slot) || []);
  const filteredDesigns = useMemo(() => {
    if (!designs) return [];
    let filtered = designs;
    if (categoryFilter !== "all") filtered = filtered.filter((design) => design.category === categoryFilter);
    if (selectedSlot) filtered = filtered.filter((design) => design.body_slot === selectedSlot);
    return filtered.filter((design) => !occupiedSlots.has(design.body_slot));
  }, [designs, categoryFilter, selectedSlot, playerTattoos]);

  const getPrice = (basePrice: number) => currentParlour ? Math.round(basePrice * currentParlour.price_multiplier * (selectedArtist?.price_premium || 1)) : basePrice;

  const purchaseMutation = useMutation({
    mutationFn: async (game: TattooMinigameResult) => {
      if (!profileId || !selectedDesign || !currentParlour) throw new Error("Select a parlour and tattoo first");
      const { data, error } = await (supabase as any).rpc("purchase_tattoo", {
        p_profile_id: profileId,
        p_design_id: selectedDesign.id,
        p_parlour_id: currentParlour.id,
        p_artist_id: selectedArtist?.id || null,
        p_game_score: game.score,
        p_game_accuracy: game.accuracy,
        p_game_coverage: game.coverage,
        p_game_mistakes: game.mistakes,
        p_game_difficulty: game.difficulty,
      });
      if (error) throw error;
      return { ...(data as PurchaseResult), game };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["player-tattoos", profileId] });
      queryClient.invalidateQueries({ queryKey: ["profile-city", profileId] });
      queryClient.invalidateQueries({ queryKey: ["tattoo-artists"] });
      setTattooingSession(false);
      setSelectedDesign(null);
      setSelectedSlot(null);
      if (result.is_infected) toast.error(`Tattoo completed but became infected. Execution ${result.game.score}%, quality ${result.quality_score}/100.`);
      else toast.success(`Tattoo complete! Execution ${result.game.score}%, quality ${result.quality_score}/100. Paid $${result.price}.`);
    },
    onError: (error: Error) => toast.error(error.message || "Tattoo purchase failed. No money was taken."),
  });

  const customMutation = useMutation({
    mutationFn: async (data: { description: string; bodySlot: BodySlot; quotedPrice: number; estimatedQuality: number }) => {
      if (!customArtist || !currentParlour || !profileId) throw new Error("Missing data");
      if ((profile?.cash || 0) < data.quotedPrice) throw new Error("Insufficient funds");
      const qualityScore = Math.min(100, calculateTattooQuality(currentParlour.quality_tier) + customArtist.quality_bonus + 10);
      const { error: cashError } = await supabase.from("profiles").update({ cash: (profile?.cash || 0) - data.quotedPrice }).eq("id", profileId);
      if (cashError) throw cashError;
      const { data: tattoo, error } = await (supabase as any).from("player_tattoos").insert({ profile_id: profileId, tattoo_design_id: null, parlour_id: currentParlour.id, artist_id: customArtist.id, body_slot: data.bodySlot, quality_score: qualityScore, ink_color: "#1a1a2e", price_paid: data.quotedPrice, is_infected: false }).select().single();
      if (error) throw error;
      await (supabase as any).from("custom_tattoo_requests").insert({ profile_id: profileId, artist_id: customArtist.id, description: data.description, body_slot: data.bodySlot, status: "completed", quoted_price: data.quotedPrice, estimated_quality: qualityScore, completed_tattoo_id: tattoo.id });
      return { qualityScore, price: data.quotedPrice };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["player-tattoos", profileId] });
      queryClient.invalidateQueries({ queryKey: ["profile-city", profileId] });
      setCustomDialogOpen(false);
      toast.success(`Custom tattoo complete! Quality ${result.qualityScore}/100. Paid $${result.price}.`);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const textTattooMutation = useMutation({
    mutationFn: async (data: { text: string; fontStyle: string; bodySlot: BodySlot; price: number }) => {
      if (!currentParlour || !profileId) throw new Error("Select a parlour first");
      if ((profile?.cash || 0) < data.price) throw new Error("Insufficient funds");
      const qualityScore = Math.min(100, calculateTattooQuality(currentParlour.quality_tier) + (selectedArtist?.quality_bonus || 0));
      const isInfected = rollForInfection(currentParlour.infection_risk);
      const { error: cashError } = await supabase.from("profiles").update({ cash: (profile?.cash || 0) - data.price }).eq("id", profileId);
      if (cashError) throw cashError;
      const { error } = await (supabase as any).from("player_tattoos").insert({ profile_id: profileId, tattoo_design_id: null, parlour_id: currentParlour.id, artist_id: selectedArtist?.id || null, body_slot: data.bodySlot, quality_score: qualityScore, ink_color: "#1a1a2e", price_paid: data.price, is_infected: isInfected, custom_text: data.text, font_style: data.fontStyle });
      if (error) throw error;
      return { qualityScore, isInfected, price: data.price };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["player-tattoos", profileId] });
      queryClient.invalidateQueries({ queryKey: ["profile-city", profileId] });
      result.isInfected ? toast.error(`Text tattoo completed but became infected. Quality ${result.qualityScore}/100.`) : toast.success(`Text tattoo complete! Quality ${result.qualityScore}/100. Paid $${result.price}.`);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const treatMutation = useMutation({
    mutationFn: async (tattooId: string) => {
      if ((profile?.cash || 0) < 200) throw new Error("Need $200 for treatment");
      const { error: cashError } = await supabase.from("profiles").update({ cash: (profile?.cash || 0) - 200 }).eq("id", profileId!);
      if (cashError) throw cashError;
      const { error } = await (supabase as any).from("player_tattoos").update({ is_infected: false, infection_cleared_at: new Date().toISOString() }).eq("id", tattooId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["player-tattoos", profileId] });
      queryClient.invalidateQueries({ queryKey: ["profile-city", profileId] });
      toast.success("Infection treated. $200 paid.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const selectDesign = (design: TattooDesign) => {
    setSelectedDesign(design);
    setSelectedSlot(design.body_slot);
    setTattooingSession(false);
  };

  return (
    <FMPageScaffold title="Tattoo Parlour" subtitle="Choose your ink, then take control of the tattoo machine." icon={Palette} backTo="/hub/character" headerActions={profile?.cash != null ? <Badge variant="outline">${profile.cash.toLocaleString()}</Badge> : null}>
      {playerTattoos && <TattooInfectionAlert tattoos={playerTattoos} onTreat={(id) => treatMutation.mutate(id)} />}

      <Tabs defaultValue="shop">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="shop">🏪 Shop</TabsTrigger>
          <TabsTrigger value="text-tattoo">✍️ Text</TabsTrigger>
          <TabsTrigger value="my-tattoos">🎨 My ({playerTattoos?.length || 0})</TabsTrigger>
          <TabsTrigger value="custom">✨ Custom</TabsTrigger>
        </TabsList>

        <TabsContent value="shop" className="space-y-4">
          {!parlours?.length ? (
            <Card><CardContent className="p-6 text-center text-muted-foreground">No tattoo parlour is available in this city.</CardContent></Card>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              {parlours.map((parlour) => (
                <Card key={parlour.id} className={`cursor-pointer transition-all ${selectedParlour === parlour.id ? "ring-2 ring-primary" : "hover:bg-muted/30"}`} onClick={() => { setSelectedParlour(parlour.id); setSelectedArtist(null); setSelectedDesign(null); setTattooingSession(false); }}>
                  <CardContent className="space-y-2 p-4">
                    <div className="flex items-center justify-between"><h3 className="font-semibold text-sm">{parlour.name}</h3><div className="flex">{Array.from({ length: 5 }).map((_, index) => <Star key={index} className={`h-3.5 w-3.5 ${index < parlour.quality_tier ? "fill-yellow-400 text-yellow-400" : "text-muted"}`} />)}</div></div>
                    <p className="text-xs text-muted-foreground">{parlour.description}</p>
                    <div className="flex gap-2"><Badge variant="outline" className="text-[10px]">Price x{parlour.price_multiplier}</Badge><Badge variant="outline" className="text-[10px]"><ShieldAlert className="mr-1 h-3 w-3" />Risk {Math.round(parlour.infection_risk * 100)}%</Badge></div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {currentParlour && artists && artists.length > 0 && (
            <div className="space-y-2">
              <h3 className="flex items-center gap-2 text-sm font-semibold"><Sparkles className="h-4 w-4 text-primary" />Artists at {currentParlour.name}</h3>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">{artists.map((artist) => <TattooArtistCard key={artist.id} artist={artist} selected={selectedArtist?.id === artist.id} onSelect={setSelectedArtist} onBookCustom={(value) => { setCustomArtist(value); setCustomDialogOpen(true); }} />)}</div>
            </div>
          )}

          {currentParlour && (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <Card><CardHeader className="pb-2"><CardTitle className="text-sm">1. Choose body placement</CardTitle></CardHeader><CardContent><TattooBodyPreview tattoos={playerTattoos || []} selectedSlot={selectedSlot} onSlotClick={(slot) => { setSelectedSlot(slot === selectedSlot ? null : slot); setSelectedDesign(null); }} />{selectedSlot && <Button variant="ghost" size="sm" className="mt-2 w-full" onClick={() => setSelectedSlot(null)}>Show all areas</Button>}</CardContent></Card>

              <div className="space-y-3 lg:col-span-2">
                <div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="font-semibold text-sm">2. Choose a tattoo design</h3><p className="text-xs text-muted-foreground">Selecting a design reveals the mini-game button directly below.</p></div><Badge variant="secondary"><Crosshair className="mr-1 h-3 w-3" />Tattoo skill Lv {tattooSkillLevel}</Badge></div>
                <ScrollArea className="w-full"><div className="flex gap-1.5 pb-2"><Badge variant={categoryFilter === "all" ? "default" : "outline"} className="cursor-pointer" onClick={() => setCategoryFilter("all")}>All</Badge>{TATTOO_CATEGORIES.map((category) => <Badge key={category} variant={categoryFilter === category ? "default" : "outline"} className="cursor-pointer whitespace-nowrap" onClick={() => setCategoryFilter(category)}>{CATEGORY_LABELS[category]}</Badge>)}</div></ScrollArea>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3">{filteredDesigns.map((design) => <TattooDesignCard key={design.id} design={design} parlourPriceMultiplier={currentParlour.price_multiplier * (selectedArtist?.price_premium || 1)} selected={selectedDesign?.id === design.id} onSelect={selectDesign} artistSpecialty={selectedArtist?.specialty || undefined} />)}{filteredDesigns.length === 0 && <p className="col-span-full py-8 text-center text-sm text-muted-foreground">No available designs for this body area/category.</p>}</div>

                {selectedDesign && (
                  <Card className="sticky bottom-3 z-10 border-primary/60 bg-background/95 shadow-xl backdrop-blur">
                    <CardContent className="space-y-3 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-2"><div><p className="text-xs font-medium uppercase tracking-wide text-primary">3. Ready to tattoo</p><h3 className="font-semibold">{selectedDesign.name}</h3><p className="text-xs text-muted-foreground">{BODY_SLOTS[selectedDesign.body_slot].label} · difficulty {getTattooDifficulty(selectedDesign)}/5 · ${getPrice(selectedDesign.base_price)}</p></div><Badge>{CATEGORY_LABELS[selectedDesign.category]}</Badge></div>
                      {currentParlour.infection_risk > 0.15 && <div className="flex items-center gap-2 text-xs text-destructive"><AlertTriangle className="h-3.5 w-3.5" />High infection risk.</div>}
                      <Button size="lg" className="w-full" onClick={() => setTattooingSession(true)} disabled={(profile?.cash || 0) < getPrice(selectedDesign.base_price)}><Crosshair className="mr-2 h-5 w-5" />Get Tattoo — Play Mini-game</Button>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="text-tattoo" className="space-y-4">
          {!currentParlour ? <Card><CardContent className="p-6 text-center text-muted-foreground"><Type className="mx-auto mb-2 h-8 w-8 opacity-50" />Select a parlour first.</CardContent></Card> : <TextTattooCreator parlourPriceMultiplier={currentParlour.price_multiplier} artistPricePremium={selectedArtist?.price_premium || 1} artistName={selectedArtist?.name} occupiedSlots={occupiedSlots} onPurchase={(data) => textTattooMutation.mutate(data)} isPending={textTattooMutation.isPending} playerCash={profile?.cash || 0} />}
        </TabsContent>

        <TabsContent value="my-tattoos" className="space-y-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card><CardHeader><CardTitle className="text-sm">Body Map</CardTitle></CardHeader><CardContent><TattooBodyPreview tattoos={playerTattoos || []} /></CardContent></Card>
            <div className="lg:col-span-2">{!playerTattoos?.length ? <Card><CardContent className="p-6 text-center text-muted-foreground">No tattoos yet.</CardContent></Card> : <div className="grid grid-cols-1 gap-3 md:grid-cols-2">{playerTattoos.map((tattoo) => <Card key={tattoo.id} className={tattoo.is_infected ? "border-destructive/50" : ""}><CardContent className="space-y-2 p-4"><div className="flex items-center justify-between"><h4 className="font-semibold text-sm">{tattoo.custom_text ? `“${tattoo.custom_text}”` : tattoo.design?.name || "Custom Tattoo"}</h4>{tattoo.is_infected && <Badge variant="destructive">Infected</Badge>}</div>{tattoo.custom_text && tattoo.font_style && <div className="rounded bg-muted/50 p-2 text-center" style={getFontCss(tattoo.font_style)}>{tattoo.custom_text}</div>}<div className="flex flex-wrap gap-2"><Badge variant="outline">{BODY_SLOTS[tattoo.body_slot as BodySlot]?.label || tattoo.body_slot}</Badge><Badge variant="outline">Quality {tattoo.quality_score}/100</Badge>{(tattoo as any).minigame_score != null && <Badge variant="outline">Execution {(tattoo as any).minigame_score}%</Badge>}</div></CardContent></Card>)}</div>}</div>
          </div>
        </TabsContent>

        <TabsContent value="custom" className="space-y-4">
          <Card><CardHeader><CardTitle className="flex items-center gap-2 text-sm"><Sparkles className="h-4 w-4 text-primary" />Custom commissions</CardTitle></CardHeader><CardContent>{!customRequests?.length ? <p className="py-6 text-center text-sm text-muted-foreground">No custom designs yet. Choose an artist who accepts custom work.</p> : <div className="space-y-3">{customRequests.map((request: any) => <Card key={request.id}><CardContent className="p-3"><h4 className="font-semibold text-sm">{request.tattoo_artists?.name || "Artist"}</h4><p className="text-xs text-muted-foreground">{request.description}</p></CardContent></Card>)}</div>}</CardContent></Card>
        </TabsContent>
      </Tabs>

      <Dialog open={tattooingSession && !!selectedDesign} onOpenChange={(open) => { if (!purchaseMutation.isPending) setTattooingSession(open); }}>
        <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto">
          <DialogHeader><DialogTitle>Tattoo mini-game</DialogTitle><DialogDescription>Trace the stencil with the tattoo machine. Your result directly affects the finished tattoo quality.</DialogDescription></DialogHeader>
          {selectedDesign && <TattooArtistMinigame difficulty={getTattooDifficulty(selectedDesign)} skillLevel={tattooSkillValue} designName={selectedDesign.name} designCategory={selectedDesign.category} onCancel={() => setTattooingSession(false)} onComplete={(result) => purchaseMutation.mutate(result)} />}
          {purchaseMutation.isPending && <p className="text-center text-sm text-muted-foreground">Saving tattoo and payment together…</p>}
        </DialogContent>
      </Dialog>

      <CustomTattooDialog open={customDialogOpen} onOpenChange={setCustomDialogOpen} artist={customArtist} parlourTier={currentParlour?.quality_tier || 3} parlourPriceMultiplier={currentParlour?.price_multiplier || 1} occupiedSlots={occupiedSlots} onSubmit={(data) => customMutation.mutate(data)} isPending={customMutation.isPending} />
    </FMPageScaffold>
  );
}
