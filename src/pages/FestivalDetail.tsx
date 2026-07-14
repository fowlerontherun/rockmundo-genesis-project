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
     DollarSign, Trophy, Clock, Zap, TrendingUp, Sun, CloudRain, Ticket, Loader2,
     Car, Bus, Accessibility, Wifi, Utensils, ShieldCheck, PawPrint, CreditCard,
     Wine, DoorOpen, Mic2, CheckCircle2, XCircle
   } from "lucide-react";
 import { format, formatDistanceToNow, isFuture } from "date-fns";
 import { usePrimaryBand } from "@/hooks/usePrimaryBand";
 import { useFestivalHistory, useFestivalSponsorships, useFestivalRivalries } from "@/hooks/useFestivalHistory";
 import { FestivalRivalryCard } from "@/components/festivals/rivalry/FestivalRivalryCard";
 import { useFestivalTickets } from "@/hooks/useFestivalTickets";
 import { useFestivalStages, useFestivalStageSlots, type FestivalStageSlot } from "@/hooks/useFestivalStages";
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
  const { data: stageSlots = [] } = useFestivalStageSlots(festivalId);
   const { data: quality } = useFestivalQuality(festivalId);
   const [selectedTicketType, setSelectedTicketType] = useState<"day" | "weekend">("weekend");
   const [selectedDay, setSelectedDay] = useState(1);
   const [selectedAddOns, setSelectedAddOns] = useState<string[]>([]);
   const [selectedTier, setSelectedTier] = useState<"general" | "vip" | "premium">("general");
   const [activeTab, setActiveTab] = useState<string>("lineup");

   const TIERS = [
     { id: "general" as const, label: "General Admission", multiplier: 1, perks: "Standard festival access" },
     { id: "vip" as const, label: "VIP", multiplier: 1.75, perks: "VIP lounge, dedicated bars & viewing decks" },
     { id: "premium" as const, label: "Premium", multiplier: 3, perks: "All VIP perks + backstage & artist meet-and-greets" },
   ];
 
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
          .select("id, name, location, capacity, venue_type, prestige_level, description, image_url, sound_system_rating, lighting_rating, has_green_room, has_recording_capability, alcohol_license, backstage_quality, parking_spaces, amenities, city_id")
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
        <div className="flex items-center gap-2">
          {festival?.owner_profile_id && profileId === festival.owner_profile_id && (
            <Button size="sm" variant="default" onClick={() => navigate(`/festivals/${festivalId}/run`)}>
              Run Festival
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => navigate(`/festivals/${festivalId}/calendar`)}>
            <Calendar className="h-4 w-4 mr-1" /> Calendar
          </Button>
          <Button size="sm" onClick={() => navigate(`/festivals`)}>Apply</Button>
        </div>
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
           {/* Stage-by-stage schedule */}
           {stages.length > 0 && stageSlots.length > 0 ? (
             (() => {
               const days = Array.from(new Set(stageSlots.map(s => s.day_number))).sort((a, b) => a - b);
               const festivalStart = new Date(festival.start_date);
               const fmtTime = (iso: string | null) => {
                 if (!iso) return "TBA";
                 try { return format(new Date(iso), "HH:mm"); } catch { return "TBA"; }
               };
               const durationMin = (start: string | null, end: string | null) => {
                 if (!start || !end) return null;
                 const ms = new Date(end).getTime() - new Date(start).getTime();
                 if (!Number.isFinite(ms) || ms <= 0) return null;
                 return Math.round(ms / 60000);
               };
               const slotBadge = (t: string) => {
                 if (t === "headliner") return <Badge className="bg-yellow-500">Headliner</Badge>;
                 if (t === "support") return <Badge variant="secondary">Support</Badge>;
                 if (t === "dj_session") return <Badge variant="outline">DJ Set</Badge>;
                 return <Badge variant="outline">Opener</Badge>;
               };
               const performerName = (s: FestivalStageSlot) => {
                 if (s.band?.name) return s.band.name;
                 if (s.is_npc_dj) return s.npc_dj_name || "NPC DJ";
                 return "TBA";
               };

               return (
                 <div className="space-y-6">
                   {days.map(day => {
                     const dayDate = new Date(festivalStart);
                     dayDate.setDate(dayDate.getDate() + (day - 1));
                     return (
                       <div key={day} className="space-y-3">
                         <div className="flex items-center gap-2 border-b border-border/40 pb-2">
                           <Calendar className="h-4 w-4 text-primary" />
                           <h3 className="text-lg font-semibold">
                             Day {day} <span className="text-muted-foreground font-normal">— {format(dayDate, "EEE, MMM d")}</span>
                           </h3>
                         </div>
                         <div className="grid gap-4 lg:grid-cols-2">
                           {stages.map(stage => {
                             const slots = stageSlots
                               .filter(s => s.stage_id === stage.id && s.day_number === day)
                               .sort((a, b) => {
                                 if (a.start_time && b.start_time) {
                                   return new Date(a.start_time).getTime() - new Date(b.start_time).getTime();
                                 }
                                 return a.slot_number - b.slot_number;
                               });
                             if (slots.length === 0) return null;
                             return (
                               <Card key={stage.id}>
                                 <CardHeader className="pb-3">
                                   <CardTitle className="flex items-center justify-between text-base">
                                     <span className="flex items-center gap-2">
                                       <Music className="h-4 w-4 text-primary" />
                                       {stage.stage_name}
                                     </span>
                                     <span className="text-xs font-normal text-muted-foreground">
                                       Cap {stage.capacity.toLocaleString()}
                                       {stage.genre_focus ? ` • ${stage.genre_focus}` : ""}
                                     </span>
                                   </CardTitle>
                                 </CardHeader>
                                 <CardContent className="p-0">
                                   <ul className="divide-y divide-border/40">
                                     {slots.map(slot => {
                                       const dur = durationMin(slot.start_time, slot.end_time);
                                       return (
                                         <li key={slot.id} className="flex items-center gap-3 px-4 py-2.5">
                                           <div className="w-20 shrink-0 font-mono text-sm">
                                             <div>{fmtTime(slot.start_time)}</div>
                                             {dur != null && (
                                               <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                                                 <Clock className="h-2.5 w-2.5" /> {dur}m
                                               </div>
                                             )}
                                           </div>
                                           <div className="flex-1 min-w-0">
                                             <p className="font-medium truncate">{performerName(slot)}</p>
                                             {slot.is_npc_dj && slot.npc_dj_genre && (
                                               <p className="text-xs text-muted-foreground truncate">
                                                 {slot.npc_dj_genre} • Q{slot.npc_dj_quality}
                                               </p>
                                             )}
                                             {slot.end_time && (
                                               <p className="text-[10px] text-muted-foreground">
                                                 {fmtTime(slot.start_time)} – {fmtTime(slot.end_time)}
                                               </p>
                                             )}
                                           </div>
                                           {slotBadge(slot.slot_type)}
                                         </li>
                                       );
                                     })}
                                   </ul>
                                 </CardContent>
                               </Card>
                             );
                           })}
                         </div>
                       </div>
                     );
                   })}
                 </div>
               );
             })()
           ) : (
             <>
               {/* Fallback: legacy participant grouping */}
               {headliners.length > 0 && (
                 <div>
                   <h3 className="text-xl font-bold mb-3 flex items-center gap-2">
                     <Trophy className="h-5 w-5 text-yellow-500" /> Headliners
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
               {mainActs.length > 0 && (
                 <div>
                   <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                     <Star className="h-5 w-5 text-primary" /> Main Stage
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
             </>
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

                {/* Amenities & Access */}
                {(() => {
                  const v = venueInfo.venue;
                  const rawAmen = v.amenities;
                  const amenList: string[] = Array.isArray(rawAmen)
                    ? rawAmen.map((x: any) => String(x).toLowerCase())
                    : rawAmen && typeof rawAmen === 'object'
                      ? Object.keys(rawAmen).filter(k => (rawAmen as any)[k]).map(k => k.toLowerCase())
                      : typeof rawAmen === 'string'
                        ? rawAmen.split(/[,;]/).map(s => s.trim().toLowerCase()).filter(Boolean)
                        : [];
                  const hasAmen = (needles: string[]) => needles.some(n => amenList.some(a => a.includes(n)));
                  const pop = Number(venueInfo.city?.population ?? 0);
                  const transitTier = pop >= 3_000_000 ? 'Metro, bus & rail hub' : pop >= 800_000 ? 'City bus & light rail' : pop >= 200_000 ? 'Regional bus network' : 'Limited local bus service';
                  const parking = Number(v.parking_spaces ?? 0);
                  const parkingLabel = parking >= 2000 ? 'On-site mega lot' : parking >= 500 ? 'Large on-site lot' : parking >= 100 ? 'On-site parking' : parking > 0 ? 'Limited parking' : 'Street parking only';
                  const wheelchair = hasAmen(['wheelchair','ada','accessible','disabled']) || (v.prestige_level ?? 0) >= 3;
                  const stepFree = hasAmen(['step-free','ramp','elevator','lift']) || wheelchair;
                  const hearingLoop = hasAmen(['hearing','loop','assistive']);
                  const accessibleRestrooms = hasAmen(['accessible restroom','ada restroom']) || wheelchair;
                  const bikeParking = hasAmen(['bike','cycle','bicycle']);
                  const rideshare = pop >= 200_000;
                  const wifi = hasAmen(['wifi','wi-fi','internet']) || (v.prestige_level ?? 0) >= 2;
                  const food = hasAmen(['food','concession','catering','bar','restaurant']);
                  const security = (v.prestige_level ?? 0) >= 2 || hasAmen(['security']);
                  const familyArea = hasAmen(['family','kids','child']);
                  const cashless = hasAmen(['cashless','contactless','card']) || (v.prestige_level ?? 0) >= 3;

                  const Item = ({ icon: Icon, label, value, ok }: { icon: any; label: string; value: string; ok?: boolean }) => (
                    <div className="flex items-start gap-2 rounded-md border border-border/40 bg-card/40 p-2">
                      <Icon className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                      <div className="min-w-0">
                        <div className="text-xs text-muted-foreground flex items-center gap-1">
                          {label}
                          {ok === true && <CheckCircle2 className="h-3 w-3 text-emerald-500" />}
                          {ok === false && <XCircle className="h-3 w-3 text-muted-foreground/60" />}
                        </div>
                        <div className="text-sm font-medium truncate">{value}</div>
                      </div>
                    </div>
                  );

                  return (
                    <Card className="lg:col-span-2">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Accessibility className="h-5 w-5 text-primary" /> Amenities & Access
                        </CardTitle>
                        <CardDescription>Parking, transit, accessibility, and on-site services</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div>
                          <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Getting there</p>
                          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                            <Item icon={Car} label="Parking" value={`${parkingLabel}${parking ? ` • ${parking.toLocaleString()} spaces` : ''}`} ok={parking > 0} />
                            <Item icon={Bus} label="Public transit" value={transitTier} ok={pop >= 200_000} />
                            <Item icon={CreditCard} label="Rideshare drop-off" value={rideshare ? 'Dedicated zone' : 'Curbside only'} ok={rideshare} />
                            <Item icon={PawPrint} label="Bike parking" value={bikeParking ? 'Racks on-site' : 'Not provided'} ok={bikeParking} />
                          </div>
                        </div>

                        <Separator />

                        <div>
                          <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Accessibility</p>
                          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                            <Item icon={Accessibility} label="Wheelchair access" value={wheelchair ? 'Full venue access' : 'Limited access'} ok={wheelchair} />
                            <Item icon={DoorOpen} label="Step-free routes" value={stepFree ? 'Ramps & lifts' : 'Steps present'} ok={stepFree} />
                            <Item icon={Mic2} label="Hearing assistance" value={hearingLoop ? 'Loop system available' : 'Not available'} ok={hearingLoop} />
                            <Item icon={Accessibility} label="Accessible restrooms" value={accessibleRestrooms ? 'Available' : 'Standard only'} ok={accessibleRestrooms} />
                          </div>
                        </div>

                        <Separator />

                        <div>
                          <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">On-site services</p>
                          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                            <Item icon={Utensils} label="Food & drink" value={food ? 'Concessions & bars' : 'Bring your own'} ok={food} />
                            <Item icon={Wine} label="Alcohol licence" value={v.alcohol_license ? 'Licensed venue' : 'Dry venue'} ok={!!v.alcohol_license} />
                            <Item icon={Wifi} label="Wi-Fi" value={wifi ? 'Public Wi-Fi' : 'Not provided'} ok={wifi} />
                            <Item icon={CreditCard} label="Payments" value={cashless ? 'Cashless / contactless' : 'Cash & card'} ok={cashless} />
                            <Item icon={ShieldCheck} label="Security" value={security ? 'Trained team on-site' : 'Basic cover'} ok={security} />
                            <Item icon={Users} label="Family area" value={familyArea ? 'Kids zone' : 'Adult-focused'} ok={familyArea} />
                            <Item icon={Building2} label="Green room" value={v.has_green_room ? 'Artist green room' : 'Shared backstage'} ok={!!v.has_green_room} />
                            <Item icon={Mic2} label="Recording capable" value={v.has_recording_capability ? 'Multitrack rig' : 'Not equipped'} ok={!!v.has_recording_capability} />
                          </div>
                        </div>

                        {amenList.length > 0 && (
                          <>
                            <Separator />
                            <div>
                              <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Listed amenities</p>
                              <div className="flex flex-wrap gap-1.5">
                                {amenList.map((a, i) => (
                                  <Badge key={`${a}-${i}`} variant="outline" className="capitalize">{a}</Badge>
                                ))}
                              </div>
                            </div>
                          </>
                        )}
                      </CardContent>
                    </Card>
                  );
                })()}
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