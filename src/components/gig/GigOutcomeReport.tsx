import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Star, TrendingUp, TrendingDown, Minus, Music, DollarSign } from "lucide-react";
import { getPerformanceGrade } from "@/utils/gigPerformanceCalculator";

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

  const grade = getPerformanceGrade(outcome.overall_rating);
  const starsFilled = Math.floor(outcome.overall_rating);
  const starsPartial = outcome.overall_rating - starsFilled;

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
                  {renderStars(outcome.overall_rating)}
                  <p className="text-3xl font-bold mt-2">
                    {outcome.overall_rating.toFixed(1)} / 25
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
                  <p className="text-xl font-semibold">${outcome.ticket_revenue.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Merchandise</p>
                  <p className="text-xl font-semibold">${outcome.merch_sales.toLocaleString()}</p>
                </div>
              </div>
              <div className="border-t pt-3">
                <p className="text-sm text-muted-foreground">Total Revenue</p>
                <p className="text-2xl font-bold">${outcome.total_revenue.toLocaleString()}</p>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Crew Costs</span>
                  <span className="text-destructive">-${outcome.crew_costs.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Equipment Wear</span>
                  <span className="text-destructive">-${outcome.equipment_wear_cost.toLocaleString()}</span>
                </div>
              </div>
              <div className="border-t pt-3">
                <div className="flex justify-between items-center">
                  <p className="text-lg font-semibold">Net Profit</p>
                  <p className={`text-2xl font-bold ${outcome.net_profit >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    ${outcome.net_profit.toLocaleString()}
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
                <span className="font-semibold">{outcome.actual_attendance} / {venueCapacity}</span>
              </div>
              <Progress value={outcome.attendance_percentage} className="h-3" />
              <p className="text-sm text-muted-foreground text-center">
                {outcome.attendance_percentage.toFixed(1)}% of venue capacity
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
                <Progress value={outcome.breakdown_data.equipment_quality} className="h-2 mt-1" />
                <p className="text-xs text-muted-foreground mt-1">
                  {outcome.breakdown_data.equipment_quality.toFixed(0)}/100
                </p>
              </div>
              <div>
                <p className="text-sm font-semibold">Crew Skill</p>
                <Progress value={outcome.breakdown_data.crew_skill} className="h-2 mt-1" />
                <p className="text-xs text-muted-foreground mt-1">
                  {outcome.breakdown_data.crew_skill.toFixed(0)}/100
                </p>
              </div>
              <div>
                <p className="text-sm font-semibold">Band Chemistry</p>
                <Progress value={outcome.breakdown_data.band_chemistry} className="h-2 mt-1" />
                <p className="text-xs text-muted-foreground mt-1">
                  {outcome.breakdown_data.band_chemistry.toFixed(0)}/100
                </p>
              </div>
              <div>
                <p className="text-sm font-semibold">Member Skills</p>
                <Progress value={(outcome.breakdown_data.member_skills / 150) * 100} className="h-2 mt-1" />
                <p className="text-xs text-muted-foreground mt-1">
                  {outcome.breakdown_data.member_skills.toFixed(0)}/150
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
                <p className="text-2xl font-bold text-primary">+{outcome.fame_gained}</p>
                <p className="text-sm text-muted-foreground">Fame Gained</p>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center gap-1">
                  {outcome.chemistry_impact > 0 && <TrendingUp className="w-4 h-4 text-green-500" />}
                  {outcome.chemistry_impact < 0 && <TrendingDown className="w-4 h-4 text-red-500" />}
                  {outcome.chemistry_impact === 0 && <Minus className="w-4 h-4 text-muted" />}
                  <p className={`text-2xl font-bold ${
                    outcome.chemistry_impact > 0 ? 'text-green-500' : 
                    outcome.chemistry_impact < 0 ? 'text-red-500' : 
                    'text-muted-foreground'
                  }`}>
                    {outcome.chemistry_impact > 0 ? '+' : ''}{outcome.chemistry_impact}
                  </p>
                </div>
                <p className="text-sm text-muted-foreground">Chemistry Change</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-blue-500">
                  {outcome.breakdown_data.merch_items_sold || 0}
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
