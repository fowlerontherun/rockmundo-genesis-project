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
  Podcast, Mic, Headphones, Star, Search, Filter, Globe, MapPin,
  TrendingUp, DollarSign, Send, CheckCircle
} from "lucide-react";

interface PodcastShow {
  id: string;
  podcast_name: string;
  host_name: string | null;
  podcast_type: string | null;
  listener_base: number;
  episodes_per_week: number | null;
  min_fame_required: number | null;
  genres: string[] | null;
  description: string | null;
  country: string | null;
  fame_boost_min: number | null;
  fame_boost_max: number | null;
  fan_boost_min: number | null;
  fan_boost_max: number | null;
  compensation_min: number | null;
  compensation_max: number | null;
}

const PodcastsBrowser = () => {
  const { currentCity } = useGameData();
  const { data: userBand } = useUserBand();
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [countryFilter, setCountryFilter] = useState<string>("all");
  const [genreFilter, setGenreFilter] = useState<string>("all");
  const [selectedPodcast, setSelectedPodcast] = useState<PodcastShow | null>(null);

  useEffect(() => {
    if (currentCity?.country && countryFilter === "all") {
      setCountryFilter(currentCity.country);
    }
  }, [currentCity]);

  const { data: podcasts, isLoading } = useQuery({
    queryKey: ['podcasts-browser'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('podcasts')
        .select('*')
        .order('listener_base', { ascending: false });
      
      if (error) throw error;
      return data as unknown as PodcastShow[];
    }
  });

  const { data: existingSubmissions = [] } = useQuery({
    queryKey: ['podcast-submissions', userBand?.id],
    queryFn: async () => {
      if (!userBand?.id) return [];
      const { data, error } = await supabase
        .from('podcast_submissions')
        .select('podcast_id')
        .eq('band_id', userBand.id)
        .in('status', ['pending', 'approved', 'scheduled']);
      if (error) throw error;
      return data.map(s => s.podcast_id);
    },
    enabled: !!userBand?.id,
  });

  const filterOptions = useMemo(() => {
    const types = new Set<string>();
    const countries = new Set<string>();
    const genres = new Set<string>();

    podcasts?.forEach((pod) => {
      if (pod.podcast_type) types.add(pod.podcast_type);
      if (pod.country) countries.add(pod.country);
      pod.genres?.forEach((g) => genres.add(g));
    });

    return {
      types: Array.from(types).sort(),
      countries: Array.from(countries).sort(),
      genres: Array.from(genres).sort(),
    };
  }, [podcasts]);

  const filteredPodcasts = useMemo(() => {
    return podcasts?.filter(pod => {
      const matchesSearch = pod.podcast_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        pod.host_name?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = typeFilter === "all" || pod.podcast_type === typeFilter;
      const matchesCountry = countryFilter === "all" || pod.country === countryFilter;
      const matchesGenre = genreFilter === "all" || pod.genres?.includes(genreFilter);
      return matchesSearch && matchesType && matchesCountry && matchesGenre;
    }) || [];
  }, [podcasts, searchTerm, typeFilter, countryFilter, genreFilter]);

  const formatListenerBase = (listeners: number) => {
    if (listeners >= 1000000) return `${(listeners / 1000000).toFixed(1)}M`;
    if (listeners >= 1000) return `${(listeners / 1000).toFixed(0)}K`;
    return listeners?.toString() || '0';
  };

  const isEligible = (pod: PodcastShow) => {
    if (!userBand) return false;
    return !pod.min_fame_required || userBand.fame >= pod.min_fame_required;
  };

  const hasSubmission = (podId: string) => existingSubmissions.includes(podId);

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex flex-col gap-4">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Podcast className="h-8 w-8 text-primary" />
          Podcasts
        </h1>
        <p className="text-muted-foreground">
          Browse podcasts for guest appearance opportunities
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
            placeholder="Search podcasts or hosts..."
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
        Showing {filteredPodcasts.length} of {podcasts?.length || 0} podcasts
      </p>

      {filteredPodcasts.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            No podcasts match your criteria
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredPodcasts.map(pod => (
            <Card key={pod.id} className="hover:shadow-lg transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <CardTitle className="text-lg">{pod.podcast_name}</CardTitle>
                  <div className="flex gap-1">
                    {pod.podcast_type && (
                      <Badge variant="outline" className="capitalize">{pod.podcast_type.replace('_', ' ')}</Badge>
                    )}
                    {pod.country && (
                      <Badge variant="secondary" className="text-xs">{pod.country}</Badge>
                    )}
                  </div>
                </div>
                {pod.host_name && (
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <Mic className="h-3 w-3" />
                    {pod.host_name}
                  </p>
                )}
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <Headphones className="h-4 w-4 text-muted-foreground" />
                  <span>{formatListenerBase(pod.listener_base)} listeners</span>
                </div>
                {pod.episodes_per_week && (
                  <div className="flex items-center gap-2 text-sm">
                    <Podcast className="h-4 w-4 text-muted-foreground" />
                    <span>{pod.episodes_per_week} episodes/week</span>
                  </div>
                )}
                {pod.min_fame_required !== null && pod.min_fame_required > 0 && (
                  <div className="flex items-center gap-2 text-sm">
                    <Star className={`h-4 w-4 ${isEligible(pod) ? 'text-warning' : 'text-destructive'}`} />
                    <span>Min Fame: {pod.min_fame_required}</span>
                    {userBand && (
                      <span className="text-muted-foreground">(you: {userBand.fame})</span>
                    )}
                  </div>
                )}

                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  {pod.fame_boost_min != null && (
                    <span className="flex items-center gap-1">
                      <TrendingUp className="h-3 w-3" />+{pod.fame_boost_min}-{pod.fame_boost_max} fame
                    </span>
                  )}
                  {pod.compensation_min != null && (
                    <span className="flex items-center gap-1">
                      <DollarSign className="h-3 w-3" />${pod.compensation_min}-{pod.compensation_max}
                    </span>
                  )}
                </div>

                {pod.genres && pod.genres.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {pod.genres.slice(0, 3).map(genre => (
                      <Badge key={genre} variant="secondary" className="text-xs">
                        {genre}
                      </Badge>
                    ))}
                    {pod.genres.length > 3 && (
                      <Badge variant="secondary" className="text-xs">
                        +{pod.genres.length - 3}
                      </Badge>
                    )}
                  </div>
                )}
                {pod.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {pod.description}
                  </p>
                )}

                <div className="pt-2">
                  {hasSubmission(pod.id) ? (
                    <Button variant="outline" disabled className="w-full">
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Request Pending
                    </Button>
                  ) : (
                    <Button
                      variant={isEligible(pod) ? "default" : "outline"}
                      className="w-full"
                      disabled={!userBand}
                      onClick={() => setSelectedPodcast(pod)}
                    >
                      <Send className="mr-2 h-4 w-4" />
                      {isEligible(pod) ? "Request Appearance" : "Not Eligible"}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {selectedPodcast && userBand && (
        <MediaSubmissionDialog
          open={!!selectedPodcast}
          onOpenChange={(open) => !open && setSelectedPodcast(null)}
          mediaType="podcast"
          mediaItem={{
            id: selectedPodcast.id,
            name: selectedPodcast.podcast_name,
            min_fame_required: selectedPodcast.min_fame_required,
            genres: selectedPodcast.genres,
            fame_boost_min: selectedPodcast.fame_boost_min,
            fame_boost_max: selectedPodcast.fame_boost_max,
            fan_boost_min: selectedPodcast.fan_boost_min,
            fan_boost_max: selectedPodcast.fan_boost_max,
            compensation_min: selectedPodcast.compensation_min,
            compensation_max: selectedPodcast.compensation_max,
          }}
          bandId={userBand.id}
          bandFame={userBand.fame}
        />
      )}
    </div>
  );
};

export default PodcastsBrowser;
