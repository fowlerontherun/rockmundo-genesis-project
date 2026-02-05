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
   DollarSign, Trophy, Clock, Zap, TrendingUp, Sun, CloudRain
 } from "lucide-react";
 import { format, formatDistanceToNow, isFuture } from "date-fns";
 import { usePrimaryBand } from "@/hooks/usePrimaryBand";
 import { useFestivalHistory, useFestivalSponsorships, useFestivalRivalries } from "@/hooks/useFestivalHistory";
 import { FestivalRivalryCard } from "@/components/festivals/rivalry/FestivalRivalryCard";
 
 export default function FestivalDetail() {
   const { festivalId } = useParams();
   const navigate = useNavigate();
   const { data: primaryBandRecord } = usePrimaryBand();
   const band = primaryBandRecord?.bands;
 
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
         <TabsList className="grid w-full max-w-md grid-cols-3">
           <TabsTrigger value="lineup">Lineup</TabsTrigger>
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