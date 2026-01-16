import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Filter, MapPin, Music, Building } from 'lucide-react';

interface VenueFiltersProps {
  selectedCountries: string[];
  countryFilter: string | null;
  cityFilter: string | null;
  genreFilter: string | null;
  onCountryFilterChange: (country: string | null) => void;
  onCityFilterChange: (city: string | null) => void;
  onGenreFilterChange: (genre: string | null) => void;
}

export function VenueFilters({
  selectedCountries,
  countryFilter,
  cityFilter,
  genreFilter,
  onCountryFilterChange,
  onCityFilterChange,
  onGenreFilterChange,
}: VenueFiltersProps) {
  // Fetch cities in selected countries
  const { data: cities } = useQuery({
    queryKey: ['venue-filter-cities', selectedCountries, countryFilter],
    queryFn: async () => {
      if (selectedCountries.length === 0) return [];
      
      let query = supabase
        .from('cities')
        .select('id, name, country')
        .in('country', selectedCountries);
      
      if (countryFilter) {
        query = query.eq('country', countryFilter);
      }
      
      const { data, error } = await query.order('name');
      if (error) throw error;
      return data || [];
    },
    enabled: selectedCountries.length > 0,
  });

  // Common music genres for venues
  const genres = [
    'Rock', 'Pop', 'Metal', 'Jazz', 'Blues', 'Country', 'Hip Hop', 
    'Electronic', 'Indie', 'Punk', 'Folk', 'R&B', 'Classical'
  ];

  const clearFilters = () => {
    onCountryFilterChange(null);
    onCityFilterChange(null);
    onGenreFilterChange(null);
  };

  const hasActiveFilters = countryFilter || cityFilter || genreFilter;

  return (
    <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4" />
          <span className="font-medium">Venue Filters</span>
        </div>
        {hasActiveFilters && (
          <Badge 
            variant="outline" 
            className="cursor-pointer hover:bg-destructive/10"
            onClick={clearFilters}
          >
            Clear All
          </Badge>
        )}
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Country Filter */}
        <div className="space-y-2">
          <Label className="flex items-center gap-1 text-sm">
            <MapPin className="h-3 w-3" />
            Country
          </Label>
          <Select 
            value={countryFilter || 'all'} 
            onValueChange={(v) => {
              onCountryFilterChange(v === 'all' ? null : v);
              onCityFilterChange(null); // Reset city when country changes
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="All countries" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Countries</SelectItem>
              {selectedCountries.map(country => (
                <SelectItem key={country} value={country}>{country}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* City Filter */}
        <div className="space-y-2">
          <Label className="flex items-center gap-1 text-sm">
            <Building className="h-3 w-3" />
            City
          </Label>
          <Select 
            value={cityFilter || 'all'} 
            onValueChange={(v) => onCityFilterChange(v === 'all' ? null : v)}
            disabled={!cities || cities.length === 0}
          >
            <SelectTrigger>
              <SelectValue placeholder="All cities" />
            </SelectTrigger>
            <SelectContent className="max-h-[200px]">
              <SelectItem value="all">All Cities</SelectItem>
              {cities?.map(city => (
                <SelectItem key={city.id} value={city.id}>
                  {city.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Genre Filter */}
        <div className="space-y-2">
          <Label className="flex items-center gap-1 text-sm">
            <Music className="h-3 w-3" />
            Genre Preference
          </Label>
          <Select 
            value={genreFilter || 'all'} 
            onValueChange={(v) => onGenreFilterChange(v === 'all' ? null : v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Any genre" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any Genre</SelectItem>
              {genres.map(genre => (
                <SelectItem key={genre} value={genre}>{genre}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
