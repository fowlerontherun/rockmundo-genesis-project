import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { RecordingWizard } from "@/components/recording/RecordingWizard";
import { CompleteRecordingDialog } from "@/components/recording/CompleteRecordingDialog";
import { useRecordingSessions } from "@/hooks/useRecordingData";
import { useAuth } from "@/hooks/use-auth-context";
import { useGameData } from "@/hooks/useGameData";
import { Music, Plus, Clock, CheckCircle2, X, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { supabase } from "@/integrations/supabase/client";

export default function RecordingStudio() {
  const { session } = useAuth();
  const { currentCity } = useGameData();
  const [wizardOpen, setWizardOpen] = useState(false);
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false);
  const [selectedSession, setSelectedSession] = useState<any>(null);
  const [userBandId, setUserBandId] = useState<string | null>(null);
  
  const currentCityId = currentCity?.id || "";
  
  const { data: sessions, isLoading } = useRecordingSessions(session?.user?.id || "");

  useEffect(() => {
    const loadUserBand = async () => {
      if (!session?.user?.id) return;

      // Get user's active band (not on hiatus, not inactive)
      const { data: bandMemberships, error } = await supabase
        .from('band_members')
        .select('band_id, bands!inner(id, name, status)')
        .eq('user_id', session.user.id)
        .eq('is_touring_member', false)
        .eq('bands.status', 'active')
        .limit(1)
        .maybeSingle();

      console.log('🎸 Loading user band:', { bandMemberships, error, userId: session.user.id });

      if (bandMemberships?.band_id) {
        console.log('✅ Setting band ID:', bandMemberships.band_id);
        setUserBandId(bandMemberships.band_id);
      } else {
        console.log('❌ No active band found');
        setUserBandId(null);
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
      default:
        return <Clock className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="default">Completed</Badge>;
      case 'in_progress':
        return <Badge variant="secondary">In Progress</Badge>;
      case 'cancelled':
        return <Badge variant="destructive">Cancelled</Badge>;
      default:
        return <Badge variant="outline">Scheduled</Badge>;
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold flex items-center gap-3">
            <Music className="h-8 w-8 text-primary" />
            Recording Studio
          </h1>
          <p className="text-muted-foreground mt-2">
            Record your songs with professional producers and studios
          </p>
        </div>
        <Button onClick={() => {
          console.log('🎬 Opening recording wizard with:', { userBandId, userId: session?.user?.id });
          setWizardOpen(true);
        }} size="lg">
          <Plus className="h-5 w-5 mr-2" />
          New Recording
        </Button>
      </div>

      {!currentCityId && (
        <Card className="bg-yellow-500/10 border-yellow-500/20">
          <CardContent className="pt-6 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
            <p className="text-yellow-600 dark:text-yellow-400">
              You need to set your current city first.{" "}
              <Link to="/travel" className="underline font-medium">
                Travel to a city
              </Link>{" "}
              to access recording studios.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Recording Sessions</CardTitle>
            <CardDescription>
              Track your current and past recording sessions
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                Loading sessions...
              </div>
            ) : !sessions || sessions.length === 0 ? (
              <div className="text-center py-12 space-y-4">
                <Music className="h-12 w-12 text-muted-foreground mx-auto" />
                <div>
                  <p className="text-muted-foreground font-medium">No recording sessions yet</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Start by creating songs in the{" "}
                    <Link to="/songwriting" className="text-primary underline font-medium">
                      Songwriting
                    </Link>{" "}
                    section, then come back here to record them professionally.
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
                            <div>Studio: {session.city_studios?.name || 'N/A'}</div>
                            <div>Producer: {session.recording_producers?.name || 'N/A'}</div>
                            <div>Duration: {session.duration_hours} hours</div>
                            <div>Cost: ${session.total_cost.toLocaleString()}</div>
                          </div>

                          {session.status === 'completed' && (
                            <div className="mt-2 text-sm">
                              <span className="text-muted-foreground">Quality: </span>
                              <span className="font-semibold">{session.quality_before}</span>
                              <span className="mx-2">→</span>
                              <span className="font-semibold text-primary">{session.quality_after}</span>
                              <span className="ml-2 text-green-600">
                                +{session.quality_improvement} (+{Math.round((session.quality_improvement / session.quality_before) * 100)}%)
                              </span>
                            </div>
                          )}
                        </div>

                        <div className="flex flex-col items-end gap-2">
                          <div className="text-sm text-muted-foreground">
                            {session.completed_at ? (
                              <div>Completed {formatDistanceToNow(new Date(session.completed_at))} ago</div>
                            ) : session.status === 'in_progress' ? (
                              <div>Ends {formatDistanceToNow(new Date(session.scheduled_end))}</div>
                            ) : (
                              <div>Created {formatDistanceToNow(new Date(session.created_at))} ago</div>
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
                              Complete
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
      </div>

      <RecordingWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        userId={session?.user?.id || ""}
        currentCityId={currentCityId}
        bandId={userBandId}
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
