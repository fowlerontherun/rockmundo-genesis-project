import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Star, TrendingUp, TrendingDown, Minus, Music, DollarSign } from "lucide-react";
import { getPerformanceGrade } from "@/utils/gigPerformanceCalculator";

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
  gig_song_performances?: SongPerformance[];
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  outcome: GigOutcome | null;
  venueName: string;
  venueCapacity: number;
  songs?: Array<{ id: string; title: string }>;
}

export const GigOutcomeReport = ({ isOpen, onClose, outcome, venueName, venueCapacity, songs = [] }: Props) => {
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

          {/* Financial Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="w-5 h-5" />
                Financial Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Ticket Sales</p>
                  <p className="text-xl font-semibold">${formatCurrency(ticketRevenue)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Merchandise</p>
                  <p className="text-xl font-semibold">${formatCurrency(merchSales)}</p>
                </div>
              </div>
              <div className="border-t pt-3">
                <p className="text-sm text-muted-foreground">Total Revenue</p>
                <p className="text-2xl font-bold">${formatCurrency(totalRevenue)}</p>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Crew Costs</span>
                  <span className="text-destructive">-${formatCurrency(crewCosts)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Equipment Wear</span>
                  <span className="text-destructive">-${formatCurrency(equipmentWearCost)}</span>
                </div>
              </div>
              <div className="border-t pt-3">
                <div className="flex justify-between items-center">
                  <p className="text-lg font-semibold">Net Profit</p>
                  <p className={`text-2xl font-bold ${netProfit >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    ${formatCurrency(netProfit)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Attendance */}
          <Card>
            <CardHeader>
              <CardTitle>Attendance Analysis</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Capacity</span>
                <span className="font-semibold">{actualAttendance} / {venueCapacity}</span>
              </div>
              <Progress value={attendancePercentage} className="h-3" />
              <p className="text-sm text-muted-foreground text-center">
                {attendancePercentage.toFixed(1)}% of venue capacity
              </p>
            </CardContent>
          </Card>

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
