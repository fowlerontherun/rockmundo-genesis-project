import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, DollarSign, Users, Star, TrendingUp, Sparkles } from "lucide-react";
import { format } from "date-fns";
import { useMemo, useState } from "react";
import { GigOutcomeReport } from "@/components/gig/GigOutcomeReport";
import { useBandGearEffects } from "@/hooks/useBandGearEffects";
import type { Database } from "@/lib/supabase-types";
import { buildGearOutcomeNarrative } from "@/utils/gigNarrative";

interface GigHistoryTabProps {
  bandId: string;
}

type GigOutcomeRow = Database['public']['Tables']['gig_outcomes']['Row'];
type GigRow = Database['public']['Tables']['gigs']['Row'];
type VenueRow = Database['public']['Tables']['venues']['Row'];
type SetlistRow = Database['public']['Tables']['setlists']['Row'];
type GigSongPerformanceRow = Database['public']['Tables']['gig_song_performances']['Row'] & {
  songs: Pick<Database['public']['Tables']['songs']['Row'], 'title' | 'genre' | 'duration_seconds'> | null;
  setlist_position: number;
  song_quality_contribution: number;
  rehearsal_contribution: number;
  chemistry_contribution: number;
  equipment_contribution: number;
  crew_contribution: number;
  member_skills_contribution: number;
  crowd_response: string;
  performance_score: number;
};


type GigHistoryOutcome = GigOutcomeRow & {
  gigs: (GigRow & {
    venues: Pick<VenueRow, 'name' | 'capacity' | 'location'> | null;
    setlists: Pick<SetlistRow, 'name'> | null;
  }) | null;
};

