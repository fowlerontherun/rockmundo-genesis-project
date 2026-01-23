import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { Settings2, MapPin } from 'lucide-react';
import { calculateBandSkillRating } from '@/utils/bandSkillCalculator';
import { BandProfileEdit } from '@/components/band/BandProfileEdit';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useToast } from '@/hooks/use-toast';
import { BandOverviewTabs } from './BandOverviewTabs';
import { BandSongGifts } from './BandSongGifts';
import type { Database } from '@/lib/supabase-types';

type BandRow = Database['public']['Tables']['bands']['Row'];

interface BandOverviewProps {
  bandId: string;
  isLeader?: boolean;
  logoUrl?: string | null;
  soundDescription?: string | null;
  bandName?: string;
  onBandUpdate?: () => void;
}

export function BandOverview({ bandId, isLeader, logoUrl, soundDescription, bandName, onBandUpdate }: BandOverviewProps) {
  const { toast } = useToast();
  const [band, setBand] = useState<BandRow | null>(null);
  const [memberCount, setMemberCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [calculatedSkillRating, setCalculatedSkillRating] = useState(0);
  const [profileOpen, setProfileOpen] = useState(false);
  const [homeCity, setHomeCity] = useState<{ name: string; country: string } | null>(null);
  const [settingHomeCity, setSettingHomeCity] = useState(false);

  // Fetch cities for home city selector
  const { data: cities } = useQuery({
    queryKey: ['band-overview-cities'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cities')
        .select('id, name, country')
        .order('country')
        .order('name');
      if (error) throw error;
      return data ?? [];
    },
    enabled: isLeader === true,
  });

  // Group cities by country
  const citiesByCountry = cities?.reduce((acc, city) => {
    const country = city.country || 'Unknown';
    if (!acc[country]) acc[country] = [];
    acc[country].push(city);
    return acc;
  }, {} as Record<string, typeof cities>) || {};

  const sortedCountries = Object.keys(citiesByCountry).sort();

  useEffect(() => {
    const fetchBand = async () => {
      setLoading(true);
      try {
        const { data: bandData } = await supabase
          .from('bands')
          .select('*')
          .eq('id', bandId)
          .single();

        const { data: members } = await supabase
          .from('band_members')
          .select('*')
          .eq('band_id', bandId);

        setBand((bandData as BandRow) ?? null);
        setMemberCount(members?.length || 0);

        // Fetch home city if set
        if (bandData?.home_city_id) {
          const { data: cityData } = await supabase
            .from('cities')
            .select('name, country')
            .eq('id', bandData.home_city_id)
            .single();
          setHomeCity(cityData ?? null);
        }

        // Calculate skill rating dynamically
        if (bandData) {
          const skillRating = await calculateBandSkillRating(bandId, bandData.chemistry_level || 0);
          setCalculatedSkillRating(skillRating);
          
          // Update in database for caching
          if (skillRating !== bandData.hidden_skill_rating) {
            await supabase
              .from('bands')
              .update({ hidden_skill_rating: skillRating })
              .eq('id', bandId);
          }
        }
      } catch (error) {
        console.error('Error loading band:', error);
      } finally {
        setLoading(false);
      }
    };

    void fetchBand();
  }, [bandId]);

  const handleSetHomeCity = async (cityId: string) => {
    if (!cityId || !band || band.home_city_id) return;
    
    setSettingHomeCity(true);
    try {
      const { error } = await supabase
        .from('bands')
        .update({ home_city_id: cityId })
        .eq('id', bandId);
      
      if (error) throw error;

      // Fetch the city name
      const { data: cityData } = await supabase
        .from('cities')
        .select('name, country')
        .eq('id', cityId)
        .single();
      
      setHomeCity(cityData ?? null);
      setBand(prev => prev ? { ...prev, home_city_id: cityId } : null);
      
      toast({
        title: 'Home city set!',
        description: `${cityData?.name}, ${cityData?.country} is now your band's home base.`,
      });
      
      onBandUpdate?.();
    } catch (error) {
      console.error('Error setting home city:', error);
      toast({
        title: 'Error',
        description: 'Failed to set home city',
        variant: 'destructive',
      });
    } finally {
      setSettingHomeCity(false);
    }
  };

  if (loading || !band) {
    return <div className="flex items-center justify-center py-8 text-muted-foreground">Loading...</div>;
  }

  const skillRating = calculatedSkillRating || band?.hidden_skill_rating || 0;

  return (
    <div className="space-y-4">
      {/* Home City Card - for leaders who haven't set it yet */}
      {isLeader && !band.home_city_id && (
        <Card className="border-warning/30 bg-warning/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Set Home City
            </CardTitle>
            <CardDescription>Set your band's home city for regional rankings</CardDescription>
          </CardHeader>
          <CardContent>
            <Select onValueChange={handleSetHomeCity} disabled={settingHomeCity}>
              <SelectTrigger className="w-full md:w-[300px]">
                <SelectValue placeholder={settingHomeCity ? "Setting..." : "Select home city"} />
              </SelectTrigger>
              <SelectContent className="max-h-[300px]">
                {sortedCountries.map(country => (
                  <div key={country}>
                    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground bg-muted/50">
                      {country}
                    </div>
                    {citiesByCountry[country]?.map(city => (
                      <SelectItem key={city.id} value={city.id}>
                        {city.name}
                      </SelectItem>
                    ))}
                  </div>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-2">This can only be set once</p>
          </CardContent>
        </Card>
      )}

      {/* Main Overview Tabs */}
      <BandOverviewTabs
        band={band}
        memberCount={memberCount}
        maxMembers={band.max_members ?? undefined}
        skillRating={skillRating}
        homeCity={homeCity}
        bandId={bandId}
      />

      {/* Gifted Songs - after tabs */}
      <BandSongGifts bandId={bandId} />

      {/* Profile Edit Section (Leaders Only) - Moved to bottom */}
      {isLeader && (
        <Collapsible open={profileOpen} onOpenChange={setProfileOpen}>
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Settings2 className="h-4 w-4" />
                  Band Profile
                </CardTitle>
                <CollapsibleTrigger asChild>
                  <Button variant="outline" size="sm">
                    {profileOpen ? 'Close' : 'Edit Profile'}
                  </Button>
                </CollapsibleTrigger>
              </div>
            </CardHeader>
            <CollapsibleContent>
              <CardContent className="pt-2">
                <BandProfileEdit
                  bandId={bandId}
                  bandName={bandName || ''}
                  logoUrl={logoUrl}
                  soundDescription={soundDescription}
                  isLeader={isLeader}
                  onUpdate={onBandUpdate}
                />
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}
    </div>
  );
}
