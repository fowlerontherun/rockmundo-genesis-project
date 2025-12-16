import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Star, TrendingUp, TrendingDown, Minus, Music, DollarSign, Sparkles, CheckCircle2 } from "lucide-react";
import { getPerformanceGrade } from "@/utils/gigPerformanceCalculator";
import {
  EMPTY_GEAR_EFFECTS,
  type GearEffectBreakdown,
  type GearModifierEffects,
} from "@/utils/gearModifiers";
import { buildGearOutcomeNarrative, type GearOutcomeNarrative } from "@/utils/gigNarrative";
import { EnhancedGigMetrics } from "./EnhancedGigMetrics";
import { GigXpRewardCard } from "./GigXpRewardCard";
import { FanGrowthCard } from "./FanGrowthCard";
import { MomentHighlightsCard } from "./MomentHighlightsCard";
import { CrowdAnalyticsCard } from "./CrowdAnalyticsCard";
import { FinancialDeepDiveCard } from "./FinancialDeepDiveCard";
import { VenueRelationshipCard } from "./VenueRelationshipCard";
import { BandChemistryCard } from "./BandChemistryCard";
import type { GigXpSummary } from "@/utils/gigXpCalculator";
import type { FanConversionResult } from "@/utils/fanConversionCalculator";
import type { GigMoment } from "@/utils/momentHighlightsGenerator";
import type { VenueRelationshipResult } from "@/utils/venueRelationshipCalculator";
import type { ChemistryMoment } from "@/utils/bandChemistryEffects";
const integerFormatter = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 });

interface SongPerformance {
  song_id: string;
  setlist_position: number;
  performance_score: number;
  song_quality_contribution: number;
  rehearsal_contribution: number;
  chemistry_contribution: number;
  equipment_contribution: number;
  crew_contribution: number;
  member_skills_contribution: number;
  crowd_response: string;
}

interface GigOutcome {
  overall_rating: number;
  actual_attendance: number;
  attendance_percentage: number;
  ticket_revenue: number;
  merch_sales: number;
  total_revenue: number;
  crew_costs: number;
  equipment_wear_cost: number;
  net_profit: number;
  fame_gained: number;
  chemistry_impact: number;
  breakdown_data: {
    equipment_quality: number;
    crew_skill: number;
    band_chemistry: number;
    member_skills: number;
    merch_items_sold: number;
  };
  band_synergy_modifier?: number | null;
  social_buzz_impact?: number | null;
  audience_memory_impact?: number | null;
  promoter_modifier?: number | null;
  venue_loyalty_bonus?: number | null;
  gear_effects?: {
    equipmentQualityBonus: number;
    attendanceBonusPercent: number;
    reliabilitySwingReductionPercent: number;
    breakdownRiskPercent?: number;
    revenueBonusPercent: number;
    fameBonusPercent: number;
    breakdown?: GearEffectBreakdown[];
  };
  gig_song_performances?: SongPerformance[];
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  outcome: GigOutcome | null;
  venueName: string;
  venueCapacity: number;
  songs?: Array<{ id: string; title: string }>;
  gearEffects?: GearModifierEffects | null;
  gearNarrative?: GearOutcomeNarrative | null;
  xpSummary?: GigXpSummary | null;
  fanConversion?: FanConversionResult | null;
  momentHighlights?: GigMoment[] | null;
  venueRelationship?: VenueRelationshipResult | null;
  merchItemsSold?: number;
  ticketPrice?: number;
}

