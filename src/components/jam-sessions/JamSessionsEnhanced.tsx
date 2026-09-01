import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { useJamSessions } from "@/hooks/useJamSessions";
import { useJamSessionBooking } from "@/hooks/useJamSessionBooking";
import { useJamSessionChallenges } from "@/hooks/useJamSessionChallenges";
import { JamSessionCard } from "./JamSessionCard";
import { JamSessionHistory } from "./JamSessionHistory";
import { JamSessionBookingDialog } from "./JamSessionBookingDialog";
import { JamSessionChat } from "./JamSessionChat";
import { JamCommentaryFeed } from "./JamCommentaryFeed";
import { JamVoiceChat } from "./JamVoiceChat";
import { JamOutcomeReportDialog } from "./JamOutcomeReportDialog";
import { JamSessionMoodMeter } from "./JamSessionMoodMeter";
import { JamSessionVenueTraits } from "./JamSessionVenueTraits";
import { JamSessionChallengeCard } from "./JamSessionChallengeCard";
import { JamSessionH1Workspace } from "./JamSessionH1Workspace";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Music4, Zap, Users, Play, Plus, CalendarDays, Clock, DollarSign, Target } from "lucide-react";
import { FMPageScaffold } from "@/components/fm/FMPageScaffold";

export const JamSessionsEnhanced = () => {
  const { profileId } = useActiveProfile();
  const { toast } = useToast();
  const {
    activeSessions,
    completedSessions,
    myOutcomes,
    isLoading,
    startSession,
    completeSession,
    cancelSession,
    isStarting,
    isCompleting,
    isCancelling,
    lastResults,
    clearResults,
  } = useJamSessions();

  const { joinJamSession, profile } = useJamSessionBooking();
  const { challenges } = useJamSessionChallenges();

  const [isBookingOpen, setIsBookingOpen] = useState(false);
  const [showResultsDialog, setShowResultsDialog] = useState(false);
  const [joiningSessionId, setJoiningSessionId] = useState<string | null>(null);

  useEffect(() => {
    if (lastResults) setShowResultsDialog(true);
  }, [lastResults]);

  const totalXpEarned = myOutcomes.reduce((sum, outcome) => sum + outcome.xp_earned, 0);
  const sessionsCompleted = myOutcomes.length;

  const isUserParticipant = (session: (typeof activeSessions)[number]) => {
    if (!profile?.id) return false;
    return session.host_id === profile.id || session.participant_ids?.includes(profile.id) || false;
  };

  const myCurrentSession = useMemo(
    () => activeSessions.find((session) => isUserParticipant(session)) ?? null,
    [activeSessions, profile?.id],
  );

  const handleJoinSession = async (sessionId: string, accessCode?: string) => {
    setJoiningSessionId(sessionId);
    try {
      await joinJamSession(sessionId, accessCode);
    } catch (error: unknown) {
      toast({
        title: "Unable to join session",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
    } finally {
      setJoiningSessionId(null);
    }
  };

  const currentIsH1 = Number(myCurrentSession?.engine_version || 1) >= 2;
  const currentIsActive = myCurrentSession?.status === "active";

  return (
    <FMPageScaffold
      title="Jam Sessions"
      subtitle="Book rehearsal rooms, assign session jobs, shape each slot, and keep progressing even while offline."
      icon={Music4}
      backTo="/hub/band-live"
      headerActions={
        <Button onClick={() => setIsBookingOpen(true)} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Book Session
        </Button>
      }
    >
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Play className="h-8 w-8 text-green-500" />
            <div>
              <p className="text-2xl font-bold">{activeSessions.length}</p>
              <p className="text-sm text-muted-foreground">Open Sessions</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Users className="h-8 w-8 text-blue-500" />
            <div>
              <p className="text-2xl font-bold">{sessionsCompleted}</p>
              <p className="text-sm text-muted-foreground">Sessions Completed</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Zap className="h-8 w-8 text-yellow-500" />
            <div>
              <p className="text-2xl font-bold">{totalXpEarned}</p>
              <p className="text-sm text-muted-foreground">Total XP Earned</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <CalendarDays className="h-8 w-8 text-purple-500" />
            <div>
              <p className="text-2xl font-bold">{completedSessions.length}</p>
              <p className="text-sm text-muted-foreground">World Completed</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {myCurrentSession && currentIsH1 && (
        <JamSessionH1Workspace sessionId={myCurrentSession.id} />
      )}

      {myCurrentSession && currentIsActive && currentIsH1 && (
        <Card className="border-primary/20">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-green-500 animate-pulse" />
                  Session room
                </CardTitle>
                <CardDescription>
                  Chat and voice remain live while the authoritative slot engine runs independently.
                </CardDescription>
              </div>
              <Badge>LIVE</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <JamVoiceChat sessionId={myCurrentSession.id} />
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="h-[400px]">
                <JamSessionChat sessionId={myCurrentSession.id} sessionName={myCurrentSession.name} />
              </div>
              <div className="h-[400px]">
                <JamCommentaryFeed sessionId={myCurrentSession.id} isActive />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {myCurrentSession && currentIsActive && !currentIsH1 && (
        <Card className="border-2 border-primary/30">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-green-500 animate-pulse" />
                Legacy Jam Session
              </CardTitle>
              <Badge>LIVE</Badge>
            </div>
            <CardDescription>This older session is displayed with the legacy presentation.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <JamSessionMoodMeter mood={myCurrentSession.mood_score || 50} synergy={myCurrentSession.synergy_score || 50} />
              <div className="space-y-3">
                <JamSessionVenueTraits venueTrait={myCurrentSession.venue_trait} />
                {myCurrentSession.challenge_id && challenges
                  .filter((challenge) => challenge.id === myCurrentSession.challenge_id)
                  .map((challenge) => (
                    <JamSessionChallengeCard
                      key={challenge.id}
                      challenge={challenge}
                      isActive
                      isCompleted={myCurrentSession.challenge_completed}
                    />
                  ))}
              </div>
            </div>
            <JamVoiceChat sessionId={myCurrentSession.id} />
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="h-[400px]"><JamSessionChat sessionId={myCurrentSession.id} sessionName={myCurrentSession.name} /></div>
              <div className="h-[400px]"><JamCommentaryFeed sessionId={myCurrentSession.id} isActive /></div>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="lobby" className="space-y-4">
        <TabsList>
          <TabsTrigger value="lobby">Session Lobby</TabsTrigger>
          <TabsTrigger value="challenges" className="gap-1">
            <Target className="h-3 w-3" /> Challenges
          </TabsTrigger>
          <TabsTrigger value="history">My History</TabsTrigger>
        </TabsList>

        <TabsContent value="lobby" className="space-y-4">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : activeSessions.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <Music4 className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                <h3 className="text-lg font-semibold">No open sessions</h3>
                <p className="text-muted-foreground mb-4">Book a rehearsal room and start jamming.</p>
                <Button onClick={() => setIsBookingOpen(true)}>
                  <CalendarDays className="mr-2 h-4 w-4" />
                  Book a Session
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {activeSessions.map((session) => {
                const isHost = session.host_id === profile?.id;
                const isParticipant = isUserParticipant(session);

                return (
                  <Card key={session.id} className="relative">
                    <JamSessionCard
                      session={session}
                      isHost={isHost}
                      isParticipant={isParticipant}
                      onJoin={(accessCode) => handleJoinSession(session.id, accessCode)}
                      onStart={() => startSession(session.id)}
                      onComplete={() => completeSession({ sessionId: session.id, participants: session.participant_ids || [] })}
                      onCancel={() => cancelSession(session.id)}
                      isJoining={joiningSessionId === session.id}
                      isStarting={isStarting}
                      isCompleting={isCompleting}
                      isCancelling={isCancelling}
                    />

                    {session.scheduled_start && (
                      <div className="px-4 pb-4 flex flex-wrap gap-2 text-xs text-muted-foreground border-t pt-3 mt-2">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {new Date(session.scheduled_start).toLocaleString()}
                        </span>
                        {session.duration_hours && <span>• {session.duration_hours}h duration</span>}
                        {Number(session.cost_per_participant || 0) > 0 && (
                          <span className="flex items-center gap-1">
                            <DollarSign className="h-3 w-3" />
                            ${Number(session.cost_per_participant).toLocaleString()}/person contribution
                          </span>
                        )}
                      </div>
                    )}
                    {session.venue_trait && (
                      <div className="px-4 pb-3">
                        <JamSessionVenueTraits venueTrait={session.venue_trait} />
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="challenges" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Target className="h-5 w-5" /> Session Challenges
              </CardTitle>
              <CardDescription>
                Hosts can attach an eligible challenge during pre-jam setup. Completion is resolved from the final server-side slot results.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {challenges.map((challenge) => <JamSessionChallengeCard key={challenge.id} challenge={challenge} />)}
              </div>
              {challenges.length === 0 && (
                <p className="text-center text-muted-foreground py-8">No challenges available right now.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <JamSessionHistory outcomes={myOutcomes} />
        </TabsContent>
      </Tabs>

      <JamSessionBookingDialog
        open={isBookingOpen}
        onOpenChange={setIsBookingOpen}
        onSuccess={() => {
          toast({ title: "Session booked!", description: "Your jam session has been scheduled." });
        }}
      />

      <JamOutcomeReportDialog
        open={showResultsDialog}
        onOpenChange={(open) => {
          setShowResultsDialog(open);
          if (!open) clearResults();
        }}
        results={lastResults}
      />
    </FMPageScaffold>
  );
};

export default JamSessionsEnhanced;
