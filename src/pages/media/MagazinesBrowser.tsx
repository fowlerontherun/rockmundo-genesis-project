import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useGameData } from "@/hooks/useGameData";
import { useUserBand } from "@/hooks/useUserBand";
import { MediaSubmissionDialog } from "@/components/media/MediaSubmissionDialog";
import { 
  BookOpen, Users, Star, Search, Filter, Globe, MapPin, 
  TrendingUp, DollarSign, Send, CheckCircle, Calendar 
} from "lucide-react";

interface MagazineItem {
  id: string;
  name: string;
  magazine_type: string | null;
  country: string | null;
  readership: number;
  quality_level: number | null;
  min_fame_required: number | null;
  genres: string[] | null;
  description: string | null;
  publication_frequency: string | null;
  fame_boost_min: number | null;
  fame_boost_max: number | null;
  fan_boost_min: number | null;
  fan_boost_max: number | null;
  compensation_min: number | null;
  compensation_max: number | null;
}

const MagazinesBrowser = () => {
  const { currentCity } = useGameData();
  const { data: userBand } = useUserBand();
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [countryFilter, setCountryFilter] = useState<string>("all");
  const [genreFilter, setGenreFilter] = useState<string>("all");
  const [selectedMagazine, setSelectedMagazine] = useState<MagazineItem | null>(null);

  useEffect(() => {
    if (currentCity?.country && countryFilter === "all") {
      setCountryFilter(currentCity.country);
    }
  }, [currentCity]);

  const { data: magazines, isLoading } = useQuery({
    queryKey: ['magazines-browser'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('magazines')
        .select('*')
        .eq('is_active', true)
        .order('readership', { ascending: false });
      
      if (error) throw error;
      return data as unknown as MagazineItem[];
    }
  });

  const { data: existingSubmissions = [] } = useQuery({
    queryKey: ['magazine-submissions', userBand?.id],
    queryFn: async () => {
      if (!userBand?.id) return [];
      const { data, error } = await supabase
        .from('magazine_submissions')
        .select('magazine_id')
        .eq('band_id', userBand.id)
        .in('status', ['pending', 'approved', 'scheduled']);
      if (error) throw error;
      return data.map(s => s.magazine_id);
    },
    enabled: !!userBand?.id,
  });

  const filterOptions = useMemo(() => {
    const types = new Set<string>();
    const countries = new Set<string>();
    const genres = new Set<string>();

    magazines?.forEach((mag) => {
      if (mag.magazine_type) types.add(mag.magazine_type);
      if (mag.country) countries.add(mag.country);
      mag.genres?.forEach((g) => genres.add(g));
    });

    return {
      types: Array.from(types).sort(),
      countries: Array.from(countries).sort(),
      genres: Array.from(genres).sort(),
    };
  }, [magazines]);

  const filteredMagazines = useMemo(() => {
    return magazines?.filter(mag => {
      const matchesSearch = mag.name?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = typeFilter === "all" || mag.magazine_type === typeFilter;
      const matchesCountry = countryFilter === "all" || mag.country === countryFilter;
      const matchesGenre = genreFilter === "all" || mag.genres?.includes(genreFilter);
      return matchesSearch && matchesType && matchesCountry && matchesGenre;
    }) || [];
  }, [magazines, searchTerm, typeFilter, countryFilter, genreFilter]);

  const formatReadership = (readers: number) => {
    if (readers >= 1000000) return `${(readers / 1000000).toFixed(1)}M`;
    if (readers >= 1000) return `${(readers / 1000).toFixed(0)}K`;
    return readers?.toString() || '0';
  };

  const isEligible = (mag: MagazineItem) => {
    if (!userBand) return false;
    return !mag.min_fame_required || userBand.fame >= mag.min_fame_required;
  };

  const hasSubmission = (magId: string) => existingSubmissions.includes(magId);

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-64" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex flex-col gap-4">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <BookOpen className="h-8 w-8 text-primary" />
          Magazines
        </h1>
        <p className="text-muted-foreground">
          Browse magazines for features and interview opportunities
          {currentCity && (
            <span className="ml-2 text-xs">
              <MapPin className="h-3 w-3 inline" /> Currently in {currentCity.name}, {currentCity.country}
            </span>
          )}
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search magazines..."
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

        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-full md:w-40">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {filterOptions.types.map(type => (
              <SelectItem key={type} value={type} className="capitalize">{type.replace('_', ' ')}</SelectItem>
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

      <p className="text-sm text-muted-foreground">
        Showing {filteredMagazines.length} of {magazines?.length || 0} magazines
      </p>

      {filteredMagazines.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            No magazines match your criteria
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredMagazines.map(mag => (
            <Card key={mag.id} className="hover:shadow-lg transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <CardTitle className="text-lg">{mag.name}</CardTitle>
                  <div className="flex gap-1">
                    {mag.magazine_type && (
                      <Badge variant="outline" className="capitalize">{mag.magazine_type.replace('_', ' ')}</Badge>
                    )}
                    {mag.country && (
                      <Badge variant="secondary" className="text-xs">{mag.country}</Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span>{formatReadership(mag.readership)} readers</span>
                </div>

                {mag.publication_frequency && (
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="capitalize">{mag.publication_frequency}</span>
                  </div>
                )}
                
                {mag.min_fame_required !== null && mag.min_fame_required > 0 && (
                  <div className="flex items-center gap-2 text-sm">
                    <Star className={`h-4 w-4 ${isEligible(mag) ? 'text-warning' : 'text-destructive'}`} />
                    <span>Min Fame: {mag.min_fame_required}</span>
                    {userBand && (
                      <span className="text-muted-foreground">(you: {userBand.fame})</span>
                    )}
                  </div>
                )}

                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  {mag.fame_boost_min != null && (
                    <span className="flex items-center gap-1">
                      <TrendingUp className="h-3 w-3" />+{mag.fame_boost_min}-{mag.fame_boost_max} fame
                    </span>
                  )}
                  {mag.compensation_min != null && (
                    <span className="flex items-center gap-1">
                      <DollarSign className="h-3 w-3" />${mag.compensation_min}-{mag.compensation_max}
                    </span>
                  )}
                </div>

                {mag.genres && mag.genres.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {mag.genres.slice(0, 3).map(genre => (
                      <Badge key={genre} variant="secondary" className="text-xs">
                        {genre}
                      </Badge>
                    ))}
                    {mag.genres.length > 3 && (
                      <Badge variant="secondary" className="text-xs">
                        +{mag.genres.length - 3}
                      </Badge>
                    )}
                  </div>
                )}

                {mag.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {mag.description}
                  </p>
                )}

                <div className="pt-2">
                  {hasSubmission(mag.id) ? (
                    <Button variant="outline" disabled className="w-full">
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Request Pending
                    </Button>
                  ) : (
                    <Button
                      variant={isEligible(mag) ? "default" : "outline"}
                      className="w-full"
                      disabled={!userBand}
                      onClick={() => setSelectedMagazine(mag)}
                    >
                      <Send className="mr-2 h-4 w-4" />
                      {isEligible(mag) ? "Apply for Feature" : "Not Eligible"}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {selectedMagazine && userBand && (
        <MediaSubmissionDialog
          open={!!selectedMagazine}
          onOpenChange={(open) => !open && setSelectedMagazine(null)}
          mediaType="magazine"
          mediaItem={selectedMagazine}
          bandId={userBand.id}
          bandFame={userBand.fame}
        />
      )}
    </div>
  );
};

export default MagazinesBrowser;
