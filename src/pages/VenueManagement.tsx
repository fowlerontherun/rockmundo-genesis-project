import { useState, useEffect } from 'react';
import { MapPin, Users, DollarSign, Star, Building2, Music } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/lib/supabase-types';

type VenueRow = Database['public']['Tables']['venues']['Row'];
type CityRow = Database['public']['Tables']['cities']['Row'];

const VenueManagement = () => {
  const { toast } = useToast();
  const [venues, setVenues] = useState<VenueRow[]>([]);
  const [cities, setCities] = useState<CityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCity, setSelectedCity] = useState<string>('all');
  const [selectedPrestige, setSelectedPrestige] = useState<string>('all');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [venuesResult, citiesResult] = await Promise.all([
        supabase.from('venues').select('*').order('prestige_level'),
        supabase.from('cities').select('*').order('name'),
      ]);

      if (venuesResult.error) throw venuesResult.error;
      if (citiesResult.error) throw citiesResult.error;

      setVenues(venuesResult.data || []);
      setCities(citiesResult.data || []);
    } catch (error: any) {
      toast({
        title: 'Error loading venues',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredVenues = venues.filter((venue) => {
    if (selectedCity !== 'all' && venue.city_id !== selectedCity) return false;
    if (selectedPrestige !== 'all' && venue.prestige_level !== parseInt(selectedPrestige)) return false;
    return true;
  });

  const venuesByPrestige = [1, 2, 3, 4, 5].map((level) => ({
    level,
    venues: filteredVenues.filter((v) => v.prestige_level === level),
  }));

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">Music Venues</h1>
        <p className="text-muted-foreground">
          Discover performance venues across different cities and prestige levels
        </p>
      </div>

      <div className="flex flex-wrap gap-4">
        <div className="w-full sm:w-64">
          <Select value={selectedCity} onValueChange={setSelectedCity}>
            <SelectTrigger>
              <SelectValue placeholder="Filter by city" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Cities</SelectItem>
              {cities.map((city) => (
                <SelectItem key={city.id} value={city.id}>
                  {city.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="w-full sm:w-64">
          <Select value={selectedPrestige} onValueChange={setSelectedPrestige}>
            <SelectTrigger>
              <SelectValue placeholder="Filter by prestige" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Prestige Levels</SelectItem>
              <SelectItem value="1">Level 1 - Starting Out</SelectItem>
              <SelectItem value="2">Level 2 - Up & Coming</SelectItem>
              <SelectItem value="3">Level 3 - Established</SelectItem>
              <SelectItem value="4">Level 4 - Prestigious</SelectItem>
              <SelectItem value="5">Level 5 - Elite</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Tabs defaultValue="all" className="w-full">
        <TabsList>
          <TabsTrigger value="all">All Venues ({filteredVenues.length})</TabsTrigger>
          {venuesByPrestige.map((group) => (
            <TabsTrigger key={group.level} value={`level-${group.level}`}>
              Level {group.level} ({group.venues.length})
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="all" className="mt-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredVenues.map((venue) => (
              <VenueCard key={venue.id} venue={venue} cities={cities} />
            ))}
          </div>
          {filteredVenues.length === 0 && (
            <div className="flex h-32 items-center justify-center text-muted-foreground">
              No venues match your filters
            </div>
          )}
        </TabsContent>

        {venuesByPrestige.map((group) => (
          <TabsContent key={group.level} value={`level-${group.level}`} className="mt-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {group.venues.map((venue) => (
                <VenueCard key={venue.id} venue={venue} cities={cities} />
              ))}
            </div>
            {group.venues.length === 0 && (
              <div className="flex h-32 items-center justify-center text-muted-foreground">
                No level {group.level} venues available
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
};

const VenueCard = ({ venue, cities }: { venue: VenueRow; cities: CityRow[] }) => {
  const city = cities.find((c) => c.id === venue.city_id);
  const reqs = (venue.requirements as any) || {};
  const rawAmenities = venue.amenities || [];
  const amenities: string[] = Array.isArray(rawAmenities) 
    ? rawAmenities.filter((a): a is string => typeof a === 'string')
    : [];

  const prestigeColor = {
    1: 'bg-slate-500',
    2: 'bg-green-500',
    3: 'bg-blue-500',
    4: 'bg-purple-500',
    5: 'bg-amber-500',
  }[venue.prestige_level] || 'bg-gray-500';

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              {venue.name}
            </CardTitle>
            <CardDescription className="flex items-center gap-1 mt-1">
              <MapPin className="h-3 w-3" />
              {venue.location}
            </CardDescription>
          </div>
          <Badge className={prestigeColor}>
            {['', 'Starter', 'Up & Coming', 'Established', 'Prestigious', 'Elite'][venue.prestige_level]}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">{city?.name || 'Unknown City'}</span>
          <span className="capitalize">{venue.venue_type.replace(/_/g, ' ')}</span>
        </div>

        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="flex items-center gap-1">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span>{venue.capacity} capacity</span>
          </div>
          <div className="flex items-center gap-1">
            <DollarSign className="h-4 w-4 text-muted-foreground" />
            <span>${venue.base_payment.toLocaleString()}</span>
          </div>
        </div>

        {venue.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">{venue.description}</p>
        )}

        {(reqs.min_fans > 0 || reqs.min_fame > 0 || reqs.min_performance_skill > 0) && (
          <div className="text-xs text-muted-foreground border-t pt-2">
            <div className="font-medium flex items-center gap-1">
              <Star className="h-3 w-3" />
              Requirements:
            </div>
            {reqs.min_fans > 0 && <div>• {reqs.min_fans}+ fans</div>}
            {reqs.min_fame > 0 && <div>• {reqs.min_fame}+ fame</div>}
            {reqs.min_performance_skill > 0 && <div>• Performance skill {reqs.min_performance_skill}+</div>}
            {reqs.min_stage_presence > 0 && <div>• Stage presence {reqs.min_stage_presence}+</div>}
          </div>
        )}

        {amenities.length > 0 && (
          <div className="text-xs text-muted-foreground border-t pt-2">
            <div className="font-medium flex items-center gap-1">
              <Music className="h-3 w-3" />
              Amenities:
            </div>
            <div className="flex flex-wrap gap-1 mt-1">
              {amenities.slice(0, 4).map((amenity, i) => (
                <Badge key={i} variant="outline" className="text-xs">
                  {amenity}
                </Badge>
              ))}
              {amenities.length > 4 && (
                <Badge variant="outline" className="text-xs">
                  +{amenities.length - 4}
                </Badge>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default VenueManagement;