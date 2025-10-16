import { useState, useEffect, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { Globe2, MapPin, Users, TrendingUp, DollarSign, Music } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { AuthContext } from "@/hooks/use-auth-context";
import { Skeleton } from "@/components/ui/skeleton";

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
  const { user } = useContext(AuthContext);
  const [cities, setCities] = useState<City[]>([]);
  const [currentCityId, setCurrentCityId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [countryFilter, setCountryFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"name" | "music_scene" | "population">("music_scene");

  useEffect(() => {
    loadData();
  }, [user]);

  const loadData = async () => {
    try {
      const { data: citiesData } = await supabase
        .from("cities")
        .select("*")
        .order("music_scene", { ascending: false });

      if (citiesData) {
        setCities(citiesData);
      }

      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("current_city_id")
          .eq("user_id", user.id)
          .single();

        setCurrentCityId(profile?.current_city_id || null);
      }
    } catch (error) {
      console.error("Error loading cities:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSetHome = async (cityId: string) => {
    if (!user) return;

    const { error } = await supabase
      .from("profiles")
      .update({ current_city_id: cityId })
      .eq("user_id", user.id);

    if (!error) {
      setCurrentCityId(cityId);
    }
  };

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

  if (loading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <Skeleton className="h-12 w-64" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-64" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <header className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-primary/10 p-3">
              <Globe2 className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Global Cities</h1>
              <p className="text-muted-foreground">Explore music hubs around the world</p>
            </div>
          </div>
          {/* <Button onClick={() => navigate("/world-map")} variant="outline">
            <MapPin className="h-4 w-4 mr-2" />
            View Map
          </Button> */}
        </div>

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
      </header>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredCities.map((city) => {
          const isCurrentCity = city.id === currentCityId;
          
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
                  {!isCurrentCity && user && !currentCityId && (
                    <Button
                      size="sm"
                      onClick={() => handleSetHome(city.id)}
                      className="flex-1"
                    >
                      Set as Home
                    </Button>
                  )}
                  {!isCurrentCity && currentCityId && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => navigate(`/travel?destination=${city.id}`)}
                      className="flex-1"
                    >
                      Travel
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filteredCities.length === 0 && (
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
    </div>
  );
}
