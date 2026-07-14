 import { useState } from "react";
 import { useParams, useNavigate } from "react-router-dom";
 import { useQuery } from "@tanstack/react-query";
 import { supabase } from "@/integrations/supabase/client";
 import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
 import { Button } from "@/components/ui/button";
 import { Badge } from "@/components/ui/badge";
 import { Separator } from "@/components/ui/separator";
 import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
 import { Progress } from "@/components/ui/progress";
  import { 
    ArrowLeft, Calendar, MapPin, Users, Music, Star, Building2, Globe,
    DollarSign, Trophy, Clock, Zap, TrendingUp, Sun, CloudRain, Ticket, Loader2
  } from "lucide-react";
 import { format, formatDistanceToNow, isFuture } from "date-fns";
 import { usePrimaryBand } from "@/hooks/usePrimaryBand";
 import { useFestivalHistory, useFestivalSponsorships, useFestivalRivalries } from "@/hooks/useFestivalHistory";
 import { FestivalRivalryCard } from "@/components/festivals/rivalry/FestivalRivalryCard";
 import { useFestivalTickets } from "@/hooks/useFestivalTickets";
 import { useFestivalStages } from "@/hooks/useFestivalStages";
 import { useFestivalQuality } from "@/hooks/useFestivalFinances";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { FMPageScaffold } from "@/components/fm/FMPageScaffold";
 
 export default function FestivalDetail() {
   const { festivalId } = useParams();
   const navigate = useNavigate();
   const { profileId } = useActiveProfile();
   const { data: primaryBandRecord } = usePrimaryBand();
   const band = primaryBandRecord?.bands;
   const { tickets, hasTicket, hasWeekendPass, purchaseTicket } = useFestivalTickets(festivalId);
   const { data: stages = [] } = useFestivalStages(festivalId);
   const { data: quality } = useFestivalQuality(festivalId);
   const [selectedTicketType, setSelectedTicketType] = useState<"day" | "weekend">("weekend");
   const [selectedDay, setSelectedDay] = useState(1);
   const [selectedAddOns, setSelectedAddOns] = useState<string[]>([]);
 
   // Fetch festival details
   const { data: festival, isLoading } = useQuery({
     queryKey: ["festival-detail", festivalId],
     queryFn: async () => {
       if (!festivalId) return null;
       const { data, error } = await (supabase as any)
         .from("game_events")
         .select(`
           *,
           participants:festival_participants(
             id, band_id, slot_type, status, payout_amount, stage_name,
             band:bands(id, name, genre, fame)
           )
         `)
         .eq("id", festivalId)
         .single();
       if (error) throw error;
       return data;
     },
     enabled: !!festivalId,
   });
 
    const { data: sponsorships } = useFestivalSponsorships(festivalId);
    const { data: rivalries } = useFestivalRivalries(festivalId, band?.id);

    // Venue + city map data
    const { data: venueInfo } = useQuery({
      queryKey: ["festival-venue-city", festival?.venue_id],
      queryFn: async () => {
        if (!festival?.venue_id) return null;
        const { data: venue, error } = await (supabase as any)
          .from("venues")
          .select("id, name, location, capacity, venue_type, prestige_level, description, image_url, sound_system_rating, lighting_rating, has_green_room, parking_spaces, city_id")
          .eq("id", festival.venue_id)
          .maybeSingle();
        if (error) throw error;
        if (!venue) return null;
        let city: any = null;
        if (venue.city_id) {
          const { data: c } = await (supabase as any)
            .from("cities")
            .select("id, name, country, region, latitude, longitude, population, music_scene, dominant_genre")
            .eq("id", venue.city_id)
            .maybeSingle();
          city = c;
        }
        return { venue, city };
      },
      enabled: !!festival?.venue_id,
    });
 
   // Calculate genre match
   const calculateGenreMatch = () => {
     if (!band?.genre || !festival?.metadata?.genres) return 0;
     const festivalGenres = festival.metadata.genres || [];
     if (festivalGenres.includes(band.genre)) return 100;
     // Partial match logic
     const genreMap: Record<string, string[]> = {
       rock: ["alternative", "indie", "punk", "metal"],
       pop: ["dance", "electronic", "rnb"],
       metal: ["rock", "hardcore", "punk"],
       electronic: ["dance", "techno", "house", "pop"],
     };
     const related = genreMap[band.genre.toLowerCase()] || [];
     const matchFound = festivalGenres.some((g: string) => related.includes(g.toLowerCase()));
     return matchFound ? 60 : 20;
   };
 
   const genreMatch = calculateGenreMatch();
 
  if (isLoading) {
    return (
      <FMPageScaffold title="Festival" icon={Music} backTo="/festivals">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3" />
          <div className="h-64 bg-muted rounded" />
        </div>
      </FMPageScaffold>
    );
  }

  if (!festival) {
    return (
      <FMPageScaffold title="Festival" icon={Music} backTo="/festivals">
        <div className="text-center py-8">
          <Music className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-xl font-semibold mb-4">Festival Not Found</h2>
          <Button onClick={() => navigate("/festivals")}>Back to Festivals</Button>
        </div>
      </FMPageScaffold>
    );
  }

  const isUpcoming = isFuture(new Date(festival.start_date));
  const confirmedActs = festival.participants?.filter((p: any) =>
    p.status === "confirmed" || p.status === "invited"
  ) || [];
  const headliners = confirmedActs.filter((p: any) => p.slot_type === "headline");
  const mainActs = confirmedActs.filter((p: any) => p.slot_type === "main");
  const supportActs = confirmedActs.filter((p: any) => p.slot_type === "support" || p.slot_type === "opening");

  return (
    <FMPageScaffold
      title={festival.title}
      subtitle={`${festival.location} • ${format(new Date(festival.start_date), "MMM d")} - ${format(new Date(festival.end_date), "MMM d, yyyy")}${isUpcoming ? ` • ${formatDistanceToNow(new Date(festival.start_date), { addSuffix: true })}` : ""}`}
      icon={Music}
      backTo="/festivals"
      headerActions={
        <Button size="sm" onClick={() => navigate(`/festivals`)}>
          Apply
        </Button>
      }
    >

 
       {/* Stats Overview */}
       <div className="grid gap-4 md:grid-cols-4">
         <Card>
           <CardContent className="pt-6">
             <div className="flex items-center gap-3">
               <Users className="h-8 w-8 text-primary" />
               <div>
                 <p className="text-sm text-muted-foreground">Attendance</p>
                 <p className="text-2xl font-bold">{(festival.attendance_projection || 50000).toLocaleString()}</p>
               </div>
             </div>
           </CardContent>
         </Card>
         <Card>
           <CardContent className="pt-6">
             <div className="flex items-center gap-3">
               <Music className="h-8 w-8 text-primary" />
               <div>
                 <p className="text-sm text-muted-foreground">Stages</p>
                 <p className="text-2xl font-bold">{festival.total_stages || 3}</p>
               </div>
             </div>
           </CardContent>
         </Card>
         <Card>
           <CardContent className="pt-6">
             <div className="flex items-center gap-3">
               <TrendingUp className="h-8 w-8 text-primary" />
               <div>
                 <p className="text-sm text-muted-foreground">Genre Match</p>
                 <p className="text-2xl font-bold">{genreMatch}%</p>
               </div>
             </div>
           </CardContent>
         </Card>
         <Card>
           <CardContent className="pt-6">
             <div className="flex items-center gap-3">
               {festival.weather_forecast === "sunny" ? (
                 <Sun className="h-8 w-8 text-yellow-500" />
               ) : (
                 <CloudRain className="h-8 w-8 text-blue-400" />
               )}
               <div>
                 <p className="text-sm text-muted-foreground">Weather</p>
                 <p className="text-2xl font-bold capitalize">{festival.weather_forecast || "Clear"}</p>
               </div>
             </div>
           </CardContent>
         </Card>
       </div>
 
        <Tabs defaultValue="lineup" className="w-full">
          <TabsList className="grid w-full max-w-2xl grid-cols-5">
            <TabsTrigger value="lineup">Lineup</TabsTrigger>
            <TabsTrigger value="venue" className="flex items-center gap-1">
              <MapPin className="h-3 w-3" /> Venue
            </TabsTrigger>
            <TabsTrigger value="tickets" className="flex items-center gap-1">
              <Ticket className="h-3 w-3" /> Tickets
            </TabsTrigger>
            <TabsTrigger value="sponsors">Sponsors</TabsTrigger>
            <TabsTrigger value="rivalries">Rivalries</TabsTrigger>
          </TabsList>
 
         {/* Lineup Tab */}
         <TabsContent value="lineup" className="mt-6 space-y-6">
           {/* Headliners */}
           {headliners.length > 0 && (
             <div>
               <h3 className="text-xl font-bold mb-3 flex items-center gap-2">
                 <Trophy className="h-5 w-5 text-yellow-500" />
                 Headliners
               </h3>
               <div className="grid gap-3 md:grid-cols-2">
                 {headliners.map((p: any) => (
                   <Card key={p.id} className="border-yellow-500/30">
                     <CardContent className="p-4 flex items-center justify-between">
                       <div>
                         <p className="font-bold text-lg">{p.band?.name || "TBA"}</p>
                         <p className="text-sm text-muted-foreground">{p.band?.genre}</p>
                       </div>
                       <Badge className="bg-yellow-500">Headline</Badge>
                     </CardContent>
                   </Card>
                 ))}
               </div>
             </div>
           )}
 
           {/* Main Stage */}
           {mainActs.length > 0 && (
             <div>
               <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                 <Star className="h-5 w-5 text-primary" />
                 Main Stage
               </h3>
               <div className="grid gap-2 md:grid-cols-3">
                 {mainActs.map((p: any) => (
                   <Card key={p.id}>
                     <CardContent className="p-3 flex items-center justify-between">
                       <div>
                         <p className="font-medium">{p.band?.name || "TBA"}</p>
                         <p className="text-xs text-muted-foreground">{p.band?.genre}</p>
                       </div>
                       <Badge variant="secondary">Main</Badge>
                     </CardContent>
                   </Card>
                 ))}
               </div>
             </div>
           )}
 
           {/* Support Acts */}
           {supportActs.length > 0 && (
             <div>
               <h3 className="text-lg font-semibold mb-3">Support & Opening Acts</h3>
               <div className="grid gap-2 md:grid-cols-4">
                 {supportActs.map((p: any) => (
                   <Card key={p.id}>
                     <CardContent className="p-2 text-sm">
                       <p className="font-medium">{p.band?.name || "TBA"}</p>
                       <p className="text-xs text-muted-foreground">{p.slot_type}</p>
                     </CardContent>
                   </Card>
                 ))}
               </div>
             </div>
           )}
 
           {confirmedActs.length === 0 && (
             <div className="text-center py-12 text-muted-foreground">
               <Music className="h-12 w-12 mx-auto mb-4 opacity-50" />
               <p>Lineup to be announced</p>
             </div>
           )}
          </TabsContent>

          {/* Venue Tab */}
          <TabsContent value="venue" className="mt-6 space-y-4">
            {venueInfo ? (
              <div className="grid gap-4 lg:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Building2 className="h-5 w-5 text-primary" />
                      {venueInfo.venue.name}
                    </CardTitle>
                    <CardDescription className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {venueInfo.city ? `${venueInfo.city.name}, ${venueInfo.city.country}` : venueInfo.venue.location}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    {venueInfo.venue.image_url && (
                      <img
                        src={venueInfo.venue.image_url}
                        alt={venueInfo.venue.name}
                        className="w-full h-40 object-cover rounded-md border border-border/40"
                      />
                    )}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-xs text-muted-foreground">Type</p>
                        <p className="font-medium capitalize">{venueInfo.venue.venue_type || "—"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Capacity</p>
                        <p className="font-medium">{(venueInfo.venue.capacity ?? 0).toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Prestige</p>
                        <p className="font-medium">Tier {venueInfo.venue.prestige_level ?? 1}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Parking</p>
                        <p className="font-medium">{venueInfo.venue.parking_spaces ?? 0} spaces</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Sound</p>
                        <p className="font-medium">{venueInfo.venue.sound_system_rating ?? 0}/100</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Lighting</p>
                        <p className="font-medium">{venueInfo.venue.lighting_rating ?? 0}/100</p>
                      </div>
                    </div>
                    {venueInfo.venue.description && (
                      <>
                        <Separator />
                        <p className="text-muted-foreground">{venueInfo.venue.description}</p>
                      </>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Globe className="h-5 w-5 text-primary" />
                      City Map
                    </CardTitle>
                    <CardDescription>
                      {venueInfo.city
                        ? `${venueInfo.city.name} • pop. ${(venueInfo.city.population ?? 0).toLocaleString()} • scene ${venueInfo.city.music_scene ?? 0}/100`
                        : "Location marker"}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {venueInfo.city?.latitude != null && venueInfo.city?.longitude != null ? (
                      <div className="space-y-2">
                        <div className="aspect-video overflow-hidden rounded-md border border-border/40">
                          <iframe
                            title={`${venueInfo.city.name} map`}
                            width="100%"
                            height="100%"
                            loading="lazy"
                            referrerPolicy="no-referrer-when-downgrade"
                            src={`https://www.openstreetmap.org/export/embed.html?bbox=${Number(venueInfo.city.longitude) - 0.15}%2C${Number(venueInfo.city.latitude) - 0.1}%2C${Number(venueInfo.city.longitude) + 0.15}%2C${Number(venueInfo.city.latitude) + 0.1}&layer=mapnik&marker=${venueInfo.city.latitude}%2C${venueInfo.city.longitude}`}
                          />
                        </div>
                        <a
                          className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                          href={`https://www.openstreetmap.org/?mlat=${venueInfo.city.latitude}&mlon=${venueInfo.city.longitude}#map=12/${venueInfo.city.latitude}/${venueInfo.city.longitude}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <MapPin className="h-3 w-3" /> Open larger map
                        </a>
                        {venueInfo.city.dominant_genre && (
                          <Badge variant="outline" className="capitalize">Scene: {venueInfo.city.dominant_genre}</Badge>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No coordinates on file for this city.</p>
                    )}
                  </CardContent>
                </Card>
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <MapPin className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Venue details are not available for this festival.</p>
                {festival.location && (
                  <p className="text-sm mt-1">Location on record: {festival.location}</p>
                )}
              </div>
            )}
          </TabsContent>



          {/* Tickets Tab */}
          <TabsContent value="tickets" className="mt-6">
            {isUpcoming ? (() => {
              const basePrice = festival.ticket_price || 100;
              const dayPrice = Math.round(basePrice * 0.45);
              const weekendPrice = basePrice;
              
              const ADD_ONS = [
                { id: "early_access", label: "Early Access", description: "Enter 2 hours before general admission", price: Math.round(basePrice * 0.15) },
                { id: "vip_camping", label: "VIP Camping", description: "Premium campsite with showers & charging", price: Math.round(basePrice * 0.4) },
                { id: "glamping", label: "Glamping", description: "Pre-pitched luxury tent with bedding", price: Math.round(basePrice * 0.7) },
                { id: "backstage", label: "Backstage Pass", description: "Meet artists backstage between sets", price: Math.round(basePrice * 0.5) },
              ];
              
              const addOnTotal = selectedAddOns.reduce((sum, id) => {
                const addOn = ADD_ONS.find(a => a.id === id);
                return sum + (addOn?.price || 0);
              }, 0);
              
              const ticketBase = selectedTicketType === 'weekend' ? weekendPrice : dayPrice;
              const totalPrice = ticketBase + addOnTotal;
              
              return (
                <Card className="border-primary/30">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Ticket className="h-5 w-5 text-primary" />
                      Buy Tickets
                    </CardTitle>
                    <CardDescription>
                      {hasTicket 
                        ? hasWeekendPass 
                          ? "You have a weekend pass for this festival!" 
                          : "You have a day ticket. Upgrade to a weekend pass?"
                        : "Purchase tickets to attend this festival"}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {hasWeekendPass ? (
                      <Badge className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        ✓ Weekend Pass Holder
                      </Badge>
                    ) : (
                      <>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <Card className={`cursor-pointer transition-colors ${selectedTicketType === 'day' ? 'border-primary ring-1 ring-primary/30' : 'hover:border-primary/40'}`}
                            onClick={() => setSelectedTicketType('day')}>
                            <CardContent className="p-4 text-center">
                              <p className="font-bold text-lg">Day Ticket</p>
                              <p className="text-2xl font-bold text-primary mt-1">${dayPrice.toLocaleString()}</p>
                              <p className="text-xs text-muted-foreground mt-1">Access for one day</p>
                            </CardContent>
                          </Card>
                          <Card className={`cursor-pointer transition-colors ${selectedTicketType === 'weekend' ? 'border-primary ring-1 ring-primary/30' : 'hover:border-primary/40'}`}
                            onClick={() => setSelectedTicketType('weekend')}>
                            <CardContent className="p-4 text-center">
                              <p className="font-bold text-lg">Weekend Pass</p>
                              <p className="text-2xl font-bold text-primary mt-1">${weekendPrice.toLocaleString()}</p>
                              <p className="text-xs text-muted-foreground mt-1">Full festival access</p>
                            </CardContent>
                          </Card>
                        </div>
                        
                        <Separator />
                        <div>
                          <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                            <Zap className="h-4 w-4 text-primary" />
                            Add-Ons
                          </h4>
                          <div className="grid gap-2 sm:grid-cols-2">
                            {ADD_ONS.map(addOn => {
                              const isSelected = selectedAddOns.includes(addOn.id);
                              const isDisabled = (addOn.id === 'glamping' && selectedAddOns.includes('vip_camping')) ||
                                                (addOn.id === 'vip_camping' && selectedAddOns.includes('glamping'));
                              return (
                                <Card 
                                  key={addOn.id}
                                  className={`cursor-pointer transition-colors ${isSelected ? 'border-primary bg-primary/5' : isDisabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-primary/40'}`}
                                  onClick={() => {
                                    if (isDisabled) return;
                                    setSelectedAddOns(prev => 
                                      isSelected ? prev.filter(id => id !== addOn.id) : [...prev, addOn.id]
                                    );
                                  }}
                                >
                                  <CardContent className="p-3 flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                      <p className="font-medium text-sm">{addOn.label}</p>
                                      <p className="text-xs text-muted-foreground">{addOn.description}</p>
                                    </div>
                                    <span className="text-sm font-bold text-primary shrink-0">+${addOn.price}</span>
                                  </CardContent>
                                </Card>
                              );
                            })}
                          </div>
                        </div>
                        
                        <Separator />
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-muted-foreground">Total</p>
                            <p className="text-2xl font-bold">${totalPrice.toLocaleString()}</p>
                          </div>
                          <Button 
                            size="lg"
                            disabled={purchaseTicket.isPending}
                            onClick={() => {
                              if (!festivalId) return;
                              purchaseTicket.mutate({
                                festivalId,
                                ticketType: selectedTicketType,
                                price: totalPrice,
                                dayNumber: selectedTicketType === 'day' ? selectedDay : undefined,
                                festivalTitle: festival.title,
                                festivalStart: festival.start_date,
                                festivalEnd: festival.end_date,
                              });
                            }}
                          >
                            {purchaseTicket.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            ) : (
                              <Ticket className="h-4 w-4 mr-2" />
                            )}
                            Buy {selectedTicketType === 'weekend' ? 'Weekend Pass' : 'Day Ticket'}
                          </Button>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              );
            })() : (
              <div className="text-center py-12 text-muted-foreground">
                <Ticket className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Tickets are not available for past festivals</p>
              </div>
            )}
          </TabsContent>
 
         {/* Sponsors Tab */}
         <TabsContent value="sponsors" className="mt-6">
           {sponsorships && sponsorships.length > 0 ? (
             <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
               {sponsorships.map((s: any) => (
                 <Card key={s.id}>
                   <CardContent className="p-4">
                     <div className="flex items-center justify-between mb-2">
                       <p className="font-bold">{s.brand?.name}</p>
                       <Badge variant="outline" className="capitalize">{s.sponsorship_type}</Badge>
                     </div>
                     <div className="space-y-1 text-sm text-muted-foreground">
                       {s.fame_modifier !== 1 && (
                         <p className="flex items-center gap-1">
                           <Star className="h-3 w-3" />
                           Fame: +{Math.round((s.fame_modifier - 1) * 100)}%
                         </p>
                       )}
                       {s.merch_sales_modifier !== 1 && (
                         <p className="flex items-center gap-1">
                           <DollarSign className="h-3 w-3" />
                           Merch: +{Math.round((s.merch_sales_modifier - 1) * 100)}%
                         </p>
                       )}
                     </div>
                   </CardContent>
                 </Card>
               ))}
             </div>
           ) : (
             <div className="text-center py-12 text-muted-foreground">
               <p>No sponsors announced yet</p>
             </div>
           )}
         </TabsContent>
 
         {/* Rivalries Tab */}
         <TabsContent value="rivalries" className="mt-6">
           {rivalries && rivalries.length > 0 ? (
             <div className="grid gap-4 md:grid-cols-2">
               {rivalries.map((r: any) => (
                 <FestivalRivalryCard key={r.id} rivalry={r} currentBandId={band?.id} />
               ))}
             </div>
           ) : (
             <div className="text-center py-12 text-muted-foreground">
               <Trophy className="h-12 w-12 mx-auto mb-4 opacity-50" />
               <p>No active rivalries at this festival</p>
               <p className="text-sm mt-1">Rivalries form when similar bands compete in the same slot</p>
             </div>
           )}
         </TabsContent>
       </Tabs>


 
       {/* Description */}
       {festival.description && (
         <Card>
           <CardHeader>
             <CardTitle>About</CardTitle>
           </CardHeader>
           <CardContent>
             <p className="text-muted-foreground">{festival.description}</p>
           </CardContent>
         </Card>
       )}
    </FMPageScaffold>
   );
 }