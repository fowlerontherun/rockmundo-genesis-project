import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useGameData } from "@/hooks/useGameData";
import { useRadioStations } from "@/hooks/useRadioStations";
import { useAuth } from "@/hooks/use-auth-context";
import { Radio, Users, MapPin, Star, Music, TrendingUp, Search, Filter, Globe, Zap, Send } from "lucide-react";
import { SubmitSongDialog } from "@/components/radio/SubmitSongDialog";
import { CompactSubmissions } from "@/components/radio/CompactSubmissions";
import { AirplayDashboard } from "@/components/radio/AirplayDashboard";
import { MyAirplayStats } from "@/components/radio/MyAirplayStats";
import { SongsInRotation } from "@/components/radio/SongsInRotation";
import { RadioSubmissionWizard } from "@/components/radio/RadioSubmissionWizard";
import type { RadioStation } from "@/hooks/useRadioStations";

const RadioBrowser = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { currentCity } = useGameData();
  const { stations, mySubmissions, isLoading } = useRadioStations();
  
  const [activeTab, setActiveTab] = useState<"stations" | "submissions" | "airplay">("stations");
  const [selectedStation, setSelectedStation] = useState<RadioStation | null>(null);
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [showBatchSubmitWizard, setShowBatchSubmitWizard] = useState(false);

  // Get user's primary band
  const { data: primaryBand } = useQuery({
    queryKey: ["primary-band-radio", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from("bands")
        .select("id, name, fame")
        .eq("leader_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Fetch countries the band has visited (performed in)
  const { data: visitedCountries = [] } = useQuery({
    queryKey: ["visited-countries-radio", primaryBand?.id],
    queryFn: async () => {
      if (!primaryBand?.id) return [];
      const { data, error } = await supabase
        .from("band_country_fans")
        .select("country")
        .eq("band_id", primaryBand.id)
        .eq("has_performed", true);
      if (error) throw error;
      return data.map(d => d.country);
    },
    enabled: !!primaryBand?.id,
  });
  
  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [stationType, setStationType] = useState<string>("all");
  const [countryFilter, setCountryFilter] = useState<string>("all");
  const [genreFilter, setGenreFilter] = useState<string>("all");
  const [localOnly, setLocalOnly] = useState(false);

  // Auto-set country filter based on user's current city
  useEffect(() => {
    if (currentCity?.country && countryFilter === "all") {
      setCountryFilter(currentCity.country);
    }
  }, [currentCity]);

  // Extract unique values for filters — only from visited countries
  const filterOptions = useMemo(() => {
    const genres = new Set<string>();
    const countries = new Set<string>();
    const types = new Set<string>();

    stations.forEach((station) => {
      // Only include filter options from visited countries
      if (visitedCountries.length > 0 && !visitedCountries.includes(station.country)) return;
      if (station.station_type) types.add(station.station_type);
      if (station.country) countries.add(station.country);
      station.accepted_genres?.forEach((g) => genres.add(g));
    });

    return {
      genres: Array.from(genres).sort(),
      countries: Array.from(countries).sort(),
      stationTypes: Array.from(types).sort(),
    };
  }, [stations, visitedCountries]);

  // Apply filters — only show stations in countries the band has visited
  const filteredStations = useMemo(() => {
    return stations.filter((station) => {
      // Only show stations in visited countries
      if (visitedCountries.length > 0 && !visitedCountries.includes(station.country)) {
        return false;
      }
      // If no band or no visited countries data yet, hide all stations
      if (primaryBand && visitedCountries.length === 0) {
        return false;
      }

      // Search filter
      if (searchTerm && !station.name.toLowerCase().includes(searchTerm.toLowerCase())) {
        return false;
      }

      // Station type filter
      if (stationType !== "all" && station.station_type !== stationType) {
        return false;
      }

      // Genre filter
      if (genreFilter !== "all" && !station.accepted_genres?.includes(genreFilter)) {
        return false;
      }

      // Country filter
      if (countryFilter !== "all" && station.country !== countryFilter) {
        return false;
      }

      // Local only filter (requires city_id match)
      if (localOnly && currentCity?.id && station.city_id !== currentCity.id) {
        return false;
      }

      return true;
    });
  }, [stations, searchTerm, stationType, genreFilter, countryFilter, localOnly, currentCity, visitedCountries, primaryBand]);

  // Calculate airplay stats
  const airplayStats = useMemo(() => {
    const acceptedSubmissions = mySubmissions.filter((s) => s.status === "accepted");
    return {
      totalPlays: acceptedSubmissions.length * 15,
      weeklyPlays: Math.floor(acceptedSubmissions.length * 3),
      activeStations: acceptedSubmissions.length,
      topSong: acceptedSubmissions.length > 0 ? {
        title: acceptedSubmissions[0]?.song?.title || "Unknown",
        plays: 45,
      } : null,
      recentPlays: [],
    };
  }, [mySubmissions]);

  const activeFilterCount = [
    stationType !== "all",
    countryFilter !== "all" && countryFilter !== currentCity?.country,
    genreFilter !== "all",
    localOnly,
  ].filter(Boolean).length;

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-48" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Radio className="h-8 w-8 text-primary" />
            Radio Stations
          </h1>
          <p className="text-muted-foreground">
            Submit songs and track radio airplay
            {currentCity && (
              <span className="ml-2 text-xs">
                <MapPin className="h-3 w-3 inline" /> Currently in {currentCity.name}, {currentCity.country}
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Available Stations</CardTitle>
            <Radio className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{filteredStations.length}</div>
            <p className="text-xs text-muted-foreground">{stations.length} total</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Reach</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {filteredStations.reduce((sum, s) => sum + (s.listener_base || 0), 0).toLocaleString()}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">My Submissions</CardTitle>
            <Music className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{mySubmissions.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">On Rotation</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {mySubmissions.filter((s) => s.status === "accepted").length}
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <TabsList className="grid w-full max-w-lg grid-cols-3">
          <TabsTrigger value="stations">Stations</TabsTrigger>
          <TabsTrigger value="submissions">My Submissions</TabsTrigger>
          <TabsTrigger value="airplay">Airplay Stats</TabsTrigger>
        </TabsList>

        {/* Stations Tab */}
        <TabsContent value="stations" className="mt-6 space-y-4">
          {/* Batch Submit Card */}
          {primaryBand && (
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <Zap className="h-5 w-5 text-primary" />
                  <div>
                    <p className="font-medium">Submit to All Eligible Stations</p>
                    <p className="text-sm text-muted-foreground">
                      Batch submit your songs to matching stations
                    </p>
                  </div>
                </div>
                <Dialog open={showBatchSubmitWizard} onOpenChange={setShowBatchSubmitWizard}>
                  <DialogTrigger asChild>
                    <Button variant="default" className="w-full sm:w-auto">
                      <Send className="mr-2 h-4 w-4" />
                      Batch Submit
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <RadioSubmissionWizard 
                      bandId={primaryBand.id} 
                      onComplete={() => {
                        setShowBatchSubmitWizard(false);
                      }}
                    />
                  </DialogContent>
                </Dialog>
              </CardContent>
            </Card>
          )}

          {/* Filters */}
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search stations..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <Select value={countryFilter} onValueChange={setCountryFilter}>
              <SelectTrigger className="w-full md:w-48">
                <Globe className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Country" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Countries</SelectItem>
                {filterOptions.countries.map(country => (
                  <SelectItem key={country} value={country}>{country}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={stationType} onValueChange={setStationType}>
              <SelectTrigger className="w-full md:w-40">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {filterOptions.stationTypes.map(type => (
                  <SelectItem key={type} value={type} className="capitalize">{type}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={genreFilter} onValueChange={setGenreFilter}>
              <SelectTrigger className="w-full md:w-40">
                <SelectValue placeholder="Genre" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Genres</SelectItem>
                {filterOptions.genres.map(genre => (
                  <SelectItem key={genre} value={genre}>{genre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Local Only Toggle */}
          {currentCity && (
            <div className="flex items-center space-x-2">
              <Switch
                id="local-only"
                checked={localOnly}
                onCheckedChange={setLocalOnly}
              />
              <Label htmlFor="local-only" className="text-sm">
                Show only stations in {currentCity.name}
              </Label>
            </div>
          )}

          {/* Results count */}
          <p className="text-sm text-muted-foreground">
            Showing {filteredStations.length} of {stations.length} stations
          </p>

          {filteredStations.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center text-muted-foreground">
                No stations match your filters
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredStations.map((station) => (
                <Card key={station.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <Radio className="h-5 w-5 text-primary" />
                        <div>
                          <CardTitle className="text-lg">{station.name}</CardTitle>
                          <CardDescription className="flex items-center gap-1 capitalize">
                            {station.station_type}
                            {station.city_id === currentCity?.id && (
                              <Badge variant="secondary" className="ml-2 text-xs">Local</Badge>
                            )}
                          </CardDescription>
                        </div>
                      </div>
                      <Badge variant="secondary" className="flex items-center gap-1">
                        <Star className="h-3 w-3" />
                        {station.quality_level}/10
                      </Badge>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    {station.accepted_genres && station.accepted_genres.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {station.accepted_genres.slice(0, 3).map((genre) => (
                          <Badge key={genre} variant="outline" className="text-xs">
                            {genre}
                          </Badge>
                        ))}
                        {station.accepted_genres.length > 3 && (
                          <Badge variant="outline" className="text-xs">
                            +{station.accepted_genres.length - 3}
                          </Badge>
                        )}
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Listeners</p>
                        <p className="font-medium flex items-center gap-1">
                          <Users className="h-4 w-4" />
                          {(station.listener_base || 0).toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Location</p>
                        <p className="font-medium flex items-center gap-1 capitalize">
                          <MapPin className="h-4 w-4" />
                          {station.country}
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        onClick={() => navigate(`/radio/${station.id}`)}
                      >
                        View Details
                      </Button>
                      {station.is_active && (
                        <Button
                          size="sm"
                          className="flex-1"
                          onClick={() => {
                            setSelectedStation(station);
                            setShowSubmitDialog(true);
                          }}
                        >
                          Submit Song
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* My Submissions Tab - Compact with filters */}
        <TabsContent value="submissions" className="mt-6">
          <CompactSubmissions 
            submissions={mySubmissions} 
            isLoading={isLoading} 
          />
        </TabsContent>

        {/* Airplay Stats Tab */}
        <TabsContent value="airplay" className="mt-6 space-y-6">
          {/* My Airplay Stats */}
          {user && <MyAirplayStats userId={user.id} />}
          
          {/* Songs in Rotation */}
          {user && <SongsInRotation userId={user.id} />}
          
          {/* Submission Breakdown */}
          <AirplayDashboard stats={airplayStats} submissions={mySubmissions} />
        </TabsContent>
      </Tabs>

      {selectedStation && (
        <SubmitSongDialog
          open={showSubmitDialog}
          onOpenChange={setShowSubmitDialog}
          station={selectedStation}
        />
      )}
    </div>
  );
};

export default RadioBrowser;
