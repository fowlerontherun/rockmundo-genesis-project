import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Globe, MapPin, DollarSign } from "lucide-react";

export interface TerritorySelection {
  country: string;
  region: string;
  distanceTier: "domestic" | "regional" | "continental" | "intercontinental";
  costMultiplier: number;
  distributionCost: number;
}

interface TerritorySelectionStepProps {
  selectedTerritories: TerritorySelection[];
  onTerritoriesChange: (territories: TerritorySelection[]) => void;
  homeCountry: string | null;
  homeRegion: string | null;
  isPhysical: boolean;
  onBack: () => void;
  onNext: () => void;
}

const REGION_ADJACENCY: Record<string, string[]> = {
  "Europe": ["Middle East", "Africa"],
  "Middle East": ["Europe", "Asia", "Africa"],
  "Africa": ["Europe", "Middle East"],
  "North America": ["Central America", "Caribbean", "South America"],
  "Central America": ["North America", "South America", "Caribbean"],
  "Caribbean": ["North America", "Central America", "South America"],
  "South America": ["North America", "Central America", "Caribbean"],
  "Asia": ["Oceania", "Middle East", "South East Asia"],
  "South East Asia": ["Asia", "Oceania"],
  "Oceania": ["Asia", "South East Asia"],
};

const TIER_COLORS: Record<string, string> = {
  domestic: "bg-green-500/20 text-green-400 border-green-500/30",
  regional: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  continental: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  intercontinental: "bg-red-500/20 text-red-400 border-red-500/30",
};

const BASE_COST_PHYSICAL = 5000; // $50 per country in cents
const BASE_COST_DIGITAL = 1000;  // $10 per country in cents

function getDistanceTier(
  homeCountry: string | null,
  homeRegion: string | null,
  targetCountry: string,
  targetRegion: string
): "domestic" | "regional" | "continental" | "intercontinental" {
  if (!homeCountry || !homeRegion) return "domestic";
  if (targetCountry === homeCountry) return "domestic";
  if (targetRegion === homeRegion) return "regional";
  const adjacent = REGION_ADJACENCY[homeRegion] || [];
  if (adjacent.includes(targetRegion)) return "continental";
  return "intercontinental";
}

function getCostMultiplier(tier: string, isPhysical: boolean): number {
  if (isPhysical) {
    switch (tier) {
      case "domestic": return 1.0;
      case "regional": return 1.5;
      case "continental": return 2.5;
      case "intercontinental": return 4.0;
      default: return 1.0;
    }
  } else {
    switch (tier) {
      case "domestic": return 1.0;
      case "regional": return 1.1;
      case "continental": return 1.2;
      case "intercontinental": return 1.3;
      default: return 1.0;
    }
  }
}

