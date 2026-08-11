import { useState, useEffect, useCallback, useMemo, type ReactNode } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
// useAuth removed — profileId from useActiveProfile
import { useActiveProfile } from '@/hooks/useActiveProfile';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Music, Calendar, Users, DollarSign, PlayCircle, Flag, CheckCircle2, AlertCircle, ChevronDown, ListMusic, UserRoundCheck, Tickets, type LucideIcon } from 'lucide-react';
import { GigOutcomeReport } from '@/components/gig/GigOutcomeReport';
import { useFixStuckGigs } from '@/hooks/useFixStuckGigs';
import { GigPreparationPanel } from '@/components/gig/GigPreparationPanel';
import { TicketPriceAdjuster } from '@/components/gig/TicketPriceAdjuster';
import { useLiveGigState } from '@/hooks/useLiveGigState';
import { useManualGigStart } from '@/hooks/useManualGigStart';
import type { Database } from '@/lib/supabase-types';
import { format, differenceInMinutes, differenceInDays, isBefore } from 'date-fns';
import { useBandGearEffects } from '@/hooks/useBandGearEffects';
import { buildGearOutcomeNarrative } from '@/utils/gigNarrative';
import { calculateDailySalesRate } from '@/utils/ticketSalesSimulation';
import { FMPageScaffold } from "@/components/fm/FMPageScaffold";
import { GigPerformersSection } from "@/components/social/ParticipantStatusList";
import { useGigExperience } from "@/features/gig-experience/hooks";
import { GigViewerShell } from "@/features/gig-experience/viewer/GigViewerShell";
import { LiveGigStageView } from "@/features/gig-experience/viewer/LiveGigStageView";

type GigWithVenue = Database['public']['Tables']['gigs']['Row'] & {
  venues: Database['public']['Tables']['venues']['Row'] | null;
};

