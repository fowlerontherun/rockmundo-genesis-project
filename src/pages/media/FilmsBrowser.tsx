import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Film, DollarSign, Star, Search, Filter, Clapperboard } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface FilmProduction {
  id: string;
  title: string;
  film_type: string;
  genre: string | null;
  description: string | null;
  min_fame_required: number;
  compensation_min: number | null;
  compensation_max: number | null;
  fame_boost: number | null;
  filming_duration_days: number | null;
  is_available: boolean;
}

const FilmsBrowser = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [availableOnly, setAvailableOnly] = useState<string>("all");

  const { data: films, isLoading } = useQuery({
    queryKey: ['films-browser'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('film_productions')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as unknown as FilmProduction[];
    }
  });

  const filmTypes = [...new Set(films?.map(f => f.film_type).filter(Boolean) || [])];

  const filteredFilms = films?.filter(film => {
    const matchesSearch = film.title?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = typeFilter === "all" || film.film_type === typeFilter;
    const matchesAvailable = availableOnly === "all" || (availableOnly === "available" && film.is_available);
    return matchesSearch && matchesType && matchesAvailable;
  });

  const formatCompensation = (min: number | null, max: number | null) => {
    if (!min && !max) return "TBD";
    const formatNum = (n: number) => {
      if (n >= 1000000) return `$${(n / 1000000).toFixed(1)}M`;
      if (n >= 1000) return `$${(n / 1000).toFixed(0)}K`;
      return `$${n}`;
    };
    if (min && max) return `${formatNum(min)} - ${formatNum(max)}`;
    if (min) return `From ${formatNum(min)}`;
    if (max) return `Up to ${formatNum(max)}`;
    return "TBD";
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
          <Film className="h-8 w-8 text-primary" />
          Film Productions
        </h1>
        <p className="text-muted-foreground">
          Browse film and TV production opportunities for cameos and roles
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search films..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-full md:w-48">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Film Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {filmTypes.map(type => (
              <SelectItem key={type} value={type}>{type.replace('_', ' ')}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={availableOnly} onValueChange={setAvailableOnly}>
          <SelectTrigger className="w-full md:w-48">
            <Clapperboard className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Availability" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="available">Available Only</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Results count */}
      <p className="text-sm text-muted-foreground">
        Showing {filteredFilms?.length || 0} productions
      </p>

      {/* Films Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredFilms?.map(film => (
          <Card key={film.id} className="hover:shadow-lg transition-shadow">
            <CardHeader className="pb-2">
              <div className="flex justify-between items-start">
                <CardTitle className="text-lg">{film.title}</CardTitle>
                <Badge variant={film.is_available ? "default" : "secondary"}>
                  {film.is_available ? 'Available' : 'Unavailable'}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {film.film_type?.replace('_', ' ')}
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              {film.genre && (
                <Badge variant="outline">{film.genre}</Badge>
              )}
              <div className="flex items-center gap-2 text-sm">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <span>{formatCompensation(film.compensation_min, film.compensation_max)}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Star className="h-4 w-4 text-muted-foreground" />
                <span>Min Fame: {film.min_fame_required}</span>
              </div>
              {film.filming_duration_days && (
                <div className="flex items-center gap-2 text-sm">
                  <Clapperboard className="h-4 w-4 text-muted-foreground" />
                  <span>{film.filming_duration_days} filming days</span>
                </div>
              )}
              {film.fame_boost && (
                <div className="text-sm text-green-600">
                  +{film.fame_boost} fame boost
                </div>
              )}
              {film.description && (
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {film.description}
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredFilms?.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <Film className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No film productions found matching your criteria</p>
        </div>
      )}
    </div>
  );
};

export default FilmsBrowser;