export function TerritorySelectionStep({
  selectedTerritories,
  onTerritoriesChange,
  homeCountry,
  homeRegion,
  isPhysical,
  onBack,
  onNext,
}: TerritorySelectionStepProps) {
  const [expandedRegions, setExpandedRegions] = useState<Set<string>>(new Set());

  const { data: countries } = useQuery({
    queryKey: ["territory-countries"],
    queryFn: async () => {
      const { data } = await supabase
        .from("cities")
        .select("country, region")
        .order("country");
      
      // Deduplicate by country
      const countryMap = new Map<string, string>();
      (data || []).forEach((c) => {
        if (c.country && c.region && !countryMap.has(c.country)) {
          countryMap.set(c.country, c.region);
        }
      });
      return Array.from(countryMap.entries()).map(([country, region]) => ({ country, region }));
    },
  });

  const countriesByRegion = useMemo(() => {
    const grouped: Record<string, { country: string; region: string }[]> = {};
    (countries || []).forEach((c) => {
      if (!grouped[c.region]) grouped[c.region] = [];
      grouped[c.region].push(c);
    });
    // Sort regions alphabetically, but put home region first
    const sortedKeys = Object.keys(grouped).sort((a, b) => {
      if (a === homeRegion) return -1;
      if (b === homeRegion) return 1;
      return a.localeCompare(b);
    });
    return sortedKeys.map((region) => ({ region, countries: grouped[region].sort((a, b) => a.country.localeCompare(b.country)) }));
  }, [countries, homeRegion]);

  const baseCost = isPhysical ? BASE_COST_PHYSICAL : BASE_COST_DIGITAL;

  const toggleCountry = (country: string, region: string) => {
    const existing = selectedTerritories.find((t) => t.country === country);
    if (existing) {
      onTerritoriesChange(selectedTerritories.filter((t) => t.country !== country));
    } else {
      const tier = getDistanceTier(homeCountry, homeRegion, country, region);
      const multiplier = getCostMultiplier(tier, isPhysical);
      onTerritoriesChange([
        ...selectedTerritories,
        {
          country,
          region,
          distanceTier: tier,
          costMultiplier: multiplier,
          distributionCost: Math.round(baseCost * multiplier),
        },
      ]);
    }
  };

  const selectAllInRegion = (region: string, regionCountries: { country: string; region: string }[]) => {
    const currentCountries = new Set(selectedTerritories.map((t) => t.country));
    const allSelected = regionCountries.every((c) => currentCountries.has(c.country));

    if (allSelected) {
      // Deselect all in region (but keep home country)
      onTerritoriesChange(
        selectedTerritories.filter(
          (t) => t.region !== region || t.country === homeCountry
        )
      );
    } else {
      // Select all in region
      const newTerritories = [...selectedTerritories];
      for (const c of regionCountries) {
        if (!currentCountries.has(c.country)) {
          const tier = getDistanceTier(homeCountry, homeRegion, c.country, c.region);
          const multiplier = getCostMultiplier(tier, isPhysical);
          newTerritories.push({
            country: c.country,
            region: c.region,
            distanceTier: tier,
            costMultiplier: multiplier,
            distributionCost: Math.round(baseCost * multiplier),
          });
        }
      }
      onTerritoriesChange(newTerritories);
    }
  };

  const toggleRegionExpand = (region: string) => {
    const next = new Set(expandedRegions);
    if (next.has(region)) next.delete(region);
    else next.add(region);
    setExpandedRegions(next);
  };

  const totalCost = selectedTerritories.reduce((sum, t) => sum + t.distributionCost, 0);
  const selectedCountries = new Set(selectedTerritories.map((t) => t.country));

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <Label className="text-lg font-semibold flex items-center gap-2">
          <Globe className="h-5 w-5" />
          Territory Selection
        </Label>
      </div>

      <p className="text-sm text-muted-foreground">
        Choose which countries to distribute your release in. Distribution costs vary by distance from your home country.
        {homeCountry && (
          <span className="block mt-1 text-primary">
            Home country: <strong>{homeCountry}</strong> ({homeRegion})
          </span>
        )}
      </p>

      <div className="grid grid-cols-4 gap-2 text-xs">
        {(["domestic", "regional", "continental", "intercontinental"] as const).map((tier) => (
          <div key={tier} className="flex items-center gap-1">
            <Badge variant="outline" className={`text-[10px] ${TIER_COLORS[tier]}`}>
              {tier}
            </Badge>
            <span className="text-muted-foreground">
              {isPhysical
                ? `${getCostMultiplier(tier, true)}x`
                : `${getCostMultiplier(tier, false)}x`}
            </span>
          </div>
        ))}
      </div>

      <ScrollArea className="h-[350px] pr-2">
        <div className="space-y-3">
          {countriesByRegion.map(({ region, countries: regionCountries }) => {
            const selectedInRegion = regionCountries.filter((c) => selectedCountries.has(c.country)).length;
            const isExpanded = expandedRegions.has(region) || region === homeRegion;

            return (
              <Card key={region} className="overflow-hidden">
                <div
                  className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => toggleRegionExpand(region)}
                >
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium text-sm">{region}</span>
                    <Badge variant="secondary" className="text-[10px]">
                      {selectedInRegion}/{regionCountries.length}
                    </Badge>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs h-7"
                    onClick={(e) => {
                      e.stopPropagation();
                      selectAllInRegion(region, regionCountries);
                    }}
                  >
                    {selectedInRegion === regionCountries.length ? "Deselect All" : "Select All"}
                  </Button>
                </div>

                {isExpanded && (
                  <div className="px-3 pb-3 grid grid-cols-2 gap-1.5">
                    {regionCountries.map((c) => {
                      const isSelected = selectedCountries.has(c.country);
                      const isHome = c.country === homeCountry;
                      const tier = getDistanceTier(homeCountry, homeRegion, c.country, c.region);
                      const multiplier = getCostMultiplier(tier, isPhysical);
                      const cost = Math.round(baseCost * multiplier);

                      return (
                        <div
                          key={c.country}
                          className={`flex items-center gap-2 p-2 rounded-md cursor-pointer text-xs transition-colors ${
                            isSelected
                              ? "bg-primary/10 border border-primary/30"
                              : "hover:bg-muted/50 border border-transparent"
                          } ${isHome ? "ring-1 ring-primary/50" : ""}`}
                          onClick={() => {
                            if (!isHome) toggleCountry(c.country, c.region);
                          }}
                        >
                          <Checkbox checked={isSelected} disabled={isHome} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1">
                              <span className="truncate font-medium">{c.country}</span>
                              {isHome && (
                                <Badge variant="outline" className="text-[9px] px-1 bg-primary/20 text-primary border-primary/30">
                                  HOME
                                </Badge>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <Badge variant="outline" className={`text-[9px] px-1 ${TIER_COLORS[tier]}`}>
                              {tier.slice(0, 3)}
                            </Badge>
                            <span className="text-muted-foreground">${(cost / 100).toFixed(0)}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      </ScrollArea>

      {selectedTerritories.length > 0 && (
        <Card className="p-4 bg-primary/5 border-primary/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">
                {selectedTerritories.length} {selectedTerritories.length === 1 ? "territory" : "territories"} selected
              </span>
            </div>
            <span className="text-sm font-bold text-primary">
              ${(totalCost / 100).toFixed(2)} distribution cost
            </span>
          </div>
        </Card>
      )}

      <div className="flex gap-2 pt-2">
        <Button variant="outline" onClick={onBack} className="flex-1">
          Back
        </Button>
        <Button
          onClick={onNext}
          disabled={selectedTerritories.length === 0}
          className="flex-1"
        >
          Next: Streaming Platforms
        </Button>
      </div>
    </div>
  );
}
