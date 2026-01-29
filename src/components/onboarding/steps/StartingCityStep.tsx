import { MapPin, Loader2, Music, Users, TrendingUp } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase-client";
import { cn } from "@/lib/utils";
import type { OnboardingData } from "../OnboardingWizard";

interface StartingCityStepProps {
  data: OnboardingData;
  updateData: (updates: Partial<OnboardingData>) => void;
}

interface City {
  id: string;
  name: string;
  country: string;
  population: number;
  music_scene: number | null;
  dominant_genre: string | null;
  cost_of_living: number | null;
  venues: number | null;
}

// Featured starting cities
const FEATURED_CITIES = [
  "London", "New York", "Los Angeles", "Berlin", "Tokyo", 
  "Nashville", "Austin", "Seattle", "Melbourne", "Toronto"
];

export const StartingCityStep = ({ data, updateData }: StartingCityStepProps) => {
  const { data: cities = [], isLoading } = useQuery({
    queryKey: ["starting-cities"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cities")
        .select("id, name, country, population, music_scene, dominant_genre, cost_of_living, venues")
        .in("name", FEATURED_CITIES)
        .order("music_scene", { ascending: false, nullsFirst: false });

      if (error) throw error;
      return data as City[];
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const getCostLabel = (cost: number | null): string => {
    if (cost === null) return "Medium";
    if (cost <= 30) return "Low";
    if (cost <= 50) return "Medium";
    if (cost <= 70) return "High";
    return "Very High";
  };

  const getCostColor = (cost: number | null) => {
    if (cost === null) return "text-muted-foreground";
    if (cost <= 30) return "text-green-500";
    if (cost <= 50) return "text-yellow-500";
    if (cost <= 70) return "text-orange-500";
    return "text-red-500";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <MapPin className="h-6 w-6 text-primary" />
        </div>
        <h2 className="text-xl font-bold text-foreground">
          Choose Your Home Base
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Where will you launch your career? Each city has its own music scene and opportunities.
        </p>
      </div>

      {/* City grid */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {cities.map((city) => {
          const isSelected = data.startingCityId === city.id;

          return (
            <button
              key={city.id}
              onClick={() => updateData({ startingCityId: city.id })}
              className={cn(
                "relative flex flex-col rounded-lg border-2 p-4 text-left transition-all",
                isSelected
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50 hover:bg-muted/50"
              )}
            >
              {/* City name & country */}
              <div className="mb-2 flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-foreground">{city.name}</h3>
                  <p className="text-xs text-muted-foreground">{city.country}</p>
                </div>
                {isSelected && (
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
                    ✓
                  </div>
                )}
              </div>

              {/* Stats */}
              <div className="mb-3 grid grid-cols-3 gap-2 text-xs">
                <div className="flex items-center gap-1">
                  <Music className="h-3 w-3 text-muted-foreground" />
                  <span className="text-muted-foreground">
                    {city.music_scene ?? "?"}/10
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <Users className="h-3 w-3 text-muted-foreground" />
                  <span className="text-muted-foreground">
                    {city.venues ?? "?"} venues
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <TrendingUp className="h-3 w-3 text-muted-foreground" />
                  <span className={getCostColor(city.cost_of_living)}>
                    {getCostLabel(city.cost_of_living)}
                  </span>
                </div>
              </div>

              {/* Genre tag */}
              {city.dominant_genre && (
                <div className="flex flex-wrap gap-1">
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                    {city.dominant_genre}
                  </span>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Selection hint */}
      {!data.startingCityId && (
        <p className="text-center text-sm text-muted-foreground">
          Select a city to continue
        </p>
      )}
    </div>
  );
};
