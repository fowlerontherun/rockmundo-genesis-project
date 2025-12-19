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
  Newspaper, Users, Star, Search, Filter, Globe, MapPin, 
  TrendingUp, DollarSign, Send, CheckCircle 
} from "lucide-react";

interface NewspaperItem {
  id: string;
  name: string;
  newspaper_type: string | null;
  country: string | null;
  circulation: number;
  quality_level: number | null;
  min_fame_required: number | null;
  genres: string[] | null;
  description: string | null;
  fame_boost_min: number | null;
  fame_boost_max: number | null;
  fan_boost_min: number | null;
  fan_boost_max: number | null;
  compensation_min: number | null;
  compensation_max: number | null;
}

const NewspapersBrowser = () => {
  const { currentCity } = useGameData();
  const { data: userBand } = useUserBand();
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [countryFilter, setCountryFilter] = useState<string>("all");
  const [genreFilter, setGenreFilter] = useState<string>("all");
  const [selectedNewspaper, setSelectedNewspaper] = useState<NewspaperItem | null>(null);

  useEffect(() => {
    if (currentCity?.country && countryFilter === "all") {
      setCountryFilter(currentCity.country);
    }
  }, [currentCity]);

  const { data: newspapers, isLoading } = useQuery({
    queryKey: ['newspapers-browser'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('newspapers')
        .select('*')
        .eq('is_active', true)
        .order('circulation', { ascending: false });
      
      if (error) throw error;
      return data as unknown as NewspaperItem[];
    }
  });

  const { data: existingSubmissions = [] } = useQuery({
    queryKey: ['newspaper-submissions', userBand?.id],
    queryFn: async () => {
      if (!userBand?.id) return [];
      const { data, error } = await supabase
        .from('newspaper_submissions')
        .select('newspaper_id')
        .eq('band_id', userBand.id)
        .in('status', ['pending', 'approved', 'scheduled']);
      if (error) throw error;
      return data.map(s => s.newspaper_id);
    },
    enabled: !!userBand?.id,
  });

  const filterOptions = useMemo(() => {
    const types = new Set<string>();
    const countries = new Set<string>();
    const genres = new Set<string>();

    newspapers?.forEach((paper) => {
      if (paper.newspaper_type) types.add(paper.newspaper_type);
      if (paper.country) countries.add(paper.country);
      paper.genres?.forEach((g) => genres.add(g));
    });

    return {
      types: Array.from(types).sort(),
      countries: Array.from(countries).sort(),
      genres: Array.from(genres).sort(),
    };
  }, [newspapers]);

  const filteredNewspapers = useMemo(() => {
    return newspapers?.filter(paper => {
      const matchesSearch = paper.name?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = typeFilter === "all" || paper.newspaper_type === typeFilter;
      const matchesCountry = countryFilter === "all" || paper.country === countryFilter;
      const matchesGenre = genreFilter === "all" || paper.genres?.includes(genreFilter);
      return matchesSearch && matchesType && matchesCountry && matchesGenre;
    }) || [];
  }, [newspapers, searchTerm, typeFilter, countryFilter, genreFilter]);

  const formatCirculation = (circ: number) => {
    if (circ >= 1000000) return `${(circ / 1000000).toFixed(1)}M`;
    if (circ >= 1000) return `${(circ / 1000).toFixed(0)}K`;
    return circ?.toString() || '0';
  };

  const isEligible = (paper: NewspaperItem) => {
    if (!userBand) return false;
    return !paper.min_fame_required || userBand.fame >= paper.min_fame_required;
  };

  const hasSubmission = (paperId: string) => existingSubmissions.includes(paperId);

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
          <Newspaper className="h-8 w-8 text-primary" />
          Newspapers
        </h1>
        <p className="text-muted-foreground">
          Browse newspapers for press coverage and interview opportunities
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
            placeholder="Search newspapers..."
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
        Showing {filteredNewspapers.length} of {newspapers?.length || 0} newspapers
      </p>

      {filteredNewspapers.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            No newspapers match your criteria
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredNewspapers.map(paper => (
            <Card key={paper.id} className="hover:shadow-lg transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <CardTitle className="text-lg">{paper.name}</CardTitle>
                  <div className="flex gap-1">
                    {paper.newspaper_type && (
                      <Badge variant="outline" className="capitalize">{paper.newspaper_type.replace('_', ' ')}</Badge>
                    )}
                    {paper.country && (
                      <Badge variant="secondary" className="text-xs">{paper.country}</Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span>{formatCirculation(paper.circulation)} circulation</span>
                </div>
                
                {paper.min_fame_required !== null && paper.min_fame_required > 0 && (
                  <div className="flex items-center gap-2 text-sm">
                    <Star className={`h-4 w-4 ${isEligible(paper) ? 'text-warning' : 'text-destructive'}`} />
                    <span>Min Fame: {paper.min_fame_required}</span>
                    {userBand && (
                      <span className="text-muted-foreground">(you: {userBand.fame})</span>
                    )}
                  </div>
                )}

                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  {paper.fame_boost_min != null && (
                    <span className="flex items-center gap-1">
                      <TrendingUp className="h-3 w-3" />+{paper.fame_boost_min}-{paper.fame_boost_max} fame
                    </span>
                  )}
                  {paper.compensation_min != null && (
                    <span className="flex items-center gap-1">
                      <DollarSign className="h-3 w-3" />${paper.compensation_min}-{paper.compensation_max}
                    </span>
                  )}
                </div>

                {paper.genres && paper.genres.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {paper.genres.slice(0, 3).map(genre => (
                      <Badge key={genre} variant="secondary" className="text-xs">
                        {genre}
                      </Badge>
                    ))}
                    {paper.genres.length > 3 && (
                      <Badge variant="secondary" className="text-xs">
                        +{paper.genres.length - 3}
                      </Badge>
                    )}
                  </div>
                )}

                {paper.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {paper.description}
                  </p>
                )}

                <div className="pt-2">
                  {hasSubmission(paper.id) ? (
                    <Button variant="outline" disabled className="w-full">
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Request Pending
                    </Button>
                  ) : (
                    <Button
                      variant={isEligible(paper) ? "default" : "outline"}
                      className="w-full"
                      disabled={!userBand}
                      onClick={() => setSelectedNewspaper(paper)}
                    >
                      <Send className="mr-2 h-4 w-4" />
                      {isEligible(paper) ? "Request Interview" : "Not Eligible"}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {selectedNewspaper && userBand && (
        <MediaSubmissionDialog
          open={!!selectedNewspaper}
          onOpenChange={(open) => !open && setSelectedNewspaper(null)}
          mediaType="newspaper"
          mediaItem={selectedNewspaper}
          bandId={userBand.id}
          bandFame={userBand.fame}
        />
      )}
    </div>
  );
};

export default NewspapersBrowser;