type GigOutcomeWithDetails = GigHistoryOutcome & {
  gig_song_performances: GigSongPerformanceRow[];
  breakdown_data: {
    equipment_quality: number;
    crew_skill: number;
    band_chemistry: number;
    member_skills: number;
    merch_items_sold: number;
  };
  chemistry_impact: number;
  equipment_wear_cost: number;
  merch_sales: number;
  crew_costs: number;
  gear_effects?: import("@/utils/gearModifiers").GearModifierEffects;
};
export const GigHistoryTab = ({ bandId }: GigHistoryTabProps) => {
  const [selectedOutcome, setSelectedOutcome] = useState<GigOutcomeWithDetails | null>(null);
  const [showReport, setShowReport] = useState(false);

  const { data: selectedGearData } = useBandGearEffects(selectedOutcome?.gigs?.band_id ?? bandId, {
    enabled: showReport && Boolean(selectedOutcome?.gigs?.band_id ?? bandId),
  });

  const selectedBandGearEffects = selectedGearData?.gearEffects;

  const gearNarrative = useMemo(() => {
    if (!selectedOutcome) return null;

    return buildGearOutcomeNarrative({
      outcome: selectedOutcome,
      gearEffects: selectedBandGearEffects ?? (selectedOutcome as any).gear_effects,
      setlistLength: selectedOutcome.gig_song_performances?.length ?? 0,
    });
  }, [selectedBandGearEffects, selectedOutcome]);

  const { data: gigHistory = [], isLoading, error } = useQuery<GigHistoryOutcome[]>({
    queryKey: ['gig-history', bandId],
    queryFn: async () => {
      // First get gig IDs for this band
      const { data: gigs, error: gigsError } = await supabase
        .from('gigs')
        .select('id')
        .eq('band_id', bandId)
        .eq('status', 'completed');
      
      if (gigsError) {
        console.error('Error fetching gigs:', gigsError);
        throw gigsError;
      }
      
      if (!gigs || gigs.length === 0) {
        return [];
      }
      
      const gigIds = gigs.map(g => g.id);
      
      // Then get outcomes with full details
      const { data, error } = await supabase
        .from('gig_outcomes')
        .select(`
          *,
          gigs!gig_outcomes_gig_id_fkey(
            *,
            venues(name, capacity, location),
            setlists(name)
          )
        `)
        .in('gig_id', gigIds)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching gig history:', error);
        throw error;
      }
      
      return (data ?? []) as unknown as GigHistoryOutcome[];
    },
    refetchInterval: 30000, // Refetch every 30 seconds
    enabled: !!bandId,
  });

  if (error) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-destructive">
          Failed to load gig history. Please try again shortly.
        </CardContent>
      </Card>
    );
  }

  const handleViewDetails = async (outcome: GigHistoryOutcome) => {
    // Fetch song performances for this gig
    const { data: songPerfs } = await supabase
      .from('gig_song_performances')
      .select('*, songs(title, genre, duration_seconds)')
      .eq('gig_outcome_id', outcome.id)
      .order('position');

    setSelectedOutcome({
      ...outcome,
      gig_song_performances: (songPerfs ?? []) as GigSongPerformanceRow[],
      breakdown_data: {
        equipment_quality: outcome.equipment_quality_avg || 0,
        crew_skill: outcome.crew_skill_avg || 0,
        band_chemistry: outcome.band_chemistry_level || 0,
        member_skills: outcome.member_skill_avg || 0,
        merch_items_sold: outcome.merch_items_sold || 0
      },
      chemistry_impact: outcome.chemistry_change || 0,
      equipment_wear_cost: outcome.equipment_cost || 0,
      merch_sales: outcome.merch_revenue || 0,
      crew_costs: outcome.crew_cost || 0,
      gear_effects: {
        equipmentQualityBonus: outcome.band_synergy_modifier || 0,
        attendanceBonusPercent: outcome.social_buzz_impact || 0,
        reliabilitySwingReductionPercent: outcome.audience_memory_impact || 0,
        revenueBonusPercent: outcome.promoter_modifier || 0,
        fameBonusPercent: outcome.venue_loyalty_bonus || 0,
        breakdown: (outcome as any).gear_effects?.breakdown,
      }
    } as GigOutcomeWithDetails);
    setShowReport(true);
  };

  if (isLoading) {
    return <div className="flex justify-center p-8">Loading gig history...</div>;
  }

  if (gigHistory.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          No gig history yet. Book and perform your first gig!
        </CardContent>
      </Card>
    );
  }

  const totalGigScore = gigHistory.reduce((sum: number, outcome: GigHistoryOutcome) => {
    const numericRating = Number(outcome.overall_rating ?? 0);
    const rating = Number.isFinite(numericRating) ? numericRating : 0;
    return sum + rating;
  }, 0);
  const averageGigScore = gigHistory.length > 0 ? totalGigScore / gigHistory.length : 0;

  return (
    <>
      <div className="space-y-4">
        <Card className="border-dashed">
          <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Completed Gigs</p>
              <p className="text-2xl font-semibold">{gigHistory.length}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Gig Score</p>
              <p className="text-2xl font-semibold">{totalGigScore.toFixed(1)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Average Score</p>
              <p className="text-2xl font-semibold">{averageGigScore.toFixed(1)}</p>
            </div>
          </CardContent>
        </Card>

        {gigHistory.map((outcome: GigHistoryOutcome) => {
          const gig = outcome.gigs;
          const venue = gig?.venues;
          const qualityInputs = [
            outcome.equipment_quality_avg,
            outcome.crew_skill_avg,
            outcome.member_skill_avg,
            outcome.band_chemistry_level
          ].filter((value) => typeof value === 'number') as number[];
          const qualityRating = qualityInputs.length
            ? Math.round(qualityInputs.reduce((sum, value) => sum + value, 0) / qualityInputs.length)
            : null;

          return (
            <Card key={outcome.id} className="hover:bg-accent/50 transition-colors">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-lg">{venue?.name || 'Unknown Venue'}</CardTitle>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      {gig?.scheduled_date ? format(new Date(gig.scheduled_date), 'PPP') : 'Unknown Date'}
                    </div>
                  </div>
                  <Badge variant={
                    outcome.overall_rating >= 20 ? 'default' :
                    outcome.overall_rating >= 15 ? 'secondary' : 'outline'
                  }>
                    {outcome.performance_grade || 'N/A'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Star className="h-3 w-3" />
                      Rating
                    </div>
                    <div className="font-semibold">{outcome.overall_rating?.toFixed(1)}/25</div>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Users className="h-3 w-3" />
                      Attendance
                    </div>
                    <div className="font-semibold">
                      {outcome.actual_attendance} ({outcome.attendance_percentage?.toFixed(0)}%)
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <DollarSign className="h-3 w-3" />
                      Net Profit
                    </div>
                    <div className={`font-semibold ${outcome.net_profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      ${outcome.net_profit?.toLocaleString()}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <TrendingUp className="h-3 w-3" />
                      Fame Gained
                    </div>
                    <div className="font-semibold text-primary">
                      +{outcome.fame_gained}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Sparkles className="h-3 w-3" />
                      Quality Rating
                    </div>
                    <div className="font-semibold">
                      {qualityRating !== null ? `${qualityRating}/100` : 'N/A'}
                    </div>
                  </div>
                </div>
                <Button
                  onClick={() => handleViewDetails(outcome)}
                  variant="outline"
                  size="sm"
                  className="w-full"
                >
                  View Full Report
                </Button>
              </CardContent>
            </Card>
          );
        })}
        </div>

        {selectedOutcome && (
          <GigOutcomeReport
            isOpen={showReport}
            onClose={() => {
              setShowReport(false);
              setSelectedOutcome(null);
            }}
            outcome={selectedOutcome}
            venueName={selectedOutcome.gigs?.venues?.name || 'Unknown Venue'}
            venueCapacity={selectedOutcome.gigs?.venues?.capacity || 0}
            songs={selectedOutcome.gig_song_performances.map((performance) => ({
              id: performance.song_id || performance.id,
              title: performance.songs?.title || 'Unknown Song'
            }))}
            gearEffects={selectedBandGearEffects ?? selectedOutcome.gear_effects}
            gearNarrative={gearNarrative}
          />
        )}
      </>
    );
  };
