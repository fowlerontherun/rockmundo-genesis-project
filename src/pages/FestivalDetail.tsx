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
   ArrowLeft, Calendar, MapPin, Users, Music, Star, 
   DollarSign, Trophy, Clock, Zap, TrendingUp, Sun, CloudRain, Ticket, Loader2
 } from "lucide-react";
 import { format, formatDistanceToNow, isFuture } from "date-fns";
 import { usePrimaryBand } from "@/hooks/usePrimaryBand";
 import { useFestivalHistory, useFestivalSponsorships, useFestivalRivalries } from "@/hooks/useFestivalHistory";
 import { FestivalRivalryCard } from "@/components/festivals/rivalry/FestivalRivalryCard";
 import { useFestivalTickets } from "@/hooks/useFestivalTickets";
 import { useFestivalStages } from "@/hooks/useFestivalStages";
 import { useFestivalQuality } from "@/hooks/useFestivalFinances";
 import { useAuth } from "@/hooks/use-auth-context";
 
 export default function FestivalDetail() {
   const { festivalId } = useParams();
   const navigate = useNavigate();
   const { user } = useAuth();
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
       <div className="container mx-auto py-8">
         <div className="animate-pulse space-y-4">
           <div className="h-8 bg-muted rounded w-1/3" />
           <div className="h-64 bg-muted rounded" />
         </div>
       </div>
     );
   }
 
   if (!festival) {
     return (
       <div className="container mx-auto py-8 text-center">
         <Music className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
         <h2 className="text-xl font-semibold mb-4">Festival Not Found</h2>
         <Button onClick={() => navigate("/festivals")}>Back to Festivals</Button>
       </div>
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
     <div className="container mx-auto py-8 space-y-6">
       {/* Header */}
       <div className="flex items-start gap-4">
         <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
           <ArrowLeft className="h-4 w-4" />
         </Button>
         <div className="flex-1">
           <h1 className="text-3xl font-bold">{festival.title}</h1>
           <div className="flex flex-wrap items-center gap-4 mt-2 text-muted-foreground">
             <span className="flex items-center gap-1">
               <MapPin className="h-4 w-4" />
               {festival.location}
             </span>
             <span className="flex items-center gap-1">
               <Calendar className="h-4 w-4" />
               {format(new Date(festival.start_date), "MMM d")} - {format(new Date(festival.end_date), "MMM d, yyyy")}
             </span>
             {isUpcoming && (
               <Badge variant="secondary">
                 {formatDistanceToNow(new Date(festival.start_date), { addSuffix: true })}
               </Badge>
             )}
           </div>
         </div>
         <Button onClick={() => navigate(`/festivals`)}>
           Apply
         </Button>
       </div>
 
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
          <TabsList className="grid w-full max-w-lg grid-cols-4">
            <TabsTrigger value="lineup">Lineup</TabsTrigger>
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
     </div>
   );
 }