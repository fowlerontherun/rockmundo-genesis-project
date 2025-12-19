import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tv, Users, Clock, Star, Search, Filter } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface TVShow {
  id: string;
  show_name: string;
  network_id: string;
  host_name: string | null;
  show_type: string;
  viewer_reach: number;
  time_slot: string;
  min_fame_required: number;
  description: string | null;
  tv_networks?: {
    name: string;
    country: string;
  };
}

const TVShowsBrowser = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [networkFilter, setNetworkFilter] = useState<string>("all");
  const [showTypeFilter, setShowTypeFilter] = useState<string>("all");

  const { data: tvShows, isLoading } = useQuery({
    queryKey: ['tv-shows-browser'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tv_shows')
        .select(`
          *,
          tv_networks (name, country)
        `)
        .order('viewer_reach', { ascending: false });
      
      if (error) throw error;
      return data as unknown as TVShow[];
    }
  });

  const { data: networks } = useQuery({
    queryKey: ['tv-networks-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tv_networks')
        .select('id, name')
        .order('name');
      if (error) throw error;
      return data;
    }
  });

  const filteredShows = tvShows?.filter(show => {
    const matchesSearch = show.show_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      show.host_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      show.tv_networks?.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesNetwork = networkFilter === "all" || show.network_id === networkFilter;
    const matchesType = showTypeFilter === "all" || show.show_type === showTypeFilter;
    return matchesSearch && matchesNetwork && matchesType;
  });

  const formatViewerReach = (reach: number) => {
    if (reach >= 1000000) return `${(reach / 1000000).toFixed(1)}M`;
    if (reach >= 1000) return `${(reach / 1000).toFixed(0)}K`;
    return reach?.toString() || '0';
  };

  const getTimeSlotLabel = (slot: string) => {
    const labels: Record<string, string> = {
      'morning_drive': 'Morning',
      'midday': 'Midday',
      'afternoon_drive': 'Afternoon',
      'prime_time': 'Prime Time',
      'late_night': 'Late Night',
      'overnight': 'Overnight',
      'weekend': 'Weekend'
    };
    return labels[slot] || slot;
  };

  const showTypes = ['talk_show', 'variety', 'music', 'news', 'entertainment', 'reality'];

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
          <Tv className="h-8 w-8 text-primary" />
          TV Shows
        </h1>
        <p className="text-muted-foreground">
          Browse TV shows and find opportunities for media appearances
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search shows, hosts, or networks..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={networkFilter} onValueChange={setNetworkFilter}>
          <SelectTrigger className="w-full md:w-48">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Network" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Networks</SelectItem>
            {networks?.map(network => (
              <SelectItem key={network.id} value={network.id}>{network.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={showTypeFilter} onValueChange={setShowTypeFilter}>
          <SelectTrigger className="w-full md:w-48">
            <SelectValue placeholder="Show Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {showTypes.map(type => (
              <SelectItem key={type} value={type}>{type.replace('_', ' ')}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Results count */}
      <p className="text-sm text-muted-foreground">
        Showing {filteredShows?.length || 0} TV shows
      </p>

      {/* Shows Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredShows?.map(show => (
          <Card key={show.id} className="hover:shadow-lg transition-shadow">
            <CardHeader className="pb-2">
              <div className="flex justify-between items-start">
                <CardTitle className="text-lg">{show.show_name}</CardTitle>
                <Badge variant="outline">{show.show_type?.replace('_', ' ')}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {show.tv_networks?.name} • {show.tv_networks?.country}
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              {show.host_name && (
                <div className="flex items-center gap-2 text-sm">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span>Host: {show.host_name}</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span>{getTimeSlotLabel(show.time_slot)}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Tv className="h-4 w-4 text-muted-foreground" />
                <span>{formatViewerReach(show.viewer_reach)} viewers</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Star className="h-4 w-4 text-muted-foreground" />
                <span>Min Fame: {show.min_fame_required}</span>
              </div>
              {show.description && (
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {show.description}
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredShows?.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <Tv className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No TV shows found matching your criteria</p>
        </div>
      )}
    </div>
  );
};

export default TVShowsBrowser;
