import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Disc3, Search, MapPin, Star, Users, ArrowRight, Crown, Loader2, Building2, ShoppingCart } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageLayout } from "@/components/ui/PageLayout";
import { PageHeader } from "@/components/ui/PageHeader";
import { supabase } from "@/integrations/supabase/client";
import { normalizeNightClubRecord, type CityNightClub } from "@/utils/worldEnvironment";
import { useAllClubReputations, getTierLabel, getTierColor, type ClubReputation } from "@/hooks/useClubReputation";
import { useOwnedNightclubs, usePurchaseNightclub, getPurchasePrice } from "@/hooks/useNightclubOwnership";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { useOptionalGameData } from "@/hooks/useGameData";

const QUALITY_LABELS: Record<number, string> = {
  1: "Underground",
  2: "Neighborhood",
  3: "Boutique",
  4: "Premier",
  5: "Legendary",
};

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

interface ClubWithCity extends CityNightClub {
  cityName: string;
  country: string;
}

const NightclubHub = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [qualityFilter, setQualityFilter] = useState<string>("all");
  const [cityFilter, setCityFilter] = useState<string>("all");

  const { data: reputations = [] } = useAllClubReputations();
  const { data: ownedClubs = [] } = useOwnedNightclubs();
  const purchaseClub = usePurchaseNightclub();
  const gameData = useOptionalGameData();
  const playerCityId = gameData?.profile?.current_city_id ?? null;

  const ownedClubIds = useMemo(() => new Set(ownedClubs.map((c) => c.club_id)), [ownedClubs]);
  const repMap = useMemo(() => {
    const m = new Map<string, ClubReputation>();
    reputations.forEach((r) => m.set(r.club_id, r));
    return m;
  }, [reputations]);

  const { data: clubs = [], isLoading } = useQuery({
    queryKey: ["all-nightclubs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("city_night_clubs")
        .select("*, cities:city_id(name, country)")
        .order("quality_level", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((row: any) => {
        const normalized = normalizeNightClubRecord(row as Record<string, unknown>);
        return {
          ...normalized,
          cityName: row.cities?.name ?? "Unknown",
          country: row.cities?.country ?? "",
        } as ClubWithCity;
      });
    },
  });

  const cities = useMemo(() => {
    const set = new Set<string>();
    clubs.forEach((c) => set.add(c.cityName));
    return Array.from(set).sort();
  }, [clubs]);

  const filtered = useMemo(() => {
    return clubs.filter((club) => {
      if (search && !club.name.toLowerCase().includes(search.toLowerCase()) && !club.cityName.toLowerCase().includes(search.toLowerCase())) return false;
      if (qualityFilter !== "all" && club.qualityLevel !== Number(qualityFilter)) return false;
      if (cityFilter !== "all" && club.cityName !== cityFilter) return false;
      return true;
    });
  }, [clubs, search, qualityFilter, cityFilter]);

  return (
    <PageLayout>
      <PageHeader
        title="Nightclubs"
        subtitle={`${clubs.length} venues worldwide`}
        icon={Disc3}
        backTo="/hub/world-social"
        backLabel="Back to World"
      />

      {/* Filters */}
      <Card>
        <CardContent className="pt-4 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search clubs or cities..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex gap-2">
            <Select value={qualityFilter} onValueChange={setQualityFilter}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Quality" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Tiers</SelectItem>
                {[1, 2, 3, 4, 5].map((q) => (
                  <SelectItem key={q} value={String(q)}>{QUALITY_LABELS[q]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={cityFilter} onValueChange={setCityFilter}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="City" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Cities</SelectItem>
                {cities.map((city) => (
                  <SelectItem key={city} value={city}>{city}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No nightclubs match your filters.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((club) => {
            const rep = repMap.get(club.id);
            const qualityLabel = QUALITY_LABELS[club.qualityLevel] ?? `Tier ${club.qualityLevel}`;
            return (
              <Card
                key={club.id}
                className="cursor-pointer transition-colors hover:border-primary/50"
                onClick={() => navigate(`/nightclub/${club.id}`)}
              >
                <CardContent className="py-3 px-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm truncate">{club.name}</span>
                        <Badge variant="secondary" className="text-[10px]">{qualityLabel}</Badge>
                        {rep && (
                          <Badge variant="outline" className={`text-[10px] ${getTierColor(rep.reputation_tier)}`}>
                            <Crown className="h-2.5 w-2.5 mr-0.5" />
                            {getTierLabel(rep.reputation_tier)}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                        <MapPin className="h-3 w-3" />
                        <span>{club.cityName}</span>
                        {club.coverCharge ? (
                          <span>• Cover {currencyFormatter.format(club.coverCharge)}</span>
                        ) : null}
                        {club.capacity ? (
                          <span>• Cap {club.capacity}</span>
                        ) : null}
                        {rep && (
                          <span>• {rep.visit_count} visits</span>
                        )}
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </PageLayout>
  );
};

export default NightclubHub;
