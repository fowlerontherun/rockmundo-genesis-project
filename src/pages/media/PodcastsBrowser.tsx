import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Podcast, Headphones, Star, Search, Filter, Mic } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface PodcastShow {
  id: string;
  podcast_name: string;
  host_name: string | null;
  podcast_type: string;
  listener_base: number;
  episodes_per_week: number | null;
  min_fame_required: number;
  genres: string[] | null;
  description: string | null;
}

const PodcastsBrowser = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");

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

  const types = [...new Set(podcasts?.map(p => p.podcast_type).filter(Boolean) || [])];

  const filteredPodcasts = podcasts?.filter(pod => {
    const matchesSearch = pod.podcast_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      pod.host_name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = typeFilter === "all" || pod.podcast_type === typeFilter;
    return matchesSearch && matchesType;
  });

  const formatListenerBase = (listeners: number) => {
    if (listeners >= 1000000) return `${(listeners / 1000000).toFixed(1)}M`;
    if (listeners >= 1000) return `${(listeners / 1000).toFixed(0)}K`;
    return listeners?.toString() || '0';
  };

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
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-full md:w-48">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {types.map(type => (
              <SelectItem key={type} value={type}>{type.replace('_', ' ')}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Results count */}
      <p className="text-sm text-muted-foreground">
        Showing {filteredPodcasts?.length || 0} podcasts
      </p>

      {/* Podcasts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredPodcasts?.map(pod => (
          <Card key={pod.id} className="hover:shadow-lg transition-shadow">
            <CardHeader className="pb-2">
              <div className="flex justify-between items-start">
                <CardTitle className="text-lg">{pod.podcast_name}</CardTitle>
                <Badge variant="outline">{pod.podcast_type?.replace('_', ' ')}</Badge>
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
              <div className="flex items-center gap-2 text-sm">
                <Star className="h-4 w-4 text-muted-foreground" />
                <span>Min Fame: {pod.min_fame_required}</span>
              </div>
              {pod.genres && pod.genres.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {pod.genres.slice(0, 4).map(genre => (
                    <Badge key={genre} variant="secondary" className="text-xs">
                      {genre}
                    </Badge>
                  ))}
                </div>
              )}
              {pod.description && (
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {pod.description}
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredPodcasts?.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <Podcast className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No podcasts found matching your criteria</p>
        </div>
      )}
    </div>
  );
};

export default PodcastsBrowser;
