import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MapPin } from 'lucide-react';

interface StartingCitySelectorProps {
  value: string | null;
  onChange: (cityId: string) => void;
  currentCityId?: string | null;
}

export function StartingCitySelector({ value, onChange, currentCityId }: StartingCitySelectorProps) {
  // Fetch cities the player has visited or the current city
  const { data: cities, isLoading } = useQuery({
    queryKey: ['tour-starting-cities', currentCityId],
    queryFn: async () => {
      // For now, fetch all cities - in future could filter by visited cities
      const { data, error } = await supabase
        .from('cities')
        .select('id, name, country, region')
        .order('name');
      
      if (error) throw error;
      return data || [];
    },
  });

  // Group cities by country
  const citiesByCountry = cities?.reduce((acc, city) => {
    const country = city.country || 'Unknown';
    if (!acc[country]) acc[country] = [];
    acc[country].push(city);
    return acc;
  }, {} as Record<string, typeof cities>) || {};

  const sortedCountries = Object.keys(citiesByCountry).sort();

  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-2">
        <MapPin className="h-4 w-4" />
        Starting City
      </Label>
      <p className="text-sm text-muted-foreground">
        Where will your tour begin?
      </p>
      <Select value={value || ''} onValueChange={onChange} disabled={isLoading}>
        <SelectTrigger>
          <SelectValue placeholder={isLoading ? "Loading cities..." : "Select starting city"} />
        </SelectTrigger>
        <SelectContent className="max-h-[300px]">
          {sortedCountries.map(country => (
            <div key={country}>
              <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground bg-muted/50">
                {country}
              </div>
              {citiesByCountry[country]?.map(city => (
                <SelectItem key={city.id} value={city.id}>
                  <span className="flex items-center gap-2">
                    {city.name}
                    {city.id === currentCityId && (
                      <span className="text-xs text-primary">(Current)</span>
                    )}
                  </span>
                </SelectItem>
              ))}
            </div>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
