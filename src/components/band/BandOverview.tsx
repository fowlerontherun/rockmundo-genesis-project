import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { Star, TrendingUp, Activity, Users, PiggyBank, BarChart3, Music, Calendar, Settings2, MapPin } from 'lucide-react';
import { getBandFameTitle } from '@/utils/bandFame';
import { getChemistryLabel, getChemistryColor } from '@/utils/bandChemistry';
import { calculateBandSkillRating } from '@/utils/bandSkillCalculator';
import { differenceInDays } from 'date-fns';
import { BandProfileEdit } from '@/components/band/BandProfileEdit';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useToast } from '@/hooks/use-toast';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  XAxis,
  YAxis,
  Cell,
} from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
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

  const numberFormatter = useMemo(() => new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }), []);
  const currencyFormatter = useMemo(
    () =>
      new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0,
      }),
    [],
  );

  const trendConfig = {
    fans: { label: 'Weekly Fans', color: 'hsl(var(--chart-1))' },
    fame: { label: 'Total Fame', color: 'hsl(var(--chart-2))' },
  } as const;

  const activityConfig = {
    value: { label: 'Activity Volume', color: 'hsl(var(--chart-3))' },
  } as const;

  const profileConfig = {
    value: { label: 'Band Profile Score', color: 'hsl(var(--chart-4))' },
  } as const;

  const weeklyFans = band?.weekly_fans ?? 0;
  const totalFame = band?.fame ?? 0;
  const lifetimeFame = band?.collective_fame_earned ?? 0;
  const performanceCount = band?.performance_count ?? 0;
  const jamCount = band?.jam_count ?? 0;
  
  // Calculate days together from created_at date
  const daysTogether = useMemo(() => {
    if (!band?.created_at) return 0;
    return differenceInDays(new Date(), new Date(band.created_at));
  }, [band?.created_at]);
  
  const popularity = band?.popularity ?? 0;
  // Use calculated skill rating or fallback to stored value
  const hiddenSkillRating = calculatedSkillRating || band?.hidden_skill_rating || 0;
  const chemistryLevel = band?.chemistry_level ?? 0;
  const cohesionScore = band?.cohesion_score ?? 0;
  const bandBalance = band?.band_balance ?? 0;
  const fameMultiplier = band?.fame_multiplier ?? 1;

  const formatStatus = (status?: string | null) => {
    if (!status) return 'Active';
    return status
      .split('_')
      .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
      .join(' ');
  };

  const engagementTrend = useMemo(() => {
    const baseValue = Math.max(weeklyFans * 0.4, lifetimeFame ? lifetimeFame / 20 : weeklyFans * 0.3);
    const checkpoints = [0.35, 0.55, 0.7, 0.85, 1];
    return checkpoints.map((ratio, index) => ({
      label: `Week ${index === checkpoints.length - 1 ? 'Now' : `-${checkpoints.length - index - 1}`}`,
      fans: Math.round(weeklyFans * ratio + baseValue * (1 - ratio)),
      fame: Math.round(totalFame * ratio + lifetimeFame * (1 - ratio)),
    }));
  }, [weeklyFans, lifetimeFame, totalFame]);

  const activityBreakdown = useMemo(
    () => [
      { name: 'Performances', value: performanceCount },
      { name: 'Jam Sessions', value: jamCount },
      { name: 'Days Together', value: daysTogether },
    ],
    [performanceCount, jamCount, daysTogether],
  );

  const profileMetrics = useMemo(
    () => [
      { name: 'Popularity', value: popularity },
      { name: 'Skill', value: hiddenSkillRating },
      { name: 'Chemistry', value: chemistryLevel },
      { name: 'Cohesion', value: cohesionScore },
    ],
    [popularity, hiddenSkillRating, chemistryLevel, cohesionScore],
  );

  const activityPalette = ['hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))'];

  if (loading || !band) {
    return <div className="flex items-center justify-center py-8">Loading...</div>;
  }

  const fameProgress = (((band.fame ?? 0) % 1000) / 1000) * 100;
  const chemistryLabel = getChemistryLabel(band.chemistry_level);
  const chemistryColor = getChemistryColor(band.chemistry_level);

  return (
    <div className="space-y-4">
      {/* Profile Edit Section (Leaders Only) */}
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
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Band Fame */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <Star className="h-4 w-4 text-yellow-500" />
              Band Fame
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between mb-2">
              <span className="text-2xl font-bold">{numberFormatter.format(totalFame)}</span>
              <Badge>{getBandFameTitle(totalFame)}</Badge>
            </div>
            <Progress value={fameProgress} className="h-2" />
            <p className="text-xs text-muted-foreground mt-2">
              {fameMultiplier.toFixed(2)}x multiplier
            </p>
          </CardContent>
        </Card>

        {/* Members & Balance */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <Users className="h-4 w-4" />
              Members
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between mb-3">
              <span className="text-2xl font-bold">
                {memberCount}
                <span className="text-sm font-normal text-muted-foreground">/{band.max_members ?? '∞'}</span>
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <PiggyBank className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{currencyFormatter.format(bandBalance)}</span>
            </div>
          </CardContent>
        </Card>

        {/* Chemistry */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <Activity className="h-4 w-4" />
              Chemistry
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between mb-2">
              <span className="text-2xl font-bold">{chemistryLevel}</span>
              <Badge className={chemistryColor}>{chemistryLabel}</Badge>
            </div>
            <Progress value={chemistryLevel} className="h-2" />
          </CardContent>
        </Card>

        {/* Weekly Fans */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <TrendingUp className="h-4 w-4" />
              Weekly Fans
            </CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-2xl font-bold">{numberFormatter.format(weeklyFans)}</span>
            <p className="text-xs text-muted-foreground mt-2">
              Lifetime: {numberFormatter.format(lifetimeFame)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Second Row - Performance Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <Music className="h-4 w-4" />
              Performances
            </CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-2xl font-bold">{numberFormatter.format(performanceCount)}</span>
            <p className="text-xs text-muted-foreground mt-1">Total gigs played</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <BarChart3 className="h-4 w-4" />
              Skill Rating
            </CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-2xl font-bold">{numberFormatter.format(hiddenSkillRating)}</span>
            <p className="text-xs text-muted-foreground mt-1">Composite ability score</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <Calendar className="h-4 w-4" />
              Days Together
            </CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-2xl font-bold">{numberFormatter.format(daysTogether)}</span>
            <p className="text-xs text-muted-foreground mt-1">Since formation</p>
          </CardContent>
        </Card>
      </div>

      {/* Third Row - Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Engagement Trend */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Engagement Momentum</CardTitle>
            <CardDescription>Weekly fans vs total fame trend</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-48">
              <ChartContainer config={trendConfig} className="h-full w-full">
                <AreaChart data={engagementTrend} margin={{ left: 0, right: 0 }}>
                  <defs>
                    <linearGradient id="band-fans-gradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-fans)" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="var(--color-fans)" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} fontSize={12} />
                  <YAxis tickLine={false} axisLine={false} tickMargin={8} width={50} fontSize={12} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Area type="monotone" dataKey="fans" stroke="var(--color-fans)" fill="url(#band-fans-gradient)" strokeWidth={2} />
                  <Area type="monotone" dataKey="fame" stroke="var(--color-fame)" fill="transparent" strokeWidth={2} />
                </AreaChart>
              </ChartContainer>
            </div>
          </CardContent>
        </Card>

        {/* Band Profile Radar */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Band Profile</CardTitle>
            <CardDescription>Performance across core dimensions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-48">
              <ChartContainer config={profileConfig} className="h-full w-full">
                <RadarChart data={profileMetrics}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="name" tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} />
                  <Radar
                    name="Band profile"
                    dataKey="value"
                    stroke="var(--color-value)"
                    fill="var(--color-value)"
                    fillOpacity={0.2}
                  />
                  <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                </RadarChart>
              </ChartContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Activity Mix */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Activity Mix</CardTitle>
          <CardDescription>Where the band spends its time</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-36">
            <ChartContainer config={activityConfig} className="h-full w-full">
              <BarChart data={activityBreakdown} layout="vertical" margin={{ left: 0, right: 12 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis type="number" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis dataKey="name" type="category" tickLine={false} axisLine={false} width={100} fontSize={12} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="value" radius={[4, 4, 4, 4]}>
                  {activityBreakdown.map((entry, index) => (
                    <Cell key={entry.name} fill={activityPalette[index % activityPalette.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ChartContainer>
          </div>
        </CardContent>
      </Card>

      {/* Home City Card - for leaders who haven't set it yet */}
      {isLeader && !band.home_city_id && (
        <Card className="border-yellow-500/30 bg-yellow-500/5">
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

      {/* Status Card */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Band Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 text-sm md:grid-cols-2 lg:grid-cols-4">
            <div>
              <span className="text-muted-foreground">Status:</span>{' '}
              <span className="font-medium">{formatStatus(band.status)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Popularity:</span>{' '}
              <span className="font-medium">{numberFormatter.format(popularity)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Cohesion:</span>{' '}
              <span className="font-medium">{cohesionScore}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Jam Sessions:</span>{' '}
              <span className="font-medium">{numberFormatter.format(jamCount)}</span>
            </div>
          </div>
          {homeCity && (
            <div className="flex items-center gap-2 mt-3 pt-3 border-t">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">
                <span className="text-muted-foreground">Home City:</span>{' '}
                <span className="font-medium">{homeCity.name}, {homeCity.country}</span>
              </span>
            </div>
          )}
          {band.description && (
            <p className="text-muted-foreground mt-4 pt-4 border-t">{band.description}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
