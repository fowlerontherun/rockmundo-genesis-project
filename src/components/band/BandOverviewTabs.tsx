import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Star, TrendingUp, Activity, Users, PiggyBank, BarChart3, 
  Music, Calendar, MapPin, Target, Trophy, Flame, Clock
} from 'lucide-react';
import { getBandFameTitle } from '@/utils/bandFame';
import { getChemistryLabel, getChemistryColor } from '@/utils/bandChemistry';
import { useMemo } from 'react';
import { differenceInDays } from 'date-fns';
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

interface BandOverviewTabsProps {
  band: {
    fame?: number;
    weekly_fans?: number;
    collective_fame_earned?: number;
    performance_count?: number;
    jam_count?: number;
    created_at?: string;
    popularity?: number;
    chemistry_level?: number;
    cohesion_score?: number;
    band_balance?: number;
    fame_multiplier?: number;
    status?: string;
    description?: string;
    home_city_id?: string;
  };
  memberCount: number;
  maxMembers?: number;
  skillRating: number;
  homeCity?: { name: string; country: string } | null;
}

export function BandOverviewTabs({ band, memberCount, maxMembers, skillRating, homeCity }: BandOverviewTabsProps) {
  const numberFormatter = useMemo(() => new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }), []);
  const currencyFormatter = useMemo(
    () => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }),
    []
  );

  const weeklyFans = band?.weekly_fans ?? 0;
  const totalFame = band?.fame ?? 0;
  const lifetimeFame = band?.collective_fame_earned ?? 0;
  const performanceCount = band?.performance_count ?? 0;
  const jamCount = band?.jam_count ?? 0;
  const popularity = band?.popularity ?? 0;
  const chemistryLevel = band?.chemistry_level ?? 0;
  const cohesionScore = band?.cohesion_score ?? 0;
  const bandBalance = band?.band_balance ?? 0;
  const fameMultiplier = band?.fame_multiplier ?? 1;

  const daysTogether = useMemo(() => {
    if (!band?.created_at) return 0;
    return differenceInDays(new Date(), new Date(band.created_at));
  }, [band?.created_at]);

  const fameProgress = (((band.fame ?? 0) % 1000) / 1000) * 100;
  const chemistryLabel = getChemistryLabel(chemistryLevel);
  const chemistryColor = getChemistryColor(chemistryLevel);

  // Chart configurations
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
    [performanceCount, jamCount, daysTogether]
  );

  const profileMetrics = useMemo(
    () => [
      { name: 'Popularity', value: popularity },
      { name: 'Skill', value: skillRating },
      { name: 'Chemistry', value: chemistryLevel },
      { name: 'Cohesion', value: cohesionScore },
    ],
    [popularity, skillRating, chemistryLevel, cohesionScore]
  );

  const activityPalette = ['hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))'];

  return (
    <Tabs defaultValue="quick-stats" className="space-y-4">
      <TabsList className="grid w-full grid-cols-4">
        <TabsTrigger value="quick-stats" className="text-xs sm:text-sm">Quick Stats</TabsTrigger>
        <TabsTrigger value="performance" className="text-xs sm:text-sm">Performance</TabsTrigger>
        <TabsTrigger value="engagement" className="text-xs sm:text-sm">Engagement</TabsTrigger>
        <TabsTrigger value="profile" className="text-xs sm:text-sm">Profile</TabsTrigger>
      </TabsList>

      {/* Quick Stats Tab */}
      <TabsContent value="quick-stats" className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {/* Band Fame Card */}
          <Card className="border-l-4 border-l-yellow-500 bg-gradient-to-br from-yellow-500/5 to-transparent">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <Star className="h-4 w-4 text-yellow-500" />
                Band Fame
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between mb-2">
                <span className="text-2xl font-bold text-foreground">{numberFormatter.format(totalFame)}</span>
                <Badge className="bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 border-yellow-500/30">
                  {getBandFameTitle(totalFame)}
                </Badge>
              </div>
              <Progress value={fameProgress} className="h-2" />
              <p className="text-xs text-muted-foreground mt-2">
                <Flame className="h-3 w-3 inline mr-1" />
                {fameMultiplier.toFixed(2)}x multiplier
              </p>
            </CardContent>
          </Card>

          {/* Members & Balance Card */}
          <Card className="border-l-4 border-l-blue-500 bg-gradient-to-br from-blue-500/5 to-transparent">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <Users className="h-4 w-4 text-blue-500" />
                Members
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between mb-3">
                <span className="text-2xl font-bold text-foreground">
                  {memberCount}
                  <span className="text-sm font-normal text-muted-foreground">/{maxMembers ?? '∞'}</span>
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <PiggyBank className="h-4 w-4 text-green-500" />
                <span className="font-medium text-green-600 dark:text-green-400">{currencyFormatter.format(bandBalance)}</span>
              </div>
            </CardContent>
          </Card>

          {/* Chemistry Card */}
          <Card className="border-l-4 border-l-purple-500 bg-gradient-to-br from-purple-500/5 to-transparent">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <Activity className="h-4 w-4 text-purple-500" />
                Chemistry
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between mb-2">
                <span className="text-2xl font-bold text-foreground">{chemistryLevel}</span>
                <Badge className={chemistryColor}>{chemistryLabel}</Badge>
              </div>
              <Progress value={chemistryLevel} className="h-2" />
            </CardContent>
          </Card>

          {/* Weekly Fans Card */}
          <Card className="border-l-4 border-l-green-500 bg-gradient-to-br from-green-500/5 to-transparent">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <TrendingUp className="h-4 w-4 text-green-500" />
                Weekly Fans
              </CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-2xl font-bold text-foreground">{numberFormatter.format(weeklyFans)}</span>
              <p className="text-xs text-muted-foreground mt-2">
                <Trophy className="h-3 w-3 inline mr-1" />
                Lifetime: {numberFormatter.format(lifetimeFame)}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Status Summary */}
        <Card>
          <CardContent className="pt-4">
            <div className="grid gap-4 text-sm md:grid-cols-2 lg:grid-cols-4">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Popularity:</span>
                <span className="font-medium text-foreground">{numberFormatter.format(popularity)}</span>
              </div>
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Skill Rating:</span>
                <span className="font-medium text-foreground">{numberFormatter.format(skillRating)}</span>
              </div>
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Cohesion:</span>
                <span className="font-medium text-foreground">{cohesionScore}</span>
              </div>
              {homeCity && (
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Home:</span>
                  <span className="font-medium text-foreground">{homeCity.name}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      {/* Performance Tab */}
      <TabsContent value="performance" className="space-y-4">
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="border-l-4 border-l-orange-500 bg-gradient-to-br from-orange-500/5 to-transparent">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <Music className="h-4 w-4 text-orange-500" />
                Total Performances
              </CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-3xl font-bold text-foreground">{numberFormatter.format(performanceCount)}</span>
              <p className="text-xs text-muted-foreground mt-1">Gigs played</p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-cyan-500 bg-gradient-to-br from-cyan-500/5 to-transparent">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <BarChart3 className="h-4 w-4 text-cyan-500" />
                Skill Rating
              </CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-3xl font-bold text-foreground">{numberFormatter.format(skillRating)}</span>
              <p className="text-xs text-muted-foreground mt-1">Composite ability score</p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-pink-500 bg-gradient-to-br from-pink-500/5 to-transparent">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <Clock className="h-4 w-4 text-pink-500" />
                Days Together
              </CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-3xl font-bold text-foreground">{numberFormatter.format(daysTogether)}</span>
              <p className="text-xs text-muted-foreground mt-1">Since formation</p>
            </CardContent>
          </Card>
        </div>

        {/* Activity Breakdown Chart */}
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
      </TabsContent>

      {/* Engagement Tab */}
      <TabsContent value="engagement" className="space-y-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Engagement Momentum</CardTitle>
            <CardDescription>Weekly fans vs total fame trend</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
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
      </TabsContent>

      {/* Profile Tab */}
      <TabsContent value="profile" className="space-y-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Band Profile</CardTitle>
            <CardDescription>Performance across core dimensions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ChartContainer config={profileConfig} className="h-full w-full">
                <RadarChart data={profileMetrics}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="name" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
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

        {band.description && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">About</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">{band.description}</p>
            </CardContent>
          </Card>
        )}
      </TabsContent>
    </Tabs>
  );
}
