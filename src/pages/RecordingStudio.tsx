import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RecordingWizard } from "@/components/recording/RecordingWizard";
import { CompleteRecordingDialog } from "@/components/recording/CompleteRecordingDialog";
import { RecordedSongsTab } from "@/components/recording/RecordedSongsTab";
import { useRecordingSessions } from "@/hooks/useRecordingData";
import { useAuth } from "@/hooks/use-auth-context";
import { useGameData } from "@/hooks/useGameData";
import { useTranslation } from "@/hooks/useTranslation";
import { Music, Plus, Clock, CheckCircle2, X, AlertCircle, Disc3, ListMusic } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { supabase } from "@/integrations/supabase/client";

export default function RecordingStudio() {
  const { session } = useAuth();
  const { currentCity } = useGameData();
  const { t } = useTranslation();
  const [wizardOpen, setWizardOpen] = useState(false);
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false);
  const [selectedSession, setSelectedSession] = useState<any>(null);
  const [userBandId, setUserBandId] = useState<string | null>(null);
  const [labelCompanyId, setLabelCompanyId] = useState<string | null>(null);
  
  const currentCityId = currentCity?.id || "";
  
  const { data: sessions, isLoading } = useRecordingSessions(session?.user?.id || "");

  useEffect(() => {
    const loadUserBand = async () => {
      if (!session?.user?.id) return;

      const { data: bandMemberships, error } = await supabase
        .from('band_members')
        .select('band_id, bands!band_members_band_id_fkey(id, name, status, band_balance)')
        .eq('user_id', session.user.id)
        .eq('is_touring_member', false)
        .eq('bands.status', 'active')
        .limit(1)
        .maybeSingle();

      if (bandMemberships?.band_id) {
        setUserBandId(bandMemberships.band_id);
        
        // Check for active label contract to get label's company_id
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
  }, [session?.user?.id]);

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

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold flex items-center gap-3">
            <Music className="h-8 w-8 text-primary" />
            {t('recording.title')}
          </h1>
          <p className="text-muted-foreground mt-2">
            {t('recording.recordingProgress', 'Record your songs with professional producers and studios')}
          </p>
        </div>
        <Button onClick={() => setWizardOpen(true)} size="lg">
          <Plus className="h-5 w-5 mr-2" />
          {t('recording.startSession', 'New Recording')}
        </Button>
      </div>

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

      <Tabs defaultValue="sessions" className="space-y-6">
        <TabsList>
          <TabsTrigger value="sessions" className="gap-2">
            <ListMusic className="h-4 w-4" />
            <span className="hidden sm:inline">{t('recording.currentSession', 'Sessions')}</span>
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
                  {sessions.map((session: any) => (
                    <Card key={session.id}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                              {getStatusIcon(session.status)}
                              <h3 className="font-semibold truncate">
                                {session.songs?.title || 'Unknown Song'}
                              </h3>
                              {getStatusBadge(session.status)}
                            </div>
                            
                            <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                              <div>{t('recording.selectStudio', 'Studio')}: {session.city_studios?.name || 'N/A'}</div>
                              <div>{t('recording.selectSong', 'Producer')}: {session.recording_producers?.name || 'N/A'}</div>
                              <div>{t('recording.duration')}: {session.duration_hours} {t('time.hours')}</div>
                              <div>{t('releases.cost')}: ${session.total_cost.toLocaleString()}</div>
                            </div>

                            {session.status === 'completed' && session.quality_improvement > 0 && (
                              <div className="mt-2 text-sm">
                                <span className="text-muted-foreground">{t('recording.qualityBoost')}: </span>
                                <span className="font-semibold text-green-600">
                                  +{session.quality_improvement}
                                </span>
                              </div>
                            )}

                            {session.status === 'failed' && (
                              <div className="mt-2 text-sm text-red-500">
                                <AlertCircle className="h-3 w-3 inline mr-1" />
                                {(session as any).session_data?.failure_reason || 'Band members were not in the studio city'}
                              </div>
                            )}
                          </div>

                          <div className="flex flex-col items-end gap-2">
                            <div className="text-sm text-muted-foreground">
                              {session.completed_at ? (
                                <div>{t('common.completed')} {formatDistanceToNow(new Date(session.completed_at))} {t('time.ago')}</div>
                              ) : session.status === 'in_progress' ? (
                                <div>{t('recording.endSession', 'Ends')} {formatDistanceToNow(new Date(session.scheduled_end))}</div>
                              ) : (
                                <div>{t('common.create', 'Created')} {formatDistanceToNow(new Date(session.created_at))} {t('time.ago')}</div>
                              )}
                            </div>
                            {session.status === 'in_progress' && new Date(session.scheduled_end) <= new Date() && (
                              <Button
                                size="sm"
                                onClick={() => {
                                  setSelectedSession(session);
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

        <TabsContent value="recorded">
          <Card>
            <CardHeader>
              <CardTitle>{t('recording.recordedSongs')}</CardTitle>
              <CardDescription>
                {t('recording.recordingHistory', 'View all your recorded songs and their versions')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RecordedSongsTab userId={session?.user?.id || ""} bandId={userBandId} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <RecordingWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        userId={session?.user?.id || ""}
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
    </div>
  );
}
