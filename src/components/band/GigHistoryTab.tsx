import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, DollarSign, Users, Star, TrendingUp, Sparkles } from "lucide-react";
import { format } from "date-fns";
import { useState } from "react";
import { GigOutcomeReport } from "@/components/gig/GigOutcomeReport";

interface GigHistoryTabProps {
  bandId: string;
}

export const GigHistoryTab = ({ bandId }: GigHistoryTabProps) => {
  const [selectedOutcome, setSelectedOutcome] = useState<any>(null);
  const [showReport, setShowReport] = useState(false);

  const { data: gigHistory, isLoading } = useQuery({
    queryKey: ['gig-history', bandId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('gig_outcomes')
        .select(`
          *,
          gigs!inner(
            *,
            venues(name, capacity, location),
            setlists(name)
          )
        `)
        .eq('gigs.band_id', bandId)
        .not('completed_at', 'is', null)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    refetchInterval: 5000, // Refetch every 5 seconds to catch newly completed gigs
  });

  const handleViewDetails = async (outcome: any) => {
    // Fetch song performances for this gig
    const { data: songPerfs } = await supabase
      .from('gig_song_performances')
      .select('*, songs(title, genre, duration_seconds)')
      .eq('gig_outcome_id', outcome.id)
      .order('position');

    setSelectedOutcome({
      ...outcome,
      gig_song_performances: songPerfs || [],
      breakdown_data: {
        equipment_quality: outcome.equipment_quality_avg || 0,
        crew_skill: outcome.crew_skill_avg || 0,
        band_chemistry: outcome.band_chemistry_level || 0,
        member_skills: outcome.member_skill_avg || 0,
        merch_items_sold: outcome.merch_items_sold || 0
      },
      chemistry_impact: outcome.chemistry_change || 0,
      equipment_wear_cost: outcome.equipment_cost || 0
    });
    setShowReport(true);
  };

  if (isLoading) {
    return <div className="flex justify-center p-8">Loading gig history...</div>;
  }

  if (!gigHistory || gigHistory.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          No gig history yet. Book and perform your first gig!
        </CardContent>
      </Card>
    );
  }

  const totalGigScore = gigHistory.reduce((sum: number, outcome: any) => sum + Number(outcome.overall_rating || 0), 0);
  const averageGigScore = totalGigScore / gigHistory.length;

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

        {gigHistory.map((outcome: any) => {
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
          songs={[]}
        />
      )}
    </>
  );
};