import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Building2, Star, Zap, DollarSign, AlertTriangle } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CountryFlag } from "@/components/location/CountryFlag";

interface StudioSelectorProps {
  cityId: string;
  selectedStudio: any;
  onSelect: (studio: any) => void;
  labelCompanyId?: string | null;
}

export const StudioSelector = ({ cityId, selectedStudio, onSelect, labelCompanyId }: StudioSelectorProps) => {
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [selectedCityId, setSelectedCityId] = useState<string>(cityId);

  // Fetch the player's current city to get its country
  const { data: currentCityData } = useQuery({
    queryKey: ['current-city-info', cityId],
    queryFn: async () => {
      if (!cityId) return null;
      const { data, error } = await supabase
        .from('cities')
        .select('id, name, country')
        .eq('id', cityId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!cityId,
  });

  // Set defaults when current city loads
  useEffect(() => {
    if (currentCityData && !selectedCountry) {
      setSelectedCountry(currentCityData.country);
      setSelectedCityId(currentCityData.id);
    }
  }, [currentCityData]);

  // Fetch all distinct countries
  const { data: countries } = useQuery({
    queryKey: ['studio-countries'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cities')
        .select('country')
        .order('country');
      if (error) throw error;
      // Deduplicate
      const unique = [...new Set((data || []).map(c => c.country).filter(Boolean))];
      return unique as string[];
    },
  });

  // Fetch cities in selected country
  const { data: citiesInCountry } = useQuery({
    queryKey: ['country-cities', selectedCountry],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cities')
        .select('id, name')
        .eq('country', selectedCountry!)
        .order('name');
      if (error) throw error;
      return data;
    },
    enabled: !!selectedCountry,
  });

  // Fetch studios for selected city
  const { data: studios, isLoading } = useQuery({
    queryKey: ['city-studios', selectedCityId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('city_studios')
        .select('*, cities(name)')
        .eq('city_id', selectedCityId);
      if (error) throw error;
      return data;
    },
    enabled: !!selectedCityId,
  });

  const isRemoteCity = selectedCityId !== cityId;

  const handleCountryChange = (country: string) => {
    setSelectedCountry(country);
    setSelectedCityId(''); // reset city
  };

  const handleCityChange = (newCityId: string) => {
    setSelectedCityId(newCityId);
  };

  return (
    <div className="space-y-4">
      <div className="text-sm text-muted-foreground">
        Select a recording studio — browse by country and city
      </div>

      {/* Country & City Filters */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Country</label>
          <Select value={selectedCountry || ''} onValueChange={handleCountryChange}>
            <SelectTrigger>
              <SelectValue placeholder="Select country..." />
            </SelectTrigger>
            <SelectContent>
              {(countries || []).map((country) => (
                <SelectItem key={country} value={country}>
                  <span className="flex items-center gap-2">
                    <CountryFlag country={country} size="sm" showTooltip={false} />
                    {country}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">City</label>
          <Select value={selectedCityId} onValueChange={handleCityChange} disabled={!selectedCountry}>
            <SelectTrigger>
              <SelectValue placeholder="Select city..." />
            </SelectTrigger>
            <SelectContent>
              {(citiesInCountry || []).map((city) => (
                <SelectItem key={city.id} value={city.id}>
                  {city.name}
                  {city.id === cityId && " (Your location)"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Warning if remote city */}
      {isRemoteCity && selectedCityId && (
        <Alert className="border-warning/50 bg-warning/10">
          <AlertTriangle className="h-4 w-4 text-warning" />
          <AlertDescription className="text-warning text-sm">
            You are not in this city. All band members must travel here before the session starts or the recording will fail.
          </AlertDescription>
        </Alert>
      )}

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Loading studios...</div>
      ) : !selectedCityId ? (
        <div className="text-center py-12">
          <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">Select a country and city to browse studios.</p>
        </div>
      ) : !studios || studios.length === 0 ? (
        <div className="text-center py-12">
          <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No recording studios available in this city.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {studios.map((studio) => {
            const isLabelOwned = !!(labelCompanyId && studio.company_id && studio.company_id === labelCompanyId);

            return (
              <Card
                key={studio.id}
                className={`transition-all hover:shadow-md cursor-pointer ${
                  selectedStudio?.id === studio.id ? 'ring-2 ring-primary' : ''
                } ${isLabelOwned ? 'border-green-500/50 bg-green-500/5' : ''}`}
                onClick={() => onSelect({ ...studio, isLabelOwned, city_id: selectedCityId })}
              >
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Building2 className="h-5 w-5 text-primary" />
                    {studio.name}
                    {isLabelOwned && (
                      <Badge className="bg-green-600 text-white border-green-700 text-xs">
                        FREE — Label Studio
                      </Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                
                <CardContent className="space-y-3">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Star className="h-4 w-4" />
                        Quality
                      </span>
                      <span className="font-semibold">{studio.quality_rating}/100</span>
                    </div>
                    <Progress value={studio.quality_rating} />
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Zap className="h-4 w-4" />
                        Equipment
                      </span>
                      <span className="font-semibold">{studio.equipment_rating}/100</span>
                    </div>
                    <Progress value={studio.equipment_rating} />
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <DollarSign className="h-4 w-4" />
                      Hourly Rate
                    </span>
                    {isLabelOwned ? (
                      <div className="flex items-center gap-2">
                        <span className="text-sm line-through text-muted-foreground">
                          ${studio.hourly_rate.toLocaleString()}
                        </span>
                        <span className="text-lg font-bold text-green-600">FREE</span>
                      </div>
                    ) : (
                      <span className="text-lg font-bold text-primary">
                        ${studio.hourly_rate.toLocaleString()}
                      </span>
                    )}
                  </div>

                  {studio.specialties && studio.specialties.length > 0 && (
                    <div className="text-xs text-muted-foreground">
                      <span className="font-medium">Specialties:</span> {studio.specialties.join(', ')}
                    </div>
                  )}

                  <Button
                    variant={selectedStudio?.id === studio.id ? 'default' : 'outline'}
                    className="w-full"
                    size="sm"
                  >
                    {selectedStudio?.id === studio.id ? 'Selected' : 'Select Studio'}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};
