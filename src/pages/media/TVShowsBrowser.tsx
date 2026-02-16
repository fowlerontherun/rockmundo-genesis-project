import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useGameData } from "@/hooks/useGameData";
import { Tv, Users, Clock, Star, Search, Globe, MapPin } from "lucide-react";
import { TVNetworkLogo } from "@/components/media/TVNetworkLogo";

interface TVShow {
  id: string;
  show_name: string;
  network_id: string | null;
  host_name: string | null;
  show_type: string | null;
  viewer_reach: number | null;
  time_slot: string | null;
  min_fame_required: number | null;
  description: string | null;
  tv_networks?: {
    name: string;
    country: string | null;
  } | null;
}

const TVShowsBrowser = () => {
  const { currentCity } = useGameData();
  const [searchTerm, setSearchTerm] = useState("");
  const [networkFilter, setNetworkFilter] = useState<string>("all");
  const [showTypeFilter, setShowTypeFilter] = useState<string>("all");
  const [countryFilter, setCountryFilter] = useState<string>("all");

  // Auto-set country filter based on user's current city
  useEffect(() => {
    if (currentCity?.country && countryFilter === "all") {
      setCountryFilter(currentCity.country);
    }
  }, [currentCity]);

  const { data: tvShows, isLoading: showsLoading } = useQuery({
    queryKey: ['tv-shows-browser'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tv_shows')
        .select(`
          *,
          tv_networks(name, country)
        `)
        .order('viewer_reach', { ascending: false });
      
      if (error) throw error;
      return data as unknown as TVShow[];
    }
  });

  const { data: networks } = useQuery({
    queryKey: ['tv-networks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tv_networks')
        .select('id, name, country')
        .order('name');
      
      if (error) throw error;
      return data;
    }
  });

  // Extract unique countries and show types
  const filterOptions = useMemo(() => {
    const countries = new Set<string>();
    const showTypes = new Set<string>();

    tvShows?.forEach((show) => {
      if (show.tv_networks?.country) countries.add(show.tv_networks.country);
      if (show.show_type) showTypes.add(show.show_type);
    });

    return {
      countries: Array.from(countries).sort(),
      showTypes: Array.from(showTypes).sort(),
    };
  }, [tvShows]);

  const filteredShows = useMemo(() => {
    return tvShows?.filter(show => {
      const matchesSearch = show.show_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        show.host_name?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesNetwork = networkFilter === "all" || show.network_id === networkFilter;
      const matchesType = showTypeFilter === "all" || show.show_type === showTypeFilter;
      const matchesCountry = countryFilter === "all" || show.tv_networks?.country === countryFilter;
      return matchesSearch && matchesNetwork && matchesType && matchesCountry;
    }) || [];
  }, [tvShows, searchTerm, networkFilter, showTypeFilter, countryFilter]);

  const formatViewerReach = (viewers: number | null) => {
    if (!viewers) return '0';
    if (viewers >= 1000000) return `${(viewers / 1000000).toFixed(1)}M`;
    if (viewers >= 1000) return `${(viewers / 1000).toFixed(0)}K`;
    return viewers.toString();
  };

  const getTimeSlotLabel = (slot: string | null) => {
    const labels: Record<string, string> = {
      morning: 'Morning',
      afternoon: 'Afternoon',
      prime_time: 'Prime Time',
      late_night: 'Late Night',
      weekend: 'Weekend',
    };
    return slot ? labels[slot] || slot : 'Various';
  };

  if (showsLoading) {
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
          <Tv className="h-8 w-8 text-primary" />
          TV Shows
        </h1>
        <p className="text-muted-foreground">
          Browse TV shows for appearance opportunities
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
            placeholder="Search shows or hosts..."
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

        <Select value={networkFilter} onValueChange={setNetworkFilter}>
          <SelectTrigger className="w-full md:w-48">
            <SelectValue placeholder="Network" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Networks</SelectItem>
            {networks?.map(network => (
              <SelectItem key={network.id} value={network.id}>
                <span className="flex items-center gap-2">
                  <TVNetworkLogo networkName={network.name} size="sm" showTooltip={false} />
                  {network.name}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={showTypeFilter} onValueChange={setShowTypeFilter}>
          <SelectTrigger className="w-full md:w-40">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {filterOptions.showTypes.map(type => (
              <SelectItem key={type} value={type} className="capitalize">{type.replace('_', ' ')}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Results count */}
      <p className="text-sm text-muted-foreground">
        Showing {filteredShows.length} of {tvShows?.length || 0} shows
      </p>

      {/* TV Shows Grid */}
      {filteredShows.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            No TV shows match your criteria
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredShows.map(show => (
            <Card key={show.id} className="hover:shadow-lg transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <CardTitle className="text-lg">{show.show_name}</CardTitle>
                  {show.show_type && (
                    <Badge variant="outline" className="capitalize">
                      {show.show_type.replace('_', ' ')}
                    </Badge>
                  )}
                </div>
                {show.tv_networks && (
                  <div className="flex items-center gap-2 mt-1">
                    <TVNetworkLogo networkName={show.tv_networks.name} size="sm" />
                    <span className="text-sm text-muted-foreground">{show.tv_networks.name}</span>
                    {show.tv_networks.country && (
                      <Badge variant="secondary" className="text-xs">{show.tv_networks.country}</Badge>
                    )}
                  </div>
                )}
              </CardHeader>
              <CardContent className="space-y-3">
                {show.host_name && (
                  <p className="text-sm">
                    <span className="text-muted-foreground">Host:</span> {show.host_name}
                  </p>
                )}
                
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="flex items-center gap-1">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span>{getTimeSlotLabel(show.time_slot)}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span>{formatViewerReach(show.viewer_reach)} viewers</span>
                  </div>
                </div>

                {show.min_fame_required !== null && show.min_fame_required > 0 && (
                  <div className="flex items-center gap-1 text-sm">
                    <Star className="h-4 w-4 text-warning" />
                    <span>Min Fame: {show.min_fame_required}</span>
                  </div>
                )}

                {show.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {show.description}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default TVShowsBrowser;
