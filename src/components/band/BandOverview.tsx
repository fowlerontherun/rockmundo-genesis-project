import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { Star, TrendingUp, Activity, BarChart3, PiggyBank } from 'lucide-react';
import { getBandFameTitle } from '@/utils/bandFame';
import { getChemistryLabel, getChemistryColor } from '@/utils/bandChemistry';
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
}

export function BandOverview({ bandId }: BandOverviewProps) {
  const [band, setBand] = useState<BandRow | null>(null);
  const [memberCount, setMemberCount] = useState(0);
  const [loading, setLoading] = useState(true);

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
      } catch (error) {
        console.error('Error loading band:', error);
      } finally {
        setLoading(false);
      }
    };

    void fetchBand();
  }, [bandId]);

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
    fans: {
      label: 'Weekly Fans',
      color: 'hsl(var(--chart-1))',
    },
    fame: {
      label: 'Total Fame',
      color: 'hsl(var(--chart-2))',
    },
  } as const;

  const activityConfig = {
    value: {
      label: 'Activity Volume',
      color: 'hsl(var(--chart-3))',
    },
  } as const;

  const profileConfig = {
    value: {
      label: 'Band Profile Score',
      color: 'hsl(var(--chart-4))',
    },
  } as const;

  const weeklyFans = band?.weekly_fans ?? 0;
  const totalFame = band?.fame ?? 0;
  const lifetimeFame = band?.collective_fame_earned ?? 0;
  const performanceCount = band?.performance_count ?? 0;
  const jamCount = band?.jam_count ?? 0;
  const daysTogether = band?.days_together ?? 0;
  const popularity = band?.popularity ?? 0;
  const hiddenSkillRating = band?.hidden_skill_rating ?? 0;
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

  const formatDate = (value?: string | null) => {
    if (!value) return null;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return null;
    }
    return parsed.toLocaleDateString();
  };

  const formatSentence = (value: string) => {
    const normalized = value?.trim();
    if (!normalized) {
      return normalized;
    }
    return normalized.charAt(0).toUpperCase() + normalized.slice(1);
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

  const tooltipLabelFormatter = (value: string | number) => String(value);
  const formatTooltipLabel = (value: unknown) => {
    if (typeof value === 'string' || typeof value === 'number') {
      return tooltipLabelFormatter(value);
    }
    return '';
  };

  const areaTooltipFormatter = (value: number | string, name: string) => [
    numberFormatter.format(typeof value === 'number' ? value : Number(value)),
    name === 'fans' ? 'Weekly Fans' : 'Total Fame',
  ];

  const barTooltipFormatter = (
    value: number | string,
    _name: string,
    _item: unknown,
    _index: number,
    payload: { name?: string },
  ) => [numberFormatter.format(typeof value === 'number' ? value : Number(value)), payload?.name ?? 'Activity'];

  const activityPalette = ['hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))'];

  if (loading || !band) {
    return <div>Loading...</div>;
  }

  const fameProgress = (((band.fame ?? 0) % 1000) / 1000) * 100;
  const chemistryLabel = getChemistryLabel(band.chemistry_level);
  const chemistryColor = getChemistryColor(band.chemistry_level);

  const operationalDetails = (() => {
    const nextVote = formatDate(band.next_leadership_vote);
    const hiatusEnd = formatDate(band.hiatus_ends_at);
    const lastChemistryUpdate = formatDate(band.last_chemistry_update);

    return [
      {
        label: 'Status',
        value: formatStatus(band.status),
      },
      {
        label: 'Next Leadership Vote',
        value: nextVote ?? 'Not scheduled',
      },
      {
        label: 'Hiatus',
        value: band.hiatus_reason
          ? `${formatSentence(band.hiatus_reason)}${hiatusEnd ? ` (until ${hiatusEnd})` : ''}`
          : 'No active hiatus',
      },
      {
        label: 'Last Chemistry Update',
        value: lastChemistryUpdate ?? 'Unknown',
      },
    ];
  })();

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="h-5 w-5" />
            Band Fame
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-2xl font-bold">{numberFormatter.format(totalFame)}</span>
            <Badge>{getBandFameTitle(totalFame)}</Badge>
          </div>
          <Progress value={fameProgress} className="h-2" />
          <div className="text-sm text-muted-foreground space-y-1">
            <div>Collective Fame: {numberFormatter.format(lifetimeFame)}</div>
            <div>Fame Multiplier: {fameMultiplier.toFixed(2)}x</div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Band Chemistry
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-2xl font-bold">{chemistryLevel}</span>
            <Badge className={chemistryColor}>{chemistryLabel}</Badge>
          </div>
          <Progress value={chemistryLevel} className="h-2" />
          <div className="text-sm text-muted-foreground space-y-1">
            <div>Performances: {numberFormatter.format(performanceCount)}</div>
            <div>Jam Sessions: {numberFormatter.format(jamCount)}</div>
            <div>Days Together: {numberFormatter.format(daysTogether)}</div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Band Stats
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <div className="rounded-lg border border-muted/40 bg-muted/10 p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Members</p>
              <p className="mt-2 text-2xl font-semibold">
                {memberCount}
                <span className="text-sm font-normal text-muted-foreground"> / {band.max_members ?? '∞'}</span>
              </p>
              <p className="text-xs text-muted-foreground">Active musicians contributing to the project</p>
            </div>
            <div className="rounded-lg border border-muted/40 bg-muted/10 p-4">
              <p className="flex items-center justify-between text-xs uppercase tracking-wide text-muted-foreground">
                Skill Rating
                <Badge variant="outline" className="text-[0.65rem]">
                  Performance Ready
                </Badge>
              </p>
              <p className="mt-2 text-2xl font-semibold">{numberFormatter.format(hiddenSkillRating)}</p>
              <p className="text-xs text-muted-foreground">Composite average of instrumental and stage ability</p>
            </div>
            <div className="rounded-lg border border-muted/40 bg-muted/10 p-4">
              <p className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                <PiggyBank className="h-4 w-4" /> Band Balance
              </p>
              <p className="mt-2 text-2xl font-semibold">{currencyFormatter.format(bandBalance)}</p>
              <p className="text-xs text-muted-foreground">Available funds for rehearsals, shows, and studio time</p>
            </div>
            <div className="rounded-lg border border-muted/40 bg-muted/10 p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Weekly Fans</p>
              <p className="mt-2 text-2xl font-semibold">{numberFormatter.format(weeklyFans)}</p>
              <p className="text-xs text-muted-foreground">Net new fans attracted over the last week</p>
            </div>
            <div className="rounded-lg border border-muted/40 bg-muted/10 p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Lifetime Fame Earned</p>
              <p className="mt-2 text-2xl font-semibold">{numberFormatter.format(lifetimeFame)}</p>
              <p className="text-xs text-muted-foreground">Accumulated recognition across all band eras</p>
            </div>
            <div className="rounded-lg border border-muted/40 bg-muted/10 p-4">
              <p className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                <BarChart3 className="h-4 w-4" /> Popularity
              </p>
              <p className="mt-2 text-2xl font-semibold">{numberFormatter.format(popularity)}</p>
              <p className="text-xs text-muted-foreground">Overall momentum across streaming, radio, and press</p>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
            <div className="rounded-lg border border-muted/40 bg-background/60 p-4 lg:col-span-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Engagement Momentum</p>
                  <p className="text-sm font-medium">Weekly fans compared to total fame</p>
                </div>
                <div className="text-right text-xs text-muted-foreground">
                  <div>Weekly Fans: {numberFormatter.format(weeklyFans)}</div>
                  <div>Total Fame: {numberFormatter.format(totalFame)}</div>
                </div>
              </div>
              <div className="mt-4 h-52">
                <ChartContainer config={trendConfig} className="h-full w-full">
                  <AreaChart data={engagementTrend} margin={{ left: 12, right: 12 }}>
                    <defs>
                      <linearGradient id="band-fans" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--color-fans)" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="var(--color-fans)" stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
                    <YAxis tickLine={false} axisLine={false} tickMargin={8} width={70} />
                    <ChartTooltip
                      cursor={{ strokeDasharray: '4 4' }}
                      content={
                        <ChartTooltipContent
                          labelFormatter={formatTooltipLabel}
                          formatter={areaTooltipFormatter}
                        />
                      }
                    />
                    <Area type="monotone" dataKey="fans" stroke="var(--color-fans)" fill="url(#band-fans)" strokeWidth={2} />
                    <Area type="monotone" dataKey="fame" stroke="var(--color-fame)" fill="transparent" strokeWidth={2} />
                  </AreaChart>
                </ChartContainer>
              </div>
            </div>

            <div className="rounded-lg border border-muted/40 bg-background/60 p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Activity Mix</p>
              <p className="text-sm font-medium">Where the band spends its time</p>
              <div className="mt-4 h-52">
                <ChartContainer config={activityConfig} className="h-full w-full">
                  <BarChart data={activityBreakdown} layout="vertical" margin={{ left: 12, right: 12 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis type="number" tickLine={false} axisLine={false} />
                    <YAxis dataKey="name" type="category" tickLine={false} axisLine={false} width={100} />
                    <ChartTooltip
                      cursor={{ fill: 'hsl(var(--muted) / 0.25)' }}
                      content={
                        <ChartTooltipContent
                          labelFormatter={formatTooltipLabel}
                          formatter={barTooltipFormatter}
                          nameKey="name"
                        />
                      }
                    />
                    <Bar dataKey="value" radius={[6, 6, 6, 6]}>
                      {activityBreakdown.map((entry, index) => (
                        <Cell key={entry.name} fill={activityPalette[index % activityPalette.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ChartContainer>
              </div>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-lg border border-muted/40 bg-background/60 p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Band Profile Balance</p>
              <p className="text-sm font-medium">How the group scores across core dimensions</p>
              <div className="mt-4 h-60">
                <ChartContainer config={profileConfig} className="h-full w-full">
                  <RadarChart data={profileMetrics}>
                    <PolarGrid />
                    <PolarAngleAxis dataKey="name" tick={{ fill: 'var(--muted-foreground)' }} />
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
            </div>

            <div className="rounded-lg border border-muted/40 bg-muted/10 p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Operational Snapshot</p>
              <div className="mt-4 grid gap-3 text-sm">
                {operationalDetails.map((detail) => (
                  <div key={detail.label} className="flex items-start justify-between gap-4">
                    <span className="text-muted-foreground">{detail.label}</span>
                    <span className="text-right font-medium text-foreground">{detail.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="md:col-span-2 lg:col-span-3">
        <CardHeader>
          <CardTitle>{band.is_solo_artist ? band.artist_name || band.name : band.name}</CardTitle>
          <CardDescription>
            {band.genre} {band.is_solo_artist ? '• Solo Artist' : '• Band'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">{band.description || 'No description yet.'}</p>
        </CardContent>
      </Card>
    </div>
  );
}
