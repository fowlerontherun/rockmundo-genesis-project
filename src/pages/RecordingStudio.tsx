import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RecordingWizard } from "@/components/recording/RecordingWizard";
import { CompleteRecordingDialog } from "@/components/recording/CompleteRecordingDialog";
import { RecordedSongsTab } from "@/components/recording/RecordedSongsTab";
import { useRecordingSessions } from "@/hooks/useRecordingData";
import { useCancelRecordingSession } from "@/hooks/useCancelRecordingSession";
import { useAuth } from "@/hooks/use-auth-context";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { useGameData } from "@/hooks/useGameData";
import { useTranslation } from "@/hooks/useTranslation";
import { Music, Plus, Clock, CheckCircle2, X, AlertCircle, Disc3, ListMusic, CalendarClock, RotateCcw, Trash2 } from "lucide-react";
import { FMPageScaffold } from "@/components/fm/FMPageScaffold";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { resolveActiveBandMembership } from "@/utils/activeBandMembership";

export default function RecordingStudio() {
  const { session } = useAuth();
  const { profileId } = useActiveProfile();
  const { currentCity } = useGameData();
  const { t } = useTranslation();
  const [wizardOpen, setWizardOpen] = useState(false);
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false);
  const [selectedSession, setSelectedSession] = useState<any>(null);
  const [userBandId, setUserBandId] = useState<string | null>(null);
  const [labelCompanyId, setLabelCompanyId] = useState<string | null>(null);
  const [bookingActionSessionId, setBookingActionSessionId] = useState<string | null>(null);
  const cancelRecording = useCancelRecordingSession();
  
  const currentCityId = currentCity?.id || "";
  
  const { data: sessions, isLoading, error: sessionsError } = useRecordingSessions(profileId || null, session?.user?.id || null);

  useEffect(() => {
    const loadUserBand = async () => {
      if (!session?.user?.id) return;

      const bandMemberships = await resolveActiveBandMembership(
        profileId,
        session.user.id,
      );

      if (bandMemberships?.band_id) {
        setUserBandId(bandMemberships.band_id);
        
        const { data: contract } = await supabase
          .from('artist_label_contracts')
          .select('labels(company_id)')
          .eq('band_id', bandMemberships.band_id)
          .eq('status', 'active')
          .limit(1)
          .maybeSingle();
        
        setLabelCompanyId((contract as any)?.labels?.company_id ?? null);
      } else {
        setUserBandId(null);
        setLabelCompanyId(null);
      }
    };

    loadUserBand();
  }, [session?.user?.id, profileId]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'in_progress':
        return <Clock className="h-4 w-4 text-blue-500 animate-pulse" />;
      case 'cancelled':
        return <X className="h-4 w-4 text-red-500" />;
      case 'failed':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="default">{t('common.completed')}</Badge>;
      case 'in_progress':
        return <Badge variant="secondary">{t('gigs.inProgress')}</Badge>;
      case 'cancelled':
        return <Badge variant="destructive">{t('gigs.cancelled')}</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
      default:
        return <Badge variant="outline">{t('gigs.scheduled')}</Badge>;
    }
  };

  const canChangeBooking = (recordingSession: any) =>
    recordingSession?.status === 'scheduled' &&
    !!recordingSession?.scheduled_start &&
    new Date(recordingSession.scheduled_start) > new Date();

  const handleBookingAction = async (recordingSession: any, mode: 'cancel' | 'reschedule') => {
    if (!canChangeBooking(recordingSession) || bookingActionSessionId) return;

    const songTitle = recordingSession.songs?.title || 'this recording session';
    const confirmed = window.confirm(
      mode === 'reschedule'
        ? `Reschedule “${songTitle}”? The existing booking will be cancelled and refunded, then you can choose a new studio date and time.`
        : `Cancel “${songTitle}”? The studio slot will be released, diary blocks removed and the original payment source refunded.`,
    );
    if (!confirmed) return;

    setBookingActionSessionId(recordingSession.id);
    try {
      await cancelRecording.mutateAsync({
        sessionId: recordingSession.id,
        reason: mode === 'reschedule' ? 'rescheduled_by_player' : 'cancelled_by_player',
      });

      if (mode === 'reschedule') {
        setWizardOpen(true);
      }
    } finally {
      setBookingActionSessionId(null);
    }
  };

  const renderBookingActions = (recordingSession: any) => {
    if (!canChangeBooking(recordingSession)) return null;
    const isWorking = bookingActionSessionId === recordingSession.id && cancelRecording.isPending;

    return (
      <div className="flex flex-wrap justify-end gap-2 pt-2">
        <Button
          size="sm"
          variant="outline"
          disabled={isWorking || !!bookingActionSessionId}
          onClick={() => void handleBookingAction(recordingSession, 'reschedule')}
        >
          <RotateCcw className="h-4 w-4 mr-1" />
          {isWorking ? 'Updating…' : 'Reschedule'}
        </Button>
        <Button
          size="sm"
          variant="destructive"
          disabled={isWorking || !!bookingActionSessionId}
          onClick={() => void handleBookingAction(recordingSession, 'cancel')}
        >
          <Trash2 className="h-4 w-4 mr-1" />
          {isWorking ? 'Cancelling…' : 'Cancel'}
        </Button>
      </div>
    );
  };

  return (
    <FMPageScaffold
      title={t('recording.title')}
      subtitle={t('recording.recordingProgress', 'Record your songs with professional producers and studios')}
      icon={Music}
      backTo="/hub/music"
      backLabel="Back to Music Hub"
      headerActions={
        <Button onClick={() => setWizardOpen(true)} size="default" className="w-full sm:w-auto flex-shrink-0">
          <Plus className="h-5 w-5 mr-2" />
          {t('recording.startSession', 'New Recording')}
        </Button>
      }
    >

      {!currentCityId && (
        <Card className="bg-yellow-500/10 border-yellow-500/20">
          <CardContent className="pt-6 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
            <p className="text-yellow-600 dark:text-yellow-400">
              {t('travel.currentLocation', 'You need to set your current city first.')}{" "}
              <Link to="/travel" className="underline font-medium">
                {t('travel.title')}
              </Link>{" "}
              {t('recording.selectStudio', 'to access recording studios.')}
            </p>
          </CardContent>
        </Card>
      )}

      {(() => {
        const now = new Date();
        const upcomingSessions = (sessions || []).filter((s: any) => {
          if (s.status !== 'scheduled' && s.status !== 'in_progress') return false;
          const end = s.scheduled_end ? new Date(s.scheduled_end) : null;
          return !end || end > now;
        }).sort((a: any, b: any) =>
          new Date(a.scheduled_start).getTime() - new Date(b.scheduled_start).getTime()
        );

        return (
      <Tabs defaultValue="sessions" className="space-y-6">
        <TabsList>
          <TabsTrigger value="sessions" className="gap-2">
            <ListMusic className="h-4 w-4" />
            <span className="hidden sm:inline">{t('recording.currentSession', 'Sessions')}</span>
          </TabsTrigger>
          <TabsTrigger value="upcoming" className="gap-2">
            <CalendarClock className="h-4 w-4" />
            <span className="hidden sm:inline">Upcoming</span>
            {upcomingSessions.length > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                {upcomingSessions.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="recorded" className="gap-2">
            <Disc3 className="h-4 w-4" />
            <span className="hidden sm:inline">{t('recording.recordedSongs')}</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="sessions">
          <Card>
            <CardHeader>
              <CardTitle>{t('recording.currentSession', 'Recording Sessions')}</CardTitle>
              <CardDescription>
                {t('recording.recordingHistory', 'Track your current and past recording sessions')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-8 text-muted-foreground">
                  {t('common.loading')}
                </div>
              ) : sessionsError ? (
                <div className="text-center py-12 space-y-2 text-destructive">
                  <AlertCircle className="h-12 w-12 mx-auto" />
                  <p className="font-medium">Unable to load recording sessions</p>
                  <p className="text-sm text-muted-foreground">{sessionsError instanceof Error ? sessionsError.message : 'Please try again.'}</p>
                </div>
              ) : !sessions || sessions.length === 0 ? (
                <div className="text-center py-12 space-y-4">
                  <Music className="h-12 w-12 text-muted-foreground mx-auto" />
                  <div>
                    <p className="text-muted-foreground font-medium">{t('common.noResults', 'No recording sessions yet')}</p>
                    <p className="text-sm text-muted-foreground mt-2">
                      {t('recording.selectSong', 'Start by creating songs in the')}{" "}
                      <Link to="/songwriting" className="text-primary underline font-medium">
                        {t('nav.songwriting')}
                      </Link>{" "}
                      {t('recording.selectSong', 'section, then come back here to record them professionally.')}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {sessions.map((recordingSession: any) => (
                    <Card key={recordingSession.id}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                              {getStatusIcon(recordingSession.status)}
                              <h3 className="font-semibold truncate">
                                {recordingSession.songs?.title || 'Unknown Song'}
                              </h3>
                              {getStatusBadge(recordingSession.status)}
                            </div>
                            
                            <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                              <div>{t('recording.selectStudio', 'Studio')}: {recordingSession.city_studios?.name || 'N/A'}</div>
                              <div>{t('recording.selectSong', 'Producer')}: {recordingSession.recording_producers?.name || 'N/A'}</div>
                              <div>{t('recording.duration')}: {recordingSession.duration_hours} {t('time.hours')}</div>
                              <div>{t('releases.cost')}: ${Number(recordingSession.total_cost || 0).toLocaleString()}</div>
                            </div>

                            {recordingSession.status === 'completed' && recordingSession.quality_improvement > 0 && (
                              <div className="mt-2 text-sm">
                                <span className="text-muted-foreground">{t('recording.qualityBoost')}: </span>
                                <span className="font-semibold text-green-600">
                                  +{recordingSession.quality_improvement}
                                </span>
                              </div>
                            )}

                            {recordingSession.status === 'failed' && (
                              <div className="mt-2 text-sm text-red-500">
                                <AlertCircle className="h-3 w-3 inline mr-1" />
                                {(recordingSession as any).session_data?.failure_reason || 'Band members were not in the studio city'}
                              </div>
                            )}
                          </div>

                          <div className="flex flex-col items-end gap-2">
                            <div className="text-sm text-muted-foreground text-right">
                              {recordingSession.completed_at ? (
                                <div>{t('common.completed')} {formatDistanceToNow(new Date(recordingSession.completed_at))} {t('time.ago')}</div>
                              ) : recordingSession.status === 'in_progress' ? (
                                <div>{t('recording.endSession', 'Ends')} {formatDistanceToNow(new Date(recordingSession.scheduled_end))}</div>
                              ) : recordingSession.status === 'scheduled' && recordingSession.scheduled_start ? (
                                <div>Starts in {formatDistanceToNow(new Date(recordingSession.scheduled_start))}</div>
                              ) : (
                                <div>{t('common.create', 'Created')} {formatDistanceToNow(new Date(recordingSession.created_at))} {t('time.ago')}</div>
                              )}
                            </div>
                            {renderBookingActions(recordingSession)}
                            {recordingSession.status === 'in_progress' && new Date(recordingSession.scheduled_end) <= new Date() && (
                              <Button
                                size="sm"
                                onClick={() => {
                                  setSelectedSession(recordingSession);
                                  setCompleteDialogOpen(true);
                                }}
                              >
                                <CheckCircle2 className="h-4 w-4 mr-1" />
                                {t('recording.finalizeRecording', 'Complete')}
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="upcoming">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarClock className="h-5 w-5 text-primary" />
                Upcoming Recording Sessions
              </CardTitle>
              <CardDescription>
                Manage future bookings or view sessions already in progress
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-8 text-muted-foreground">{t('common.loading')}</div>
              ) : sessionsError ? (
                <div className="text-center py-12 space-y-2 text-destructive">
                  <AlertCircle className="h-12 w-12 mx-auto" />
                  <p className="font-medium">Unable to load upcoming sessions</p>
                  <p className="text-sm text-muted-foreground">{sessionsError instanceof Error ? sessionsError.message : 'Please try again.'}</p>
                </div>
              ) : upcomingSessions.length === 0 ? (
                <div className="text-center py-12 space-y-2">
                  <CalendarClock className="h-12 w-12 text-muted-foreground mx-auto" />
                  <p className="text-muted-foreground font-medium">No upcoming sessions booked</p>
                  <p className="text-sm text-muted-foreground">
                    Book a new session to see it appear here.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {upcomingSessions.map((recordingSession: any) => (
                    <Card key={recordingSession.id} className="border-primary/30">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-4 flex-wrap">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                              {getStatusIcon(recordingSession.status)}
                              <h3 className="font-semibold truncate">{recordingSession.songs?.title || 'Unknown Song'}</h3>
                              {getStatusBadge(recordingSession.status)}
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                              <div>Studio: {recordingSession.city_studios?.name || 'N/A'}</div>
                              <div>Producer: {recordingSession.recording_producers?.name || 'Self-produced'}</div>
                              <div>Duration: {recordingSession.duration_hours}h</div>
                              <div>Cost: ${Number(recordingSession.total_cost || 0).toLocaleString()}</div>
                            </div>
                          </div>
                          <div className="text-right text-sm min-w-[190px]">
                            <div className="text-xs uppercase text-muted-foreground">
                              {recordingSession.status === 'in_progress' ? 'Ends' : 'Starts'}
                            </div>
                            <div className="font-semibold">
                              {new Date(recordingSession.status === 'in_progress' ? recordingSession.scheduled_end : recordingSession.scheduled_start).toLocaleString()}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              in {formatDistanceToNow(new Date(recordingSession.status === 'in_progress' ? recordingSession.scheduled_end : recordingSession.scheduled_start))}
                            </div>
                            {renderBookingActions(recordingSession)}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recorded">
          <Card>
            <CardHeader>
              <CardTitle>{t('recording.recordedSongs')}</CardTitle>
              <CardDescription>
                {t('recording.recordingHistory', 'View all your recorded songs and their versions')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RecordedSongsTab userId={session?.user?.id || ""} profileId={profileId} bandId={userBandId} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
        );
      })()}

      <RecordingWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        userId={session?.user?.id || ""}
        profileId={profileId}
        currentCityId={currentCityId}
        bandId={userBandId}
        labelCompanyId={labelCompanyId}
      />

      {selectedSession && (
        <CompleteRecordingDialog
          open={completeDialogOpen}
          onOpenChange={setCompleteDialogOpen}
          sessionId={selectedSession.id}
          songTitle={selectedSession.songs?.title || "Unknown Song"}
        />
      )}
    </FMPageScaffold>
  );
}
