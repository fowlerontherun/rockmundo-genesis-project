import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth-context';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Music, Calendar, MapPin, ArrowLeft, Users, DollarSign, PlayCircle, Flag, CheckCircle2, Clock } from 'lucide-react';
import { RealtimeGigViewer } from '@/components/gig/RealtimeGigViewer';
import { GigOutcomeReport } from '@/components/gig/GigOutcomeReport';
import { GigPreparationChecklist } from '@/components/gig/GigPreparationChecklist';
import { useRealtimeGigAdvancement } from '@/hooks/useRealtimeGigAdvancement';
import { useManualGigStart } from '@/hooks/useManualGigStart';
import type { Database } from '@/lib/supabase-types';
import { format, differenceInMinutes, isBefore, addMinutes } from 'date-fns';
import { useBandGearEffects } from '@/hooks/useBandGearEffects';
import { buildGearOutcomeNarrative } from '@/utils/gigNarrative';

type GigWithVenue = Database['public']['Tables']['gigs']['Row'] & {
  venues: Database['public']['Tables']['venues']['Row'] | null;
};

export default function PerformGig() {
  const { gigId } = useParams<{ gigId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [gig, setGig] = useState<GigWithVenue | null>(null);
  const [setlistSongs, setSetlistSongs] = useState<any[]>([]);
  const [rehearsals, setRehearsals] = useState<any[]>([]);
  const [equipmentCount, setEquipmentCount] = useState(0);
  const [crewCount, setCrewCount] = useState(0);
  const [bandChemistry, setBandChemistry] = useState(0);
  const [showOutcome, setShowOutcome] = useState(false);
  const [outcome, setOutcome] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [finalizing, setFinalizing] = useState(false);
  const [timeUntilReport, setTimeUntilReport] = useState<string | null>(null);

  const { data: bandGearData, isLoading: bandGearLoading } = useBandGearEffects(gig?.band_id ?? null, {
    enabled: !!gig?.band_id,
  });

  const gearEffects = bandGearData?.gearEffects;
  const equippedGearCount = bandGearData?.gearItems.length ?? 0;

  const loadGig = useCallback(async () => {
    if (!gigId || !user) return;

    try {
      // Load gig details
      const { data: gigData, error: gigError } = await supabase
        .from('gigs')
        .select('*, venues!gigs_venue_id_fkey(*)')
        .eq('id', gigId)
        .single();

      if (gigError) throw gigError;

      // Check if gig already has an outcome
      const { data: existingOutcome } = await supabase
        .from('gig_outcomes')
        .select('*, gig_song_performances(*, songs(title))')
        .eq('gig_id', gigId)
        .single();

      setGig(gigData as any);

      if (gigData.setlist_id) {
        const [songsRes, rehearsalsRes, equipmentRes, crewRes, bandRes] = await Promise.all([
          supabase
            .from('setlist_songs')
            .select('*, songs!inner(id, title, genre, quality_score)')
            .eq('setlist_id', gigData.setlist_id)
            .order('position'),
          supabase
            .from('band_song_familiarity')
            .select('song_id, familiarity_percentage, familiarity_minutes')
            .eq('band_id', gigData.band_id),
          supabase
            .from('band_stage_equipment')
            .select('id')
            .eq('band_id', gigData.band_id),
          supabase
            .from('band_crew_members')
            .select('id')
            .eq('band_id', gigData.band_id),
          supabase
            .from('bands')
            .select('chemistry_level')
            .eq('id', gigData.band_id)
            .single()
        ]);

        if (songsRes.error) throw songsRes.error;
        setSetlistSongs(songsRes.data || []);
        setRehearsals(rehearsalsRes.data || []);
        setEquipmentCount(equipmentRes.data?.length || 0);
        setCrewCount(crewRes.data?.length || 0);
        setBandChemistry(bandRes.data?.chemistry_level || 0);
      } else {
        setSetlistSongs([]);
        setRehearsals([]);
        setEquipmentCount(0);
        setCrewCount(0);
        setBandChemistry(0);
      }

      if (existingOutcome) {
        const now = new Date();
        const completedAt = gigData.completed_at ? new Date(gigData.completed_at) : null;
        
        // Only show outcome if gig completed more than 10 minutes ago
        const canShowOutcome = completedAt && differenceInMinutes(now, completedAt) >= 10;
        
        if (canShowOutcome) {
          const transformedOutcome = {
            ...existingOutcome,
            breakdown_data: {
              equipment_quality: existingOutcome.equipment_quality_avg || 0,
              crew_skill: existingOutcome.crew_skill_avg || 0,
              band_chemistry: existingOutcome.band_chemistry_level || 0,
              member_skills: existingOutcome.member_skill_avg || 0,
              merch_items_sold: existingOutcome.merch_items_sold || 0
            },
            chemistry_impact: existingOutcome.chemistry_change || 0,
            equipment_wear_cost: existingOutcome.equipment_cost || 0,
            gear_effects: {
              equipmentQualityBonus: existingOutcome.band_synergy_modifier || 0,
              attendanceBonusPercent: existingOutcome.social_buzz_impact || 0,
              reliabilitySwingReductionPercent: existingOutcome.audience_memory_impact || 0,
              revenueBonusPercent: existingOutcome.promoter_modifier || 0,
              fameBonusPercent: existingOutcome.venue_loyalty_bonus || 0,
              breakdown: (existingOutcome as any).gear_effects?.breakdown,
            }
          };
          setOutcome(transformedOutcome);
          setShowOutcome(false); // Don't auto-show, let user click to view
        } else {
          // Outcome exists but it's too soon - keep showing live view
          setOutcome(null);
          setShowOutcome(false);
        }
      } else {
        setOutcome(null);
        setShowOutcome(false);
      }

      setLoading(false);
    } catch (error) {
      console.error('Error loading gig:', error);
      toast({
        title: "Error",
        description: "Failed to load gig details",
        variant: "destructive"
      });
      navigate('/gig-booking');
    }
  }, [gigId, user, navigate, toast]);

  useEffect(() => {
    loadGig();
  }, [loadGig]);

  const startGigMutation = useManualGigStart();

  // Determine if we should show live viewer or final report
  const shouldShowLiveViewer = useMemo(() => {
    if (!gig) return false;
    
    const now = new Date();
    const scheduledDate = new Date(gig.scheduled_date);
    const completedAt = gig.completed_at ? new Date(gig.completed_at) : null;
    
    // Show live viewer if gig starts within 10 minutes
    const isWithin10MinutesOfStart = differenceInMinutes(scheduledDate, now) <= 10 && isBefore(now, scheduledDate);
    
    // Show live viewer if gig is in progress
    const isInProgress = gig.status === 'in_progress' || gig.status === 'ready_for_completion';
    
    // Show live viewer if gig completed less than 10 minutes ago
    const isRecentlyCompleted = completedAt && differenceInMinutes(now, completedAt) < 10;
    
    return isWithin10MinutesOfStart || isInProgress || isRecentlyCompleted;
  }, [gig]);

  // Use realtime gig advancement only when showing live viewer
  useRealtimeGigAdvancement(gigId || null, shouldShowLiveViewer && !showOutcome);

  // Auto-refresh when the 10-minute window elapses after completion
  useEffect(() => {
    if (!gig?.completed_at) return;
    
    const completedAt = new Date(gig.completed_at);
    const tenMinutesAfter = addMinutes(completedAt, 10);
    const now = new Date();
    
    // If we're before the 10-minute mark, set a timer to reload at that time
    if (isBefore(now, tenMinutesAfter)) {
      const msUntilRefresh = tenMinutesAfter.getTime() - now.getTime();
      
      const timer = setTimeout(() => {
        console.log('[PerformGig] 10 minutes elapsed since completion, reloading to show report');
        loadGig();
      }, msUntilRefresh);
      
      return () => clearTimeout(timer);
    }
  }, [gig?.completed_at, loadGig]);

  // Update countdown timer for report availability
  useEffect(() => {
    if (!gig?.completed_at || outcome) {
      setTimeUntilReport(null);
      return;
    }
    
    const updateCountdown = () => {
      const completedAt = new Date(gig.completed_at!);
      const tenMinutesAfter = addMinutes(completedAt, 10);
      const now = new Date();
      
      if (isBefore(now, tenMinutesAfter)) {
        const minutesLeft = Math.ceil(differenceInMinutes(tenMinutesAfter, now));
        const secondsLeft = Math.ceil((tenMinutesAfter.getTime() - now.getTime()) / 1000) % 60;
        setTimeUntilReport(`${minutesLeft}:${secondsLeft.toString().padStart(2, '0')}`);
      } else {
        setTimeUntilReport(null);
      }
    };
    
    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    
    return () => clearInterval(interval);
  }, [gig?.completed_at, outcome]);

  const handleGigComplete = async () => {
    // Reload to show outcome
    await loadGig();
  };

  const handleFinalizeGig = async () => {
    if (!gigId) return;
    setFinalizing(true);
    try {
      const { error } = await supabase.functions.invoke('complete-gig', {
        body: { gigId }
      });

      if (error) {
        throw error;
      }

      toast({
        title: 'Gig finalized',
        description: 'We generated the performance report based on the completed set.',
      });

      await loadGig();
    } catch (error: any) {
      console.error('Error finalizing gig:', error);
      toast({
        title: 'Unable to finalize gig',
        description: error?.message || 'Please try again in a moment.',
        variant: 'destructive'
      });
    } finally {
      setFinalizing(false);
    }
  };

  const handleStartGig = () => {
    if (gigId) {
      startGigMutation.mutate(gigId);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              <span className="ml-2">Loading gig details...</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!gig) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">Gig not found</p>
            <Button onClick={() => navigate('/gig-booking')} className="mt-4 w-full">
              Back to Gig Booking
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const venueName = gig.venues?.name || 'Unknown Venue';
  const venueLocation = gig.venues?.location || 'Unknown Location';
  const capacity = gig.venues?.capacity || 0;

  const setlistLength = setlistSongs.length;

  const gearOutcomeNarrative = useMemo(() => {
    if (!outcome) return null;

    return buildGearOutcomeNarrative({
      outcome,
      gearEffects: gearEffects ?? undefined,
      setlistLength,
    });
  }, [outcome, gearEffects, setlistLength]);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Button
        variant="ghost"
        onClick={() => navigate('/gig-booking')}
        className="gap-2"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Gig Booking
      </Button>

      {/* Gig Info Header */}
      <Card>
        <CardHeader>
          <CardTitle className="text-3xl flex items-center gap-3">
            <Music className="h-8 w-8" />
            {venueName}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Date</p>
                <p className="font-semibold">
                  {format(new Date(gig.scheduled_date), 'PPP p')}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Location</p>
                <p className="font-semibold">{venueLocation}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Capacity</p>
                <p className="font-semibold">{capacity}</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Badge variant="secondary">
              <DollarSign className="h-3 w-3 mr-1" />
              ${gig.ticket_price} per ticket
            </Badge>
            <Badge variant="outline">
              {setlistSongs.length} songs in setlist
            </Badge>
            <Badge variant={
              gig.status === 'in_progress' ? 'default' :
              gig.status === 'completed' ? 'secondary' :
              gig.status === 'cancelled' ? 'destructive' :
              'outline'
            }>
              {gig.status === 'in_progress' ? '🔴 Live Now' : gig.status}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Preparation Checklist */}
      {setlistSongs.length > 0 && (
        <GigPreparationChecklist
          setlistSongs={setlistSongs}
          rehearsals={rehearsals.map(r => ({
            song_id: r.song_id,
            song_title: r.songs?.title || 'Unknown',
            rehearsal_level: r.rehearsal_level || 0
          }))}
          equipmentCount={equipmentCount}
          crewCount={crewCount}
          bandChemistry={bandChemistry}
          gearEffects={gearEffects}
          equippedGearCount={equippedGearCount}
          gearLoading={bandGearLoading}
        />
      )}

      {/* Start Gig Button - shown when gig is scheduled and time has passed */}
      {gig.status === 'scheduled' && new Date(gig.scheduled_date) <= new Date() && (
        <Card>
          <CardHeader>
            <CardTitle>Ready to Perform</CardTitle>
            <CardDescription>
              Your gig is scheduled to start. Click below to begin the performance.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={handleStartGig}
              disabled={startGigMutation.isPending}
              className="w-full"
              size="lg"
            >
              <PlayCircle className="mr-2 h-5 w-5" />
              Start Performance
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Finalize Gig CTA */}
      {gig.status === 'ready_for_completion' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Flag className="h-4 w-4 text-primary" />
              Finalize Performance
            </CardTitle>
            <CardDescription>
              The band has wrapped the set. Finalize the show to generate the results report.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              Confirming completion will calculate attendance, payouts, and fan impact for this gig.
            </p>
            <Button
              onClick={handleFinalizeGig}
              disabled={finalizing}
              className="sm:w-auto"
            >
              {finalizing ? 'Finalizing...' : 'Finalize Gig'}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Real-time Performance Viewer - shown when within 10 min of start, during gig, or up to 10 min after */}
      {shouldShowLiveViewer && setlistSongs.length > 0 && !showOutcome && (
        <RealtimeGigViewer
          gigId={gig.id}
          onComplete={handleGigComplete}
        />
      )}

      {/* Processing Message - shown when gig just completed but report not ready yet */}
      {gig.status === 'completed' && !outcome && (
        <Card className="border-primary/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
              Processing Results
            </CardTitle>
            <CardDescription>
              The gig just wrapped up! We're processing the performance data and will have your report ready in a few minutes.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Final reports are typically available 10 minutes after the performance ends.
            </p>
            {timeUntilReport && (
              <div className="flex items-center gap-2 p-3 rounded-lg border bg-muted/50">
                <Clock className="h-4 w-4 text-primary" />
                <div>
                  <p className="text-sm font-medium">Report Ready In</p>
                  <p className="text-2xl font-bold text-primary">{timeUntilReport}</p>
                </div>
              </div>
            )}
            <Button 
              variant="outline" 
              onClick={loadGig}
              className="w-full"
            >
              Refresh Status
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Completed Gig CTA */}
      {gig.status === 'completed' && outcome && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              Performance Completed
            </CardTitle>
            <CardDescription>
              Review the detailed report to see how the crowd responded and how much you earned.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-muted-foreground">
              Outcome recorded on {format(new Date(gig.updated_at || gig.scheduled_date), 'PPP p')}.
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => navigate('/gig-booking')}>
                Back to Schedule
              </Button>
              <Button onClick={() => setShowOutcome(true)}>
                View Performance Report
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <GigOutcomeReport
        isOpen={!!outcome && showOutcome}
        onClose={() => setShowOutcome(false)}
        outcome={outcome}
        venueName={gig.venues?.name || 'Unknown Venue'}
        venueCapacity={gig.venues?.capacity || 0}
        songs={setlistSongs.map(s => ({ id: s.song_id, title: s.songs?.title || 'Unknown' }))}
        gearEffects={gearEffects}
        gearNarrative={gearOutcomeNarrative}
      />
    </div>
  );
}
