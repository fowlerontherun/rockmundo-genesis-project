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
  Globe, Search, Filter, MapPin,
  TrendingUp, DollarSign, Send, CheckCircle, ExternalLink, Users, Star
} from "lucide-react";

interface Website {
  id: string;
  name: string;
  website_url: string | null;
  country: string | null;
  description: string | null;
  traffic_rank: number | null;
  min_fame_required: number | null;
  compensation_min: number | null;
  compensation_max: number | null;
  fame_boost_min: number | null;
  fame_boost_max: number | null;
  fan_boost_min: number | null;
  fan_boost_max: number | null;
  genres: string[] | null;
  is_active: boolean | null;
}

const WebsitesBrowser = () => {
  const { currentCity } = useGameData();
  const { data: userBand } = useUserBand();
  const [searchTerm, setSearchTerm] = useState("");
  const [countryFilter, setCountryFilter] = useState<string>("all");
  const [rankFilter, setRankFilter] = useState<string>("all");
  const [selectedWebsite, setSelectedWebsite] = useState<Website | null>(null);

  const { data: websites, isLoading } = useQuery({
    queryKey: ['websites-browser'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('websites')
        .select('*')
        .eq('is_active', true)
        .order('traffic_rank', { ascending: true });
      
      if (error) throw error;
      return data as Website[];
    }
  });

  // Auto-set country filter if websites exist in that country
  useEffect(() => {
    if (currentCity?.country && countryFilter === "all" && websites) {
      const hasWebsInCountry = websites.some(w => w.country === currentCity.country);
      if (hasWebsInCountry) {
        setCountryFilter(currentCity.country);
      }
    }
  }, [currentCity, websites, countryFilter]);

  const { data: existingSubmissions = [] } = useQuery({
    queryKey: ['website-submissions', userBand?.id],
    queryFn: async () => {
      if (!userBand?.id) return [];
      const { data, error } = await supabase
        .from('website_submissions')
        .select('website_id')
        .eq('band_id', userBand.id)
        .in('status', ['pending', 'approved', 'scheduled']);
      if (error) throw error;
      return data.map(s => s.website_id);
    },
    enabled: !!userBand?.id,
  });

  const filterOptions = useMemo(() => {
    const countries = new Set<string>();

    websites?.forEach((web) => {
      if (web.country) countries.add(web.country);
    });

    return {
      countries: Array.from(countries).sort(),
    };
  }, [websites]);

  const filteredWebsites = useMemo(() => {
    return websites?.filter(web => {
      const matchesSearch = web.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        web.description?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCountry = countryFilter === "all" || web.country === countryFilter;
      
      let matchesRank = true;
      if (rankFilter !== "all" && web.traffic_rank) {
        if (rankFilter === "top10k") matchesRank = web.traffic_rank <= 10000;
        else if (rankFilter === "top50k") matchesRank = web.traffic_rank <= 50000;
        else if (rankFilter === "top100k") matchesRank = web.traffic_rank <= 100000;
      }
      
      return matchesSearch && matchesCountry && matchesRank;
    }) || [];
  }, [websites, searchTerm, countryFilter, rankFilter]);

  const formatTrafficRank = (rank: number | null) => {
    if (!rank) return 'N/A';
    if (rank <= 1000) return `Top ${rank}`;
    if (rank <= 10000) return `Top 10K`;
    if (rank <= 50000) return `Top 50K`;
    if (rank <= 100000) return `Top 100K`;
    return `${(rank / 1000).toFixed(0)}K`;
  };

  const getRankColor = (rank: number | null) => {
    if (!rank) return 'bg-muted text-muted-foreground';
    if (rank <= 1000) return 'bg-amber-500/20 text-amber-400';
    if (rank <= 10000) return 'bg-blue-500/20 text-blue-400';
    if (rank <= 50000) return 'bg-emerald-500/20 text-emerald-400';
    return 'bg-muted text-muted-foreground';
  };

  const isEligible = (web: Website) => {
    if (!userBand) return false;
    return !web.min_fame_required || userBand.fame >= web.min_fame_required;
  };

  const hasSubmission = (webId: string) => existingSubmissions.includes(webId);

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
          <Globe className="h-8 w-8 text-primary" />
          Music Websites & Publications
        </h1>
        <p className="text-muted-foreground">
          Browse websites and online publications for feature opportunities
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
            placeholder="Search websites..."
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

        <Select value={rankFilter} onValueChange={setRankFilter}>
          <SelectTrigger className="w-full md:w-40">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Traffic Rank" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Ranks</SelectItem>
            <SelectItem value="top10k">Top 10K</SelectItem>
            <SelectItem value="top50k">Top 50K</SelectItem>
            <SelectItem value="top100k">Top 100K</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <p className="text-sm text-muted-foreground">
        Showing {filteredWebsites.length} of {websites?.length || 0} websites
      </p>

      {filteredWebsites.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            No websites match your criteria
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredWebsites.map(web => (
            <Card key={web.id} className="hover:shadow-lg transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <CardTitle className="text-lg flex items-center gap-2">
                    {web.name}
                    {web.website_url && (
                      <a 
                        href={web.website_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-primary"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    )}
                  </CardTitle>
                  <div className="flex gap-1">
                    <Badge className={getRankColor(web.traffic_rank)}>
                      {formatTrafficRank(web.traffic_rank)}
                    </Badge>
                    {web.country && (
                      <Badge variant="secondary" className="text-xs">{web.country}</Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {web.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {web.description}
                  </p>
                )}

                {web.min_fame_required !== null && web.min_fame_required > 0 && (
                  <div className="flex items-center gap-2 text-sm">
                    <Star className={`h-4 w-4 ${isEligible(web) ? 'text-warning' : 'text-destructive'}`} />
                    <span>Min Fame: {web.min_fame_required}</span>
                    {userBand && (
                      <span className="text-muted-foreground">(you: {userBand.fame})</span>
                    )}
                  </div>
                )}

                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  {web.fame_boost_min != null && (
                    <span className="flex items-center gap-1">
                      <TrendingUp className="h-3 w-3" />+{web.fame_boost_min}-{web.fame_boost_max} fame
                    </span>
                  )}
                  {web.fan_boost_min != null && (
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" />+{web.fan_boost_min}-{web.fan_boost_max} fans
                    </span>
                  )}
                  {web.compensation_min != null && (
                    <span className="flex items-center gap-1">
                      <DollarSign className="h-3 w-3" />${web.compensation_min}-{web.compensation_max}
                    </span>
                  )}
                </div>

                {web.genres && web.genres.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {web.genres.slice(0, 3).map(genre => (
                      <Badge key={genre} variant="secondary" className="text-xs">
                        {genre}
                      </Badge>
                    ))}
                    {web.genres.length > 3 && (
                      <Badge variant="secondary" className="text-xs">
                        +{web.genres.length - 3}
                      </Badge>
                    )}
                  </div>
                )}

                <div className="pt-2">
                  {hasSubmission(web.id) ? (
                    <Button variant="outline" disabled className="w-full">
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Request Pending
                    </Button>
                  ) : (
                    <Button
                      variant={isEligible(web) ? "default" : "outline"}
                      className="w-full"
                      disabled={!userBand}
                      onClick={() => setSelectedWebsite(web)}
                    >
                      <Send className="mr-2 h-4 w-4" />
                      {isEligible(web) ? "Request Feature" : "Not Eligible"}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {selectedWebsite && userBand && (
        <MediaSubmissionDialog
          open={!!selectedWebsite}
          onOpenChange={(open) => !open && setSelectedWebsite(null)}
          mediaType="website"
          mediaItem={{
            id: selectedWebsite.id,
            name: selectedWebsite.name,
            min_fame_required: selectedWebsite.min_fame_required,
            genres: selectedWebsite.genres,
            fame_boost_min: selectedWebsite.fame_boost_min,
            fame_boost_max: selectedWebsite.fame_boost_max,
            fan_boost_min: selectedWebsite.fan_boost_min,
            fan_boost_max: selectedWebsite.fan_boost_max,
            compensation_min: selectedWebsite.compensation_min,
            compensation_max: selectedWebsite.compensation_max,
          }}
          bandId={userBand.id}
          bandFame={userBand.fame}
        />
      )}
    </div>
  );
};

export default WebsitesBrowser;