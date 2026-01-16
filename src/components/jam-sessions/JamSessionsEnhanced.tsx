import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/use-auth-context";
import { useJamSessions } from "@/hooks/useJamSessions";
import { useJamSessionBooking } from "@/hooks/useJamSessionBooking";
import { JamSessionCard } from "./JamSessionCard";
import { JamSessionHistory } from "./JamSessionHistory";
import { JamSessionBookingDialog } from "./JamSessionBookingDialog";
import { JamSessionChat } from "./JamSessionChat";
import { JamCommentaryFeed } from "./JamCommentaryFeed";
import { JamVoiceChat } from "./JamVoiceChat";
import { JamOutcomeReportDialog } from "./JamOutcomeReportDialog";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Music4, Zap, Users, Play, Plus, CalendarDays, Clock, DollarSign } from "lucide-react";

export const JamSessionsEnhanced = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const {
    sessions,
    activeSessions,
    completedSessions,
    myOutcomes,
    isLoading,
    startSession,
    completeSession,
    isStarting,
    isCompleting,
    lastResults,
    clearResults,
  } = useJamSessions();
  
  const { joinJamSession, profile } = useJamSessionBooking();

  const [isBookingOpen, setIsBookingOpen] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [showResultsDialog, setShowResultsDialog] = useState(false);
  const [joiningSessionId, setJoiningSessionId] = useState<string | null>(null);

  // Find user's active session for chat/commentary
  useEffect(() => {
    if (!user?.id || !profile?.id) return;
    
    const myActiveSession = activeSessions.find(s => 
      s.status === 'active' && 
      (s.host_id === profile.id || s.participant_ids?.includes(profile.id))
    );
    
    if (myActiveSession) {
      setActiveSessionId(myActiveSession.id);
    } else {
      setActiveSessionId(null);
    }
  }, [activeSessions, user?.id, profile?.id]);

  // Show results dialog when session completes
  useEffect(() => {
    if (lastResults) {
      setShowResultsDialog(true);
    }
  }, [lastResults]);

  const totalXpEarned = myOutcomes.reduce((sum, o) => sum + o.xp_earned, 0);
  const sessionsCompleted = myOutcomes.length;

  const handleJoinSession = async (sessionId: string) => {
    setJoiningSessionId(sessionId);
    try {
      await joinJamSession(sessionId);
      toast({
        title: "Joined session!",
        description: "You're now part of this jam session.",
      });
    } catch (error: any) {
      toast({
        title: "Unable to join session",
        description: error.message || "An error occurred",
        variant: "destructive",
      });
    } finally {
      setJoiningSessionId(null);
    }
  };

  // Check if user is a participant of a session
  const isUserParticipant = (session: any) => {
    if (!profile?.id) return false;
    return session.host_id === profile.id || session.participant_ids?.includes(profile.id);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Music4 className="h-8 w-8" /> Jam Sessions
          </h1>
          <p className="text-muted-foreground">
            Book rehearsal rooms, collaborate with musicians, and earn XP rewards.
          </p>
        </div>
        <Button onClick={() => setIsBookingOpen(true)} size="lg">
          <Plus className="h-5 w-5 mr-2" />
          Book Session
        </Button>
      </div>

      {/* Stats Overview */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Play className="h-8 w-8 text-green-500" />
            <div>
              <p className="text-2xl font-bold">{activeSessions.length}</p>
              <p className="text-sm text-muted-foreground">Active Sessions</p>
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
              <p className="text-sm text-muted-foreground">All Completed</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Active Session Panel with Chat & Commentary */}
      {activeSessionId && (
        <Card className="border-2 border-primary/30">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                Active Jam Session
              </CardTitle>
              <Badge variant="default" className="bg-green-500">LIVE</Badge>
            </div>
            <CardDescription>
              You're currently in a jam session. Chat with other musicians and watch the live commentary!
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Voice Chat */}
            <JamVoiceChat sessionId={activeSessionId} />
            
            {/* Chat & Commentary */}
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="h-[400px]">
                <JamSessionChat 
                  sessionId={activeSessionId} 
                  sessionName="Active Session" 
                />
              </div>
              <div className="h-[400px]">
                <JamCommentaryFeed 
                  sessionId={activeSessionId} 
                  isActive={true} 
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="lobby" className="space-y-4">
        <TabsList>
          <TabsTrigger value="lobby">Session Lobby</TabsTrigger>
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
                <h3 className="text-lg font-semibold">No active sessions</h3>
                <p className="text-muted-foreground mb-4">
                  Book a rehearsal room and start jamming!
                </p>
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
                      onJoin={() => handleJoinSession(session.id)}
                      onStart={() => startSession(session.id)}
                      onComplete={() => completeSession({ sessionId: session.id, participants: session.participant_ids || [] })}
                      isJoining={joiningSessionId === session.id}
                      isStarting={isStarting}
                      isCompleting={isCompleting}
                    />
                    
                    {/* Show session details - scheduled time, cost, etc. */}
                    {(session as any).scheduled_start && (
                      <div className="px-4 pb-4 flex flex-wrap gap-2 text-xs text-muted-foreground border-t pt-3 mt-2">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {new Date((session as any).scheduled_start).toLocaleString()}
                        </span>
                        {(session as any).duration_hours && (
                          <span>• {(session as any).duration_hours}h duration</span>
                        )}
                        {(session as any).cost_per_participant && (
                          <span className="flex items-center gap-1">
                            <DollarSign className="h-3 w-3" />
                            ${((session as any).cost_per_participant / 100).toFixed(2)}/person
                          </span>
                        )}
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="history">
          <JamSessionHistory outcomes={myOutcomes} />
        </TabsContent>
      </Tabs>

      {/* Booking Dialog */}
      <JamSessionBookingDialog
        open={isBookingOpen}
        onOpenChange={setIsBookingOpen}
        onSuccess={(sessionId) => {
          toast({
            title: "Session booked!",
            description: "Your jam session has been scheduled.",
          });
        }}
      />

      {/* Results Dialog */}
      <JamOutcomeReportDialog
        open={showResultsDialog}
        onOpenChange={(open) => {
          setShowResultsDialog(open);
          if (!open) clearResults();
        }}
        results={lastResults}
      />
    </div>
  );
};

export default JamSessionsEnhanced;