export const GigOutcomeReport = ({
  isOpen,
  onClose,
  outcome,
  venueName,
  venueCapacity,
  songs = [],
  gearEffects,
  gearNarrative,
  xpSummary,
  fanConversion,
  momentHighlights,
  venueRelationship,
  merchItemsSold = 0,
  ticketPrice = 20,
}: Props) => {
  if (!outcome) return null;

  const safeNumber = (value: number | string | null | undefined) => {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === "string") {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }

    return 0;
  };

  const formatCurrency = (value: number | string | null | undefined) => {
    const numericValue = safeNumber(value);
    return integerFormatter.format(numericValue);
  };

  const overallRating = safeNumber(outcome.overall_rating);
  const ticketRevenue = safeNumber(outcome.ticket_revenue);
  const merchSales = safeNumber(outcome.merch_sales);
  const totalRevenue = safeNumber(outcome.total_revenue);
  const crewCosts = safeNumber(outcome.crew_costs);
  const equipmentWearCost = safeNumber(outcome.equipment_wear_cost);
  const netProfit = safeNumber(outcome.net_profit);
  const actualAttendance = safeNumber(outcome.actual_attendance);
  const attendancePercentage = safeNumber(outcome.attendance_percentage);
  const fameGained = safeNumber(outcome.fame_gained);
  const chemistryImpact = safeNumber(outcome.chemistry_impact);

  const breakdown = {
    equipment_quality: safeNumber(outcome.breakdown_data?.equipment_quality),
    crew_skill: safeNumber(outcome.breakdown_data?.crew_skill),
    band_chemistry: safeNumber(outcome.breakdown_data?.band_chemistry),
    member_skills: safeNumber(outcome.breakdown_data?.member_skills),
    merch_items_sold: safeNumber(outcome.breakdown_data?.merch_items_sold),
  };

  const buildFallbackGearEffects = (): GearModifierEffects => {
    const attendanceBonus = safeNumber(outcome.social_buzz_impact);
    const reliabilityBonus = safeNumber(outcome.audience_memory_impact);
    const revenueBonus = safeNumber(outcome.promoter_modifier);
    const fameBonus = safeNumber(outcome.venue_loyalty_bonus);
    const equipmentBonus = safeNumber(outcome.band_synergy_modifier);
    const breakdownRisk = safeNumber(outcome.gear_effects?.breakdownRiskPercent);

    const derived: GearModifierEffects = {
      ...EMPTY_GEAR_EFFECTS,
      equipmentQualityBonus: equipmentBonus,
      crowdEngagementMultiplier: 1 + attendanceBonus / 100,
      attendanceBonusPercent: attendanceBonus,
      reliabilityStability: reliabilityBonus / 100,
      reliabilitySwingReductionPercent: reliabilityBonus,
      breakdownRiskPercent: breakdownRisk,
      revenueMultiplier: 1 + revenueBonus / 100,
      revenueBonusPercent: revenueBonus,
      fameMultiplier: 1 + fameBonus / 100,
      fameBonusPercent: fameBonus,
      breakdown: outcome.gear_effects?.breakdown ?? [],
    };

    if (!derived.breakdown.length) {
      const fallbackBreakdown: GearEffectBreakdown[] = [];

      if (equipmentBonus > 0.25) {
        fallbackBreakdown.push({
          key: "signal-chain",
          label: "Signal Chain Quality",
          value: `+${equipmentBonus.toFixed(1)} EQ`,
          description: "Stage gear raised your equipment score until the tour cap kicked in.",
        });
      }

      if (attendanceBonus > 0.25) {
        fallbackBreakdown.push({
          key: "crowd-engagement",
          label: "Crowd Engagement",
          value: `+${attendanceBonus.toFixed(1)}%`,
          description: "High-end microphones drew a livelier crowd response before the cap.",
        });
      }

      if (reliabilityBonus > 0.25) {
        fallbackBreakdown.push({
          key: "rig-reliability",
          label: "Rig Reliability",
          value: `-${reliabilityBonus.toFixed(1)}% swing`,
          description: "Reliability mods steadied the set until the safety cap.",
        });
      }

      if (breakdownRisk > 0.25) {
        fallbackBreakdown.push({
          key: "breakdown-risk",
          label: "Breakdown Risk",
          value: `+${breakdownRisk.toFixed(1)}%`,
          description: "Fragile components left you exposed to breakdown swings.",
        });
      }

      if (revenueBonus > 0.25) {
        fallbackBreakdown.push({
          key: "payout",
          label: "Payout Lift",
          value: `+${revenueBonus.toFixed(1)}%`,
          description: "Premium tone encouraged sales until diminishing returns kicked in.",
        });
      }

      if (fameBonus > 0.25) {
        fallbackBreakdown.push({
          key: "reputation",
          label: "Reputation Gains",
          value: `+${fameBonus.toFixed(1)}%`,
          description: "Signature rigs impressed promoters within the fame cap.",
        });
      }

      derived.breakdown = fallbackBreakdown;
    }

    return derived;
  };

  const effectiveGearEffects = gearEffects ?? buildFallbackGearEffects();
  const narrative = gearNarrative ?? buildGearOutcomeNarrative({
    outcome,
    gearEffects: effectiveGearEffects,
    setlistLength: songs.length,
  });
  const hasGearImpact =
    effectiveGearEffects.breakdown.length > 0 ||
    effectiveGearEffects.attendanceBonusPercent !== 0 ||
    effectiveGearEffects.revenueBonusPercent !== 0 ||
    effectiveGearEffects.fameBonusPercent !== 0 ||
    effectiveGearEffects.equipmentQualityBonus !== 0 ||
    effectiveGearEffects.breakdownRiskPercent > 0;

  const grade = getPerformanceGrade(overallRating);
  const starsFilled = Math.floor(overallRating);
  const starsPartial = overallRating - starsFilled;

  const renderStars = (rating: number, maxStars: number = 25) => {
    const filled = Math.floor(rating);
    const hasPartial = rating % 1 >= 0.5;
    
    return (
      <div className="flex gap-0.5">
        {Array.from({ length: maxStars }).map((_, i) => (
          <Star
            key={i}
            className={`w-3 h-3 ${
              i < filled
                ? 'fill-yellow-500 text-yellow-500'
                : i === filled && hasPartial
                ? 'fill-yellow-500/50 text-yellow-500'
                : 'text-muted'
            }`}
          />
        ))}
      </div>
    );
  };

  const getCrowdResponseBadge = (response: string) => {
    const variants: Record<string, { variant: any; label: string }> = {
      ecstatic: { variant: 'default', label: '🔥 Ecstatic' },
      enthusiastic: { variant: 'default', label: '🎉 Enthusiastic' },
      engaged: { variant: 'secondary', label: '👍 Engaged' },
      mixed: { variant: 'outline', label: '😐 Mixed' },
      disappointed: { variant: 'destructive', label: '😞 Disappointed' },
    };
    
    const config = variants[response] || variants.mixed;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const songPerformances = outcome.gig_song_performances || [];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl flex items-center gap-3">
            <Music className="w-6 h-6" />
            Gig Performance Report
          </DialogTitle>
          <p className="text-muted-foreground">{venueName}</p>
        </DialogHeader>

        <div className="space-y-6">
          {/* Overall Performance */}
          <Card className="border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Overall Performance</span>
                <Badge className={`${grade.color} text-lg px-4 py-1`}>
                  {grade.grade} - {grade.label}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  {renderStars(overallRating)}
                  <p className="text-3xl font-bold mt-2">
                    {overallRating.toFixed(1)} / 25
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Enhanced Metrics */}
          <EnhancedGigMetrics
            metrics={{
              attendance: actualAttendance,
              capacity: venueCapacity,
              revenue: totalRevenue,
              fameGained: fameGained,
              averagePerformanceScore: overallRating * 4, // Convert to percentage
              crowdEngagement: attendancePercentage,
              bestSong: songPerformances.length > 0 
                ? songs.find(s => s.id === songPerformances.reduce((best, curr) => 
                    curr.performance_score > best.performance_score ? curr : best
                  ).song_id)?.title
                : undefined,
              worstSong: songPerformances.length > 0
                ? songs.find(s => s.id === songPerformances.reduce((worst, curr) => 
                    curr.performance_score < worst.performance_score ? curr : worst
                  ).song_id)?.title
                : undefined,
              encoreWorthy: overallRating >= 20,
              breakdowns: 0,
              perfectSongs: songPerformances.filter(p => p.performance_score >= 23).length,
              totalSongs: songPerformances.length
            }}
          />

          {/* Moment Highlights */}
          <MomentHighlightsCard moments={momentHighlights || null} />

          {/* Two Column Layout for Analytics */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Crowd Analytics */}
            <CrowdAnalyticsCard
              actualAttendance={actualAttendance}
              venueCapacity={venueCapacity}
              songPerformances={songPerformances.map(sp => ({
                song_id: sp.song_id,
                song_title: songs.find(s => s.id === sp.song_id)?.title,
                position: sp.setlist_position,
                performance_score: sp.performance_score,
                crowd_response: sp.crowd_response,
              }))}
              overallRating={overallRating}
            />

            {/* Financial Deep Dive */}
            <FinancialDeepDiveCard
              ticketRevenue={ticketRevenue}
              merchRevenue={merchSales}
              totalRevenue={totalRevenue}
              crewCosts={crewCosts}
              equipmentWearCost={equipmentWearCost}
              netProfit={netProfit}
              actualAttendance={actualAttendance}
              ticketPrice={ticketPrice}
              merchItemsSold={merchItemsSold || breakdown.merch_items_sold}
            />
          </div>

          {/* XP Rewards */}
          <GigXpRewardCard xpSummary={xpSummary || null} performanceGrade={grade.grade} />

          {/* Fan Growth */}
          <FanGrowthCard fanConversion={fanConversion || null} />

          {/* Venue Relationship */}
          {venueRelationship && (
            <VenueRelationshipCard relationship={venueRelationship} venueName={venueName} />
          )}

          {hasGearImpact && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-primary" />
                  Gear Bonuses Applied
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div className="rounded-md border border-dashed border-primary/40 p-3">
                    <p className="text-muted-foreground">Crowd Energy</p>
                    <p className="text-xl font-semibold text-primary">
                      +{effectiveGearEffects.attendanceBonusPercent.toFixed(1)}%
                    </p>
                    <p className="text-xs text-muted-foreground">Audience enthusiasm driven by microphones and vocal rigs.</p>
                    {narrative.attendanceLine && (
                      <p className="text-xs text-muted-foreground mt-1">{narrative.attendanceLine}</p>
                    )}
                  </div>
                  <div className="rounded-md border border-dashed border-primary/40 p-3">
                    <p className="text-muted-foreground">Rig Stability</p>
                    <p className="text-xl font-semibold text-primary">
                      -{effectiveGearEffects.reliabilitySwingReductionPercent.toFixed(1)}%
                    </p>
                    <p className="text-xs text-muted-foreground">High-end pedals prevented negative performance swings.</p>
                    {narrative.reliabilityLine && (
                      <p className="text-xs text-muted-foreground mt-1">{narrative.reliabilityLine}</p>
                    )}
                  </div>
                  <div className="rounded-md border border-dashed border-primary/40 p-3">
                    <p className="text-muted-foreground">Payout Boost</p>
                    <p className="text-xl font-semibold text-primary">
                      +{effectiveGearEffects.revenueBonusPercent.toFixed(1)}%
                    </p>
                    <p className="text-xs text-muted-foreground">Premium tone increased ticket and merch returns.</p>
                    {narrative.revenueLine && (
                      <p className="text-xs text-muted-foreground mt-1">{narrative.revenueLine}</p>
                    )}
                  </div>
                  <div className="rounded-md border border-dashed border-primary/40 p-3">
                    <p className="text-muted-foreground">Reputation Gain</p>
                    <p className="text-xl font-semibold text-primary">
                      +{effectiveGearEffects.fameBonusPercent.toFixed(1)}%
                    </p>
                    <p className="text-xs text-muted-foreground">Signature gear amplified fame gained from the show.</p>
                    {narrative.fameLine && (
                      <p className="text-xs text-muted-foreground mt-1">{narrative.fameLine}</p>
                    )}
                  </div>
                </div>

                {effectiveGearEffects.breakdown.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-semibold">Breakdown</p>
                    <div className="space-y-1 pl-2">
                      {effectiveGearEffects.breakdown.map((entry) => (
                        <div key={entry.key} className="flex flex-col text-xs">
                          <span className="flex items-center gap-2 font-medium text-sm">
                            <CheckCircle2 className="h-3 w-3 text-primary" />
                            {entry.label}
                            <Badge variant="outline" className="text-xs">{entry.value}</Badge>
                          </span>
                          <span className="pl-5 text-muted-foreground">{entry.description}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Setlist Performance */}
          {songPerformances.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Setlist Performance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {songPerformances
                    .sort((a, b) => a.setlist_position - b.setlist_position)
                    .map((perf) => {
                      const song = songs.find(s => s.id === perf.song_id);
                      return (
                        <div key={perf.song_id} className="border rounded-lg p-3 space-y-2">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-semibold">
                                {perf.setlist_position}. {song?.title || 'Unknown Song'}
                              </p>
                              {renderStars(perf.performance_score, 25)}
                              <p className="text-sm text-muted-foreground mt-1">
                                {perf.performance_score.toFixed(1)} / 25 stars
                              </p>
                            </div>
                            {getCrowdResponseBadge(perf.crowd_response)}
                          </div>
                          
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div>
                              <p className="text-muted-foreground">Song Quality</p>
                              <Progress value={(perf.song_quality_contribution / 25) * 100} className="h-1" />
                            </div>
                            <div>
                              <p className="text-muted-foreground">Rehearsal</p>
                              <Progress value={(perf.rehearsal_contribution / 25) * 100} className="h-1" />
                            </div>
                            <div>
                              <p className="text-muted-foreground">Chemistry</p>
                              <Progress value={(perf.chemistry_contribution / 25) * 100} className="h-1" />
                            </div>
                            <div>
                              <p className="text-muted-foreground">Equipment</p>
                              <Progress value={(perf.equipment_contribution / 25) * 100} className="h-1" />
                            </div>
                            <div>
                              <p className="text-muted-foreground">Crew</p>
                              <Progress value={(perf.crew_contribution / 25) * 100} className="h-1" />
                            </div>
                            <div>
                              <p className="text-muted-foreground">Skills</p>
                              <Progress value={(perf.member_skills_contribution / 25) * 100} className="h-1" />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Factor Analysis */}
          <Card>
            <CardHeader>
              <CardTitle>Performance Factors</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-semibold">Equipment Quality</p>
                <Progress value={breakdown.equipment_quality} className="h-2 mt-1" />
                <p className="text-xs text-muted-foreground mt-1">
                  {breakdown.equipment_quality.toFixed(0)}/100
                </p>
              </div>
              <div>
                <p className="text-sm font-semibold">Crew Skill</p>
                <Progress value={breakdown.crew_skill} className="h-2 mt-1" />
                <p className="text-xs text-muted-foreground mt-1">
                  {breakdown.crew_skill.toFixed(0)}/100
                </p>
              </div>
              <div>
                <p className="text-sm font-semibold">Band Chemistry</p>
                <Progress value={breakdown.band_chemistry} className="h-2 mt-1" />
                <p className="text-xs text-muted-foreground mt-1">
                  {breakdown.band_chemistry.toFixed(0)}/100
                </p>
              </div>
              <div>
                <p className="text-sm font-semibold">Member Skills</p>
                <Progress value={(breakdown.member_skills / 150) * 100} className="h-2 mt-1" />
                <p className="text-xs text-muted-foreground mt-1">
                  {breakdown.member_skills.toFixed(0)}/150
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Impact Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Impact</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-primary">+{fameGained}</p>
                <p className="text-sm text-muted-foreground">Fame Gained</p>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center gap-1">
                  {chemistryImpact > 0 && <TrendingUp className="w-4 h-4 text-green-500" />}
                  {chemistryImpact < 0 && <TrendingDown className="w-4 h-4 text-red-500" />}
                  {chemistryImpact === 0 && <Minus className="w-4 h-4 text-muted" />}
                  <p className={`text-2xl font-bold ${
                    chemistryImpact > 0 ? 'text-green-500' :
                    chemistryImpact < 0 ? 'text-red-500' :
                    'text-muted-foreground'
                  }`}>
                    {chemistryImpact > 0 ? '+' : ''}{chemistryImpact}
                  </p>
                </div>
                <p className="text-sm text-muted-foreground">Chemistry Change</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-blue-500">
                  {breakdown.merch_items_sold}
                </p>
                <p className="text-sm text-muted-foreground">Merch Items Sold</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
};