export default function PerformGig() {
  const { gigId } = useParams<{ gigId: string }>();
  const navigate = useNavigate();
  // profileId already available from useActiveProfile below
  const { profileId } = useActiveProfile();
  const { toast } = useToast();

  const [gig, setGig] = useState<GigWithVenue | null>(null);
  const [setlistSongs, setSetlistSongs] = useState<any[]>([]);
  const [bandChemistry, setBandChemistry] = useState(0);
  const [bandFame, setBandFame] = useState(0);
  const [bandTotalFans, setBandTotalFans] = useState(0);
  const [showOutcome, setShowOutcome] = useState(false);
  const [showReplay, setShowReplay] = useState(false);
  const [viewerDismissed, setViewerDismissed] = useState(false);
  // const [show3DViewer, setShow3DViewer] = useState(false); // Removed - using inline viewer
  const [outcome, setOutcome] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  // Viewer mode removed — single top-down viewer

  const gigExperienceQuery = useGigExperience(gigId || null, !!gigId && !!profileId);
  const gigExperience = gigExperienceQuery.data ?? null;

  const { data: bandGearData } = useBandGearEffects(gig?.band_id ?? null, {
    enabled: !!gig?.band_id,
  });

  const gearEffects = bandGearData?.gearEffects;

  const loadGig = useCallback(async () => {
    if (!gigId || !profileId) return;

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

      const { data: bandRes } = await supabase
        .from('bands')
        .select('chemistry_level, fame, total_fans')
        .eq('id', gigData.band_id)
        .single();

      setBandChemistry(bandRes?.chemistry_level || 0);
      setBandFame(bandRes?.fame || 0);
      setBandTotalFans(bandRes?.total_fans || 0);

      // Authoritative performance setlist is the gig preparation setlist.
      // Only fall back to the legacy band setlist when no prep setlist exists.
      const { data: prepSetlist } = await (supabase as any)
        .from('gig_setlists')
        .select('id, gig_setlist_items(song_id, position, is_encore, songs(id, title, genre, quality_score))')
        .eq('gig_id', gigId)
        .maybeSingle();

      const prepItems = (prepSetlist?.gig_setlist_items || []) as any[];

      if (prepItems.length > 0) {
        setSetlistSongs(
          [...prepItems]
            .sort((a, b) => (a.position || 0) - (b.position || 0))
            .map((item) => ({
              song_id: item.song_id,
              position: item.position,
              is_encore: item.is_encore,
              songs: item.songs,
            })),
        );
      } else if (gigData.setlist_id) {
        const { data: legacySongs, error: legacySongsError } = await supabase
          .from('setlist_songs')
          .select('*, songs!inner(id, title, genre, quality_score)')
          .eq('setlist_id', gigData.setlist_id)
          .order('position');
        if (legacySongsError) throw legacySongsError;
        setSetlistSongs(legacySongs || []);
      } else {
        setSetlistSongs([]);
      }

      if (existingOutcome && (gigData as any).result_ready_at) {
        setOutcome(existingOutcome);
        setShowOutcome(false);
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
  }, [gigId, profileId, navigate, toast]);

  useEffect(() => {
    loadGig();
  }, [loadGig]);

  useEffect(() => {
    setViewerDismissed(false);
  }, [gigId, gig?.status]);

  const startGigMutation = useManualGigStart();
  const fixStuckGigs = useFixStuckGigs();

  const handleFixStuckGig = async () => {
    if (!gigId) return;
    await fixStuckGigs.mutateAsync([gigId]);
    loadGig(); // Reload after fixing
  };

  // Determine if we should show live viewer or final report
  const shouldShowLiveViewer = useMemo(() => {
    if (!gig) return false;
    
    const now = new Date();
    const scheduledDate = new Date(gig.scheduled_date);
    // Show live viewer if gig starts within 10 minutes
    const isWithin10MinutesOfStart = differenceInMinutes(scheduledDate, now) <= 10 && isBefore(now, scheduledDate);
    
    // Show live viewer if gig is in progress
    const isInProgress = gig.status === 'in_progress' || gig.status === 'ready_for_completion';
    
    return isWithin10MinutesOfStart || isInProgress;
  }, [gig]);

  const isLiveStateEnabled = shouldShowLiveViewer && !showOutcome;
  useLiveGigState(gigId || null, isLiveStateEnabled, loadGig);

  const handleStartGig = async () => {
    if (!gigId || !profileId) return;
    
    // Check if player is in the correct city for the gig
    const { data: profile } = await supabase
      .from('profiles')
      .select('current_city_id')
      .eq('id', profileId)
      .single();

    const venueCityId = gig?.venues?.city_id;

    if (profile?.current_city_id && venueCityId && profile.current_city_id !== venueCityId) {
      // Get city names for better error message
      const { data: cities } = await supabase
        .from('cities')
        .select('id, name')
        .in('id', [profile.current_city_id, venueCityId]);
      
      const playerCity = cities?.find(c => c.id === profile.current_city_id)?.name || 'your current city';
      const venueCity = cities?.find(c => c.id === venueCityId)?.name || 'the venue city';

      toast({
        title: 'Wrong Location',
        description: `You are in ${playerCity} but the gig is in ${venueCity}. Travel to the correct city first.`,
        variant: 'destructive',
      });
      return;
    }

    if (gig) {
      const gigStart = new Date(gig.scheduled_date);
      const gigEnd = new Date(gigStart.getTime() + 2 * 60 * 60 * 1000); // Assume 2 hour gig

      const { data: hasConflict } = await (supabase as any).rpc('check_scheduling_conflict', {
        p_user_id: profileId,
        p_start: gigStart.toISOString(),
        p_end: gigEnd.toISOString(),
        p_exclude_id: null,
      });

      if (hasConflict) {
        toast({
          title: 'Schedule Conflict',
          description: 'You have another activity scheduled during this time.',
          variant: 'destructive',
        });
        return;
      }
    }
    
    const { data: prepSetlist, error: prepError } = await (supabase as any)
      .from('gig_setlists')
      .select('id,gig_setlist_items(id)')
      .eq('gig_id', gigId)
      .maybeSingle();

    if (prepError || !prepSetlist || (prepSetlist.gig_setlist_items || []).length === 0) {
      toast({
        title: 'Setlist required',
        description: 'Save a valid gig preparation setlist before starting this performance.',
        variant: 'destructive',
      });
      return;
    }

    startGigMutation.mutate(gigId, {
      onSuccess: () => {
        // Reload gig data after starting
        loadGig();
      }
    });
  };

  // All hooks must be called before any early returns
  const setlistLength = setlistSongs.length;
  
  const gearOutcomeNarrative = useMemo(() => {
    if (!outcome) return null;

    return buildGearOutcomeNarrative({
      outcome,
      gearEffects: gearEffects ?? undefined,
      setlistLength,
    });
  }, [outcome, gearEffects, setlistLength]);

  if (loading) {
    return (
      <FMPageScaffold title="Perform Gig" icon={Music} backTo="/gig-booking" backLabel="Back to Gig Booking">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              <span className="ml-2">Loading gig details...</span>
            </div>
          </CardContent>
        </Card>
      </FMPageScaffold>
    );
  }

  if (!gig) {
    return (
      <FMPageScaffold title="Perform Gig" icon={Music} backTo="/gig-booking" backLabel="Back to Gig Booking">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">Gig not found</p>
            <Button onClick={() => navigate('/gig-booking')} className="mt-4 w-full">
              Back to Gig Booking
            </Button>
          </CardContent>
        </Card>
      </FMPageScaffold>
    );
  }

  const venueName = gig.venues?.name || 'Unknown Venue';
  const venueLocation = gig.venues?.location || 'Unknown Location';
  const capacity = gig.venues?.capacity || 0;

  return (
    <FMPageScaffold
      title={venueName}
      subtitle={venueLocation}
      icon={Music}
      backTo="/gig-booking"
      backLabel="Back to Gig Booking"
    >

      {/* Playback is the primary surface once the gig is about to start. */}
      {shouldShowLiveViewer && !showOutcome && !viewerDismissed && (
        <section className="space-y-4" aria-labelledby="gig-viewer-heading">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 id="gig-viewer-heading" className="text-xl font-semibold">Gig Viewer</h2>
              <p className="text-sm text-muted-foreground">Read-only stage presentation using the saved gig setlist.</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge>{gig.status === 'in_progress' ? 'Live now' : gig.status.replace(/_/g, ' ')}</Badge>
              {gig.status === 'in_progress' ? (
                <Button variant="outline" size="sm" onClick={handleFixStuckGig} disabled={fixStuckGigs.isPending}>
                  <AlertCircle className="mr-1 h-3 w-3" />
                  {fixStuckGigs.isPending ? 'Fixing…' : 'Fix stuck gig'}
                </Button>
              ) : null}
            </div>
          </div>

          {gigExperienceQuery.isLoading ? (
            <Card><CardContent className="flex items-center gap-3 p-6 text-sm text-muted-foreground"><div className="h-5 w-5 animate-spin rounded-full border-b-2 border-primary" />Loading the saved setlist and stage view…</CardContent></Card>
          ) : gigExperienceQuery.isError ? (
            <Card>
              <CardContent className="space-y-3 p-6">
                <p className="text-sm text-muted-foreground">The stage data could not be loaded. The gig itself has not been changed.</p>
                <Button variant="outline" onClick={() => void gigExperienceQuery.refetch()}>Retry viewer</Button>
              </CardContent>
            </Card>
          ) : gigExperience && gigExperience.songs.length > 0 ? (
            <LiveGigStageView
              gigId={gig.id}
              experience={gigExperience}
              onViewResult={() => setShowOutcome(true)}
              onClose={() => setViewerDismissed(true)}
            />
          ) : (
            <Card>
              <CardContent className="space-y-2 p-6">
                <p className="font-medium">No saved gig setlist</p>
                <p className="text-sm text-muted-foreground">Add songs in Gig preparation before opening the viewer.</p>
              </CardContent>
            </Card>
          )}
        </section>
      )}

      {/* A single compact summary replaces the repeated venue/setlist blocks. */}
      {(!shouldShowLiveViewer || viewerDismissed) && (
        <Card>
          <CardContent className="space-y-4 pt-6">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div><p className="text-xs text-muted-foreground">Date</p><p className="font-medium">{format(new Date(gig.scheduled_date), 'PPP p')}</p></div>
              </div>
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <div><p className="text-xs text-muted-foreground">Capacity</p><p className="font-medium">{capacity.toLocaleString()}</p></div>
              </div>
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <div><p className="text-xs text-muted-foreground">Ticket</p><p className="font-medium">${gig.ticket_price || 0}</p></div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">{setlistSongs.length} songs</Badge>
              <Badge variant={gig.status === 'completed' ? 'secondary' : gig.status === 'cancelled' ? 'destructive' : 'outline'}>{gig.status.replace(/_/g, ' ')}</Badge>
            </div>
          </CardContent>
        </Card>
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

      {/* Upcoming-gig management stays available without duplicating the page. */}
      {gig.status === 'scheduled' && (
        <div className="space-y-3">
          <ManagementSection icon={ListMusic} title="Setlist and readiness" summary={`${setlistSongs.length} saved songs`}>
            <GigPreparationPanel gigId={gig.id} bandId={gig.band_id} status={gig.status} scheduledDate={gig.scheduled_date} />
          </ManagementSection>

          <ManagementSection icon={UserRoundCheck} title="Line-up" summary="Performers and attendance">
            <GigPerformersSection gigId={gig.id} completedOrCancelled={false} />
          </ManagementSection>

          {(() => {
            const daysUntilGig = differenceInDays(new Date(gig.scheduled_date), new Date());
            const ticketsSold = gig.tickets_sold || 0;
            const venueCapacity = gig.venues?.capacity || 100;
            const predictedSales = calculateDailySalesRate({
              bandFame,
              bandTotalFans,
              venueCapacity,
              daysUntilGig: Math.max(1, daysUntilGig),
              daysBooked: 14,
              ticketPrice: gig.ticket_price || 20,
            }).expectedTotalSales;
            const salesPercentage = predictedSales > 0 ? (ticketsSold / predictedSales) * 100 : 0;
            const canAdjustPrice = daysUntilGig >= 7 && salesPercentage < 50 && !gig.price_adjusted_at;
            if (!canAdjustPrice) return null;
            return (
              <ManagementSection icon={Tickets} title="Ticket pricing" summary="Price adjustment available">
                <TicketPriceAdjuster gigId={gig.id} currentPrice={gig.ticket_price || 20} ticketsSold={ticketsSold} predictedSales={predictedSales} onPriceAdjusted={loadGig} />
              </ManagementSection>
            );
          })()}
        </div>
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
              The band has wrapped the set. The server is generating the results report.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              Attendance, payouts, and fan impact are calculated by the authoritative completion worker.
            </p>
            <Button onClick={loadGig} variant="outline" className="sm:w-auto">
              Refresh Status
            </Button>
          </CardContent>
        </Card>
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
              The report appears as soon as result_ready_at is written by the server.
            </p>
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
              Review the detailed report or rewatch the performance.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-muted-foreground">
              Outcome recorded on {format(new Date(gig.updated_at || gig.scheduled_date), 'PPP p')}.
            </div>
            
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button variant="outline" onClick={() => navigate('/gig-booking')}>
                Back to Schedule
              </Button>
              {gigExperience?.viewer.replayAvailable || (gigExperience?.songs.length ?? 0) > 0 ? (
                <Button variant="secondary" onClick={() => setShowReplay(true)}>Replay Gig</Button>
              ) : gigExperience?.viewer.replay?.generationStatus === "generating" ? (
                <Button variant="outline" disabled>Replay Processing</Button>
              ) : (
                <Button variant="outline" disabled>Replay Unavailable</Button>
              )}
              <Button onClick={() => setShowOutcome(true)}>
                View Report
              </Button>
            </div>
            {showReplay && (gigExperience?.viewer.replayAvailable ? (
              <GigViewerShell gigId={gig.id} experience={gigExperience} open mode="player" onViewResult={() => setShowOutcome(true)} onClose={() => setShowReplay(false)} />
            ) : gigExperience ? (
              <LiveGigStageView gigId={gig.id} experience={gigExperience} onViewResult={() => setShowOutcome(true)} onClose={() => setShowReplay(false)} />
            ) : null)}
          </CardContent>
        </Card>
      )}

      {/* Legacy 3D viewer modal - kept for backward compatibility but now using inline viewers */}

      <GigOutcomeReport
        isOpen={!!outcome && showOutcome}
        onClose={() => setShowOutcome(false)}
        outcome={outcome}
        experience={gigExperience}
        venueName={gig.venues?.name || 'Unknown Venue'}
        venueCapacity={gig.venues?.capacity || 0}
        songs={setlistSongs.map(s => ({ id: s.song_id, title: s.songs?.title || 'Unknown' }))}
        gearEffects={gearEffects}
        gearNarrative={gearOutcomeNarrative}
        chemistryLevel={bandChemistry}
        chemistryChange={outcome?.chemistry_impact || outcome?.chemistry_change || 0}
        chemistryMoments={outcome?.chemistryMoments || []}
        stageBehaviorUsed={outcome?.stage_behavior_used}
        bandId={gig.band_id}
        gigId={gig.id}
      />
    </FMPageScaffold>
  );
}

function ManagementSection({
  icon: Icon,
  title,
  summary,
  children,
}: {
  icon: LucideIcon;
  title: string;
  summary: string;
  children: ReactNode;
}) {
  return (
    <Card className="overflow-hidden">
      <details className="group">
        <summary className="flex cursor-pointer list-none items-center gap-3 p-4 marker:hidden [&::-webkit-details-marker]:hidden">
          <Icon className="h-5 w-5 text-primary" />
          <div className="min-w-0 flex-1">
            <p className="font-medium">{title}</p>
            <p className="truncate text-sm text-muted-foreground">{summary}</p>
          </div>
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
        </summary>
        <CardContent className="border-t pt-4">{children}</CardContent>
      </details>
    </Card>
  );
}
