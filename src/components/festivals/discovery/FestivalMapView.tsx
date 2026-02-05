 import { useState, useMemo } from "react";
 import { useNavigate } from "react-router-dom";
 import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
 import { Button } from "@/components/ui/button";
 import { Badge } from "@/components/ui/badge";
 import { Input } from "@/components/ui/input";
 import { 
   MapPin, Calendar, Users, Music, DollarSign, 
   Plane, Clock, Filter, Search
 } from "lucide-react";
 import { format, formatDistanceToNow, isFuture } from "date-fns";
 import type { Festival } from "@/hooks/useFestivals";
 
 interface FestivalMapViewProps {
   festivals: Festival[];
   currentCityName?: string;
   onApply?: (festival: Festival) => void;
 }
 
 // Mock city coordinates for visualization
 const CITY_COORDS: Record<string, { x: number; y: number; region: string }> = {
   "new york": { x: 25, y: 35, region: "North America" },
   "los angeles": { x: 10, y: 40, region: "North America" },
   "london": { x: 48, y: 25, region: "Europe" },
   "paris": { x: 50, y: 28, region: "Europe" },
   "berlin": { x: 53, y: 24, region: "Europe" },
   "tokyo": { x: 88, y: 38, region: "Asia" },
   "sydney": { x: 90, y: 75, region: "Oceania" },
   "são paulo": { x: 32, y: 65, region: "South America" },
   "rio de janeiro": { x: 35, y: 63, region: "South America" },
   "miami": { x: 22, y: 45, region: "North America" },
   "chicago": { x: 20, y: 32, region: "North America" },
   "amsterdam": { x: 50, y: 23, region: "Europe" },
   "barcelona": { x: 48, y: 32, region: "Europe" },
   "melbourne": { x: 92, y: 78, region: "Oceania" },
   "toronto": { x: 22, y: 28, region: "North America" },
   "mexico city": { x: 15, y: 50, region: "North America" },
   "mumbai": { x: 70, y: 48, region: "Asia" },
   "seoul": { x: 85, y: 35, region: "Asia" },
   "singapore": { x: 78, y: 55, region: "Asia" },
 };
 
 export function FestivalMapView({ festivals, currentCityName, onApply }: FestivalMapViewProps) {
   const navigate = useNavigate();
   const [selectedFestival, setSelectedFestival] = useState<Festival | null>(null);
   const [searchQuery, setSearchQuery] = useState("");
   const [filterRegion, setFilterRegion] = useState<string | null>(null);
 
   const festivalsWithCoords = useMemo(() => {
     return festivals.map((f) => {
       const location = f.location?.toLowerCase() || "";
       const coords = Object.entries(CITY_COORDS).find(([city]) => 
         location.includes(city)
       );
       return {
         ...f,
         coords: coords?.[1] || { x: 50 + Math.random() * 20, y: 40 + Math.random() * 20, region: "Unknown" },
       };
     });
   }, [festivals]);
 
   const filteredFestivals = useMemo(() => {
     return festivalsWithCoords.filter((f) => {
       const matchesSearch = !searchQuery || 
         f.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
         f.location?.toLowerCase().includes(searchQuery.toLowerCase());
       const matchesRegion = !filterRegion || f.coords.region === filterRegion;
       return matchesSearch && matchesRegion;
     });
   }, [festivalsWithCoords, searchQuery, filterRegion]);
 
   const regions = useMemo(() => {
     const unique = new Set(festivalsWithCoords.map((f) => f.coords.region));
     return Array.from(unique);
   }, [festivalsWithCoords]);
 
   const calculateTravelCost = (festival: Festival) => {
     // Mock travel cost calculation based on distance
     const baseCost = Math.floor(Math.random() * 2000) + 200;
     return baseCost;
   };
 
   return (
     <div className="space-y-4">
       {/* Filters */}
       <div className="flex flex-wrap gap-3">
         <div className="relative flex-1 min-w-[200px]">
           <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
           <Input
             placeholder="Search festivals..."
             value={searchQuery}
             onChange={(e) => setSearchQuery(e.target.value)}
             className="pl-9"
           />
         </div>
         <div className="flex gap-2">
           <Button
             variant={filterRegion === null ? "default" : "outline"}
             size="sm"
             onClick={() => setFilterRegion(null)}
           >
             All Regions
           </Button>
           {regions.map((region) => (
             <Button
               key={region}
               variant={filterRegion === region ? "default" : "outline"}
               size="sm"
               onClick={() => setFilterRegion(region)}
             >
               {region}
             </Button>
           ))}
         </div>
       </div>
 
       {/* Map Visualization */}
       <Card className="relative overflow-hidden">
         <CardContent className="p-0">
           <div 
             className="relative bg-gradient-to-b from-blue-950/20 to-green-950/20 h-[400px] border rounded-lg"
             style={{ 
               background: "linear-gradient(135deg, hsl(var(--muted)) 0%, hsl(var(--background)) 100%)"
             }}
           >
             {/* Grid lines for visual effect */}
             <div className="absolute inset-0 opacity-10">
               {[...Array(10)].map((_, i) => (
                 <div key={`h-${i}`} className="absolute w-full h-px bg-primary" style={{ top: `${i * 10}%` }} />
               ))}
               {[...Array(10)].map((_, i) => (
                 <div key={`v-${i}`} className="absolute h-full w-px bg-primary" style={{ left: `${i * 10}%` }} />
               ))}
             </div>
 
             {/* Festival markers */}
             {filteredFestivals.map((festival) => (
               <button
                 key={festival.id}
                 className={`absolute transform -translate-x-1/2 -translate-y-1/2 transition-all duration-200 hover:scale-125 z-10 ${
                   selectedFestival?.id === festival.id ? "scale-125 z-20" : ""
                 }`}
                 style={{ 
                   left: `${festival.coords.x}%`, 
                   top: `${festival.coords.y}%` 
                 }}
                 onClick={() => setSelectedFestival(festival)}
               >
                 <div className={`w-4 h-4 rounded-full ${
                   isFuture(new Date(festival.start_date)) 
                     ? "bg-primary animate-pulse" 
                     : "bg-muted-foreground"
                 }`} />
                 {selectedFestival?.id === festival.id && (
                   <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 whitespace-nowrap bg-popover text-popover-foreground px-2 py-1 rounded text-xs font-medium shadow-lg">
                     {festival.title}
                   </div>
                 )}
               </button>
             ))}
 
             {/* Legend */}
             <div className="absolute bottom-4 left-4 bg-background/80 backdrop-blur-sm p-3 rounded-lg text-xs space-y-1">
               <div className="flex items-center gap-2">
                 <div className="w-3 h-3 rounded-full bg-primary animate-pulse" />
                 <span>Upcoming Festival</span>
               </div>
               <div className="flex items-center gap-2">
                 <div className="w-3 h-3 rounded-full bg-muted-foreground" />
                 <span>Past Festival</span>
               </div>
             </div>
 
             {/* Stats */}
             <div className="absolute top-4 right-4 bg-background/80 backdrop-blur-sm p-3 rounded-lg text-xs">
               <p className="font-bold">{filteredFestivals.length} Festivals</p>
               {filterRegion && <p className="text-muted-foreground">in {filterRegion}</p>}
             </div>
           </div>
         </CardContent>
       </Card>
 
       {/* Selected Festival Details */}
       {selectedFestival && (
         <Card className="border-primary/50">
           <CardHeader className="pb-2">
             <div className="flex items-start justify-between">
               <div>
                 <CardTitle className="text-lg">{selectedFestival.title}</CardTitle>
                 <p className="text-sm text-muted-foreground flex items-center gap-1">
                   <MapPin className="h-3 w-3" />
                   {selectedFestival.location}
                 </p>
               </div>
               <Button variant="ghost" size="sm" onClick={() => setSelectedFestival(null)}>
                 ×
               </Button>
             </div>
           </CardHeader>
           <CardContent className="space-y-4">
             <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
               <div className="flex items-center gap-2">
                 <Calendar className="h-4 w-4 text-muted-foreground" />
                 <span>{format(new Date(selectedFestival.start_date), "MMM d, yyyy")}</span>
               </div>
               <div className="flex items-center gap-2">
                 <Users className="h-4 w-4 text-muted-foreground" />
                 <span>{selectedFestival.current_participants}/{selectedFestival.max_participants} acts</span>
               </div>
               <div className="flex items-center gap-2">
                 <Plane className="h-4 w-4 text-muted-foreground" />
                 <span>${calculateTravelCost(selectedFestival).toLocaleString()} travel</span>
               </div>
               <div className="flex items-center gap-2">
                 <Clock className="h-4 w-4 text-muted-foreground" />
                 <span>{formatDistanceToNow(new Date(selectedFestival.start_date), { addSuffix: true })}</span>
               </div>
             </div>
 
             <p className="text-sm text-muted-foreground line-clamp-2">
               {selectedFestival.description}
             </p>
 
             <div className="flex gap-2">
               <Button 
                 className="flex-1" 
                 onClick={() => navigate(`/festivals/${selectedFestival.id}`)}
               >
                 View Details
               </Button>
               {onApply && isFuture(new Date(selectedFestival.start_date)) && (
                 <Button 
                   variant="secondary"
                   onClick={() => onApply(selectedFestival)}
                 >
                   Apply
                 </Button>
               )}
             </div>
           </CardContent>
         </Card>
       )}
 
       {/* Festival List */}
       <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
         {filteredFestivals.slice(0, 9).map((festival) => (
           <Card 
             key={festival.id} 
             className={`cursor-pointer transition-all hover:border-primary/50 ${
               selectedFestival?.id === festival.id ? "border-primary" : ""
             }`}
             onClick={() => setSelectedFestival(festival)}
           >
             <CardContent className="p-4">
               <div className="flex items-start justify-between mb-2">
                 <h3 className="font-semibold">{festival.title}</h3>
                 <Badge variant="outline" className="text-xs">
                   {festival.coords.region}
                 </Badge>
               </div>
               <div className="text-sm text-muted-foreground space-y-1">
                 <p className="flex items-center gap-1">
                   <MapPin className="h-3 w-3" />
                   {festival.location}
                 </p>
                 <p className="flex items-center gap-1">
                   <Calendar className="h-3 w-3" />
                   {format(new Date(festival.start_date), "MMM d, yyyy")}
                 </p>
               </div>
             </CardContent>
           </Card>
         ))}
       </div>
     </div>
   );
 }