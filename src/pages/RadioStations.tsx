import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useRadioStations } from "@/hooks/useRadioStations";
import { Radio, Users, MapPin, Star, Music, TrendingUp } from "lucide-react";
import { SubmitSongDialog } from "@/components/radio/SubmitSongDialog";
import { MyRadioSubmissions } from "@/components/radio/MyRadioSubmissions";
import { RadioStationFilters, RadioFilters, defaultFilters } from "@/components/radio/RadioStationFilters";
import { AirplayDashboard } from "@/components/radio/AirplayDashboard";
import type { RadioStation } from "@/hooks/useRadioStations";

const RadioStations = () => {
  const navigate = useNavigate();
  const { stations, mySubmissions, isLoading } = useRadioStations();
  const [activeTab, setActiveTab] = useState<"stations" | "submissions" | "airplay">("stations");
  const [selectedStation, setSelectedStation] = useState<RadioStation | null>(null);
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [filters, setFilters] = useState<RadioFilters>(defaultFilters);

  // Extract unique values for filters
  const filterOptions = useMemo(() => {
    const genres = new Set<string>();
    const countries = new Set<string>();
    const types = new Set<string>();

    stations.forEach((station) => {
      if (station.station_type) types.add(station.station_type);
      if (station.country) countries.add(station.country);
      station.accepted_genres?.forEach((g) => genres.add(g));
    });

    return {
      genres: Array.from(genres).sort(),
      countries: Array.from(countries).sort(),
      stationTypes: Array.from(types).sort(),
    };
  }, [stations]);

  // Apply filters
  const filteredStations = useMemo(() => {
    return stations.filter((station) => {
      // Search filter
      if (filters.search && !station.name.toLowerCase().includes(filters.search.toLowerCase())) {
        return false;
      }

      // Station type filter
      if (filters.stationType !== "all" && station.station_type !== filters.stationType) {
        return false;
      }

      // Genre filter
      if (filters.genre !== "all" && !station.accepted_genres?.includes(filters.genre)) {
        return false;
      }

      // Country filter
      if (filters.country !== "all" && station.country !== filters.country) {
        return false;
      }

      // Quality filter
      if (station.quality_level < filters.minQuality || station.quality_level > filters.maxQuality) {
        return false;
      }

      // Accepts submissions filter
      if (filters.acceptsSubmissions !== null && station.accepts_submissions !== filters.acceptsSubmissions) {
        return false;
      }

      return true;
    });
  }, [stations, filters]);

  // Calculate airplay stats (simulated for now)
  const airplayStats = useMemo(() => {
    const acceptedSubmissions = mySubmissions.filter((s) => s.status === "accepted");
    return {
      totalPlays: acceptedSubmissions.length * 15, // Simulated
      weeklyPlays: Math.floor(acceptedSubmissions.length * 3),
      activeStations: acceptedSubmissions.length,
      topSong: acceptedSubmissions.length > 0 ? {
        title: acceptedSubmissions[0]?.song?.title || "Unknown",
        plays: 45,
      } : null,
      recentPlays: [],
    };
  }, [mySubmissions]);

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Radio Stations</h1>
          <p className="text-muted-foreground">Track radio airplay and station performance</p>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Stations</CardTitle>
            <Radio className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stations.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Reach</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stations.reduce((sum, s) => sum + (s.listener_base || 0), 0).toLocaleString()}
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
          <RadioStationFilters
            filters={filters}
            onFiltersChange={setFilters}
            genres={filterOptions.genres}
            countries={filterOptions.countries}
            stationTypes={filterOptions.stationTypes}
          />

          {isLoading ? (
            <Card>
              <CardContent className="p-12 text-center text-muted-foreground">
                Loading stations...
              </CardContent>
            </Card>
          ) : filteredStations.length === 0 ? (
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
                        <p className="text-muted-foreground">Range</p>
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
                      {station.accepts_submissions && (
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

        {/* My Submissions Tab */}
        <TabsContent value="submissions" className="mt-6">
          <MyRadioSubmissions />
        </TabsContent>

        {/* Airplay Stats Tab */}
        <TabsContent value="airplay" className="mt-6">
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

export default RadioStations;
