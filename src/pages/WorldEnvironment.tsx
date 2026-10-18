import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Globe2, MapPin, Users, TrendingUp, DollarSign, Music } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { Skeleton } from "@/components/ui/skeleton";
import { FMPageScaffold } from "@/components/fm/FMPageScaffold";

interface City {
  id: string;
  name: string;
  country: string;
  music_scene: number;
  population: number;
  cost_of_living: number;
  dominant_genre: string | null;
  venues: number;
}

export default function WorldEnvironment() {
  const navigate = useNavigate();
  const { profile, profileId, userId, isLoading: profileLoading, error: profileError } = useActiveProfile();
  const [cities, setCities] = useState<City[]>([]);
  // Use only the selected character. Never infer a location from an account-wide profile query.
  const currentCityId = profile?.current_city_id ?? null;
  const canBookTravel = !!userId && !!profileId && !!currentCityId && !profileError;
  const [loading, setLoading] = useState(true);
  const [cityError, setCityError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [countryFilter, setCountryFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"name" | "music_scene" | "population">("music_scene");

  useEffect(() => {
    let mounted = true;
    const loadCities = async () => {
      try {
        const { data, error } = await supabase
          .from("cities")
          .select("*")
          .order("music_scene", { ascending: false });
        if (error) throw error;
        if (mounted) setCities(data ?? []);
      } catch (error) {
        if (mounted) {
          setCityError(error instanceof Error ? error.message : "City list could not be loaded");
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };
    void loadCities();
    return () => { mounted = false; };
  }, []);

  const countries = Array.from(new Set(cities.map(c => c.country))).sort();

  const filteredCities = cities
    .filter(city => {
      const matchesSearch = city.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          city.country.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCountry = countryFilter === "all" || city.country === countryFilter;
      return matchesSearch && matchesCountry;
    })
    .sort((a, b) => {
      if (sortBy === "name") return a.name.localeCompare(b.name);
      if (sortBy === "population") return (b.population || 0) - (a.population || 0);
      return (b.music_scene || 0) - (a.music_scene || 0);
    });

  if (loading || profileLoading) {
    return (
      <FMPageScaffold title="Global Cities" subtitle="Explore music hubs around the world" icon={Globe2} backTo="/hub/world-social">
        <Skeleton className="h-12 w-64" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-64" />
          ))}
        </div>
      </FMPageScaffold>
    );
  }

  return (
    <FMPageScaffold
      title="Global Cities"
      subtitle="Explore music hubs around the world"
      icon={Globe2}
      backTo="/hub/world-social"
    >
      {cityError && (
        <Card role="alert" className="border-destructive/50">
          <CardContent className="py-4 text-sm">
            Unable to load cities: {cityError}. Refresh the page to try again.
          </CardContent>
        </Card>
      )}

      {profileError && (
        <Card role="alert" className="border-destructive/50">
          <CardContent className="py-4 text-sm">
            Your active character could not be verified. Travel booking is unavailable until this is resolved.
          </CardContent>
        </Card>
      )}
      {!profileError && !canBookTravel && userId && (
        <Card role="status">
          <CardContent className="py-4 text-sm text-muted-foreground">
            This character has no verified current city. You can explore cities, but travel booking requires a confirmed location.
          </CardContent>
        </Card>
      )}
      {!userId && (
        <Card role="status">
          <CardContent className="py-4 text-sm text-muted-foreground">
            Sign in and select a character to book travel.
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3 md:grid-cols-4">
        <Input
          placeholder="Search cities..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="md:col-span-2"
        />
        <Select value={countryFilter} onValueChange={setCountryFilter}>
          <SelectTrigger>
            <SelectValue placeholder="All Countries" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Countries</SelectItem>
            {countries.map(country => (
              <SelectItem key={country} value={country}>{country}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
          <SelectTrigger>
            <SelectValue placeholder="Sort by..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="music_scene">Music Scene</SelectItem>
            <SelectItem value="name">Name</SelectItem>
            <SelectItem value="population">Population</SelectItem>
          </SelectContent>
        </Select>
      </div>


      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredCities.map((city) => {
          const isCurrentCity = canBookTravel && city.id === currentCityId;
          
          return (
            <Card 
              key={city.id} 
              className={isCurrentCity ? "border-primary bg-primary/5" : ""}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="flex items-center gap-2">
                      {city.name}
                      {isCurrentCity && (
                        <Badge variant="default" className="text-xs">
                          <MapPin className="h-3 w-3 mr-1" />
                          Current
                        </Badge>
                      )}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">{city.country}</p>
                  </div>
                  <Badge variant="outline" className="gap-1">
                    <Music className="h-3 w-3" />
                    {city.music_scene}%
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Users className="h-4 w-4" />
                    <span>{(city.population / 1_000_000).toFixed(1)}M</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <DollarSign className="h-4 w-4" />
                    <span>CoL: {city.cost_of_living}%</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <TrendingUp className="h-4 w-4" />
                    <span>{city.venues} venues</span>
                  </div>
                  {city.dominant_genre && (
                    <div className="col-span-2">
                      <Badge variant="secondary" className="text-xs">
                        {city.dominant_genre}
                      </Badge>
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => navigate(`/cities/${city.id}`)}
                    className="flex-1"
                  >
                    Explore
                  </Button>
                  {!isCurrentCity && canBookTravel && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => navigate(`/travel?destination=${encodeURIComponent(city.id)}`)}
                      className="flex-1"
                      disabled={profile?.is_traveling === true}
                    >
                      {profile?.is_traveling ? "In Transit" : "Book Travel"}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {!cityError && filteredCities.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Globe2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">No cities found</h3>
            <p className="text-sm text-muted-foreground">
              Try adjusting your search or filters
            </p>
          </CardContent>
        </Card>
      )}
    </FMPageScaffold>
  );
}
