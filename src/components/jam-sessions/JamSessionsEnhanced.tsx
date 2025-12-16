import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/hooks/use-auth-context";
import { useJamSessions } from "@/hooks/useJamSessions";
import { JamSessionCard } from "./JamSessionCard";
import { JamSessionHistory } from "./JamSessionHistory";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Music4, Zap, Users, Play } from "lucide-react";
import { MUSIC_GENRES } from "@/data/genres";

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
  } = useJamSessions();

  const [formState, setFormState] = useState({
    name: "",
    description: "",
    genre: "",
    tempo: 120,
    maxParticipants: 4,
    skillRequirement: 0,
    isPrivate: false,
    accessCode: "",
  });
  const [isCreating, setIsCreating] = useState(false);
  const [joiningSessionId, setJoiningSessionId] = useState<string | null>(null);
  const [joinAccessCodes, setJoinAccessCodes] = useState<Record<string, string>>({});

  const handleCreateSession = async () => {
    if (!user?.id) {
      toast({ title: "Sign in required", variant: "destructive" });
      return;
    }

    if (!formState.name || !formState.genre) {
      toast({ title: "Please provide session name and genre" });
      return;
    }

    setIsCreating(true);

    // Get profile ID
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      toast({ title: "Profile not found", variant: "destructive" });
      setIsCreating(false);
      return;
    }

    const { error } = await supabase.from("jam_sessions").insert({
      host_id: profile.id,
      name: formState.name.trim(),
      description: formState.description.trim() || null,
      genre: formState.genre,
      tempo: formState.tempo,
      max_participants: formState.maxParticipants,
      skill_requirement: formState.skillRequirement,
      is_private: formState.isPrivate,
      access_code: formState.isPrivate ? formState.accessCode.trim() : null,
      status: "waiting",
    });

    if (error) {
      toast({ title: "Failed to create session", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Jam session created!" });
      setFormState({
        name: "",
        description: "",
        genre: "",
        tempo: 120,
        maxParticipants: 4,
        skillRequirement: 0,
        isPrivate: false,
        accessCode: "",
      });
    }
    setIsCreating(false);
  };

  const handleJoinSession = async (sessionId: string, isPrivate: boolean, accessCode: string | null) => {
    if (!user?.id) return;

    if (isPrivate) {
      const codeAttempt = joinAccessCodes[sessionId]?.trim();
      if (!codeAttempt || codeAttempt !== accessCode) {
        toast({ title: "Incorrect access code", variant: "destructive" });
        return;
      }
    }

    setJoiningSessionId(sessionId);
    const { error } = await (supabase.rpc as any)("join_jam_session", { p_session_id: sessionId });
    
    if (error) {
      toast({ title: "Failed to join session", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Joined session!" });
    }
    setJoiningSessionId(null);
  };

  const totalXpEarned = myOutcomes.reduce((sum, o) => sum + o.xp_earned, 0);
  const sessionsCompleted = myOutcomes.length;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Music4 className="h-8 w-8" /> Jam Sessions
        </h1>
        <p className="text-muted-foreground">
          Collaborate with other musicians, build chemistry, and earn XP rewards.
        </p>
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
            <Music4 className="h-8 w-8 text-purple-500" />
            <div>
              <p className="text-2xl font-bold">{completedSessions.length}</p>
              <p className="text-sm text-muted-foreground">All Completed</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="lobby" className="space-y-4">
        <TabsList>
          <TabsTrigger value="lobby">Session Lobby</TabsTrigger>
          <TabsTrigger value="create">Create Session</TabsTrigger>
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
                <p className="text-muted-foreground mb-4">Be the first to start a jam!</p>
                <Button onClick={() => document.querySelector('[value="create"]')?.dispatchEvent(new Event('click'))}>
                  Create Session
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {activeSessions.map((session) => {
                const isHost = session.host?.user_id === user?.id;
                const isParticipant = session.participant_ids?.includes(user?.id || "");
                
                return (
                  <JamSessionCard
                    key={session.id}
                    session={session}
                    isHost={isHost}
                    isParticipant={isParticipant || isHost}
                    onJoin={() => handleJoinSession(session.id, session.is_private, session.access_code)}
                    onStart={() => startSession(session.id)}
                    onComplete={() => completeSession({ sessionId: session.id, participants: session.participant_ids || [] })}
                    isJoining={joiningSessionId === session.id}
                    isStarting={isStarting}
                    isCompleting={isCompleting}
                  />
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="create">
          <Card>
            <CardHeader>
              <CardTitle>Create a Jam Session</CardTitle>
              <CardDescription>Set up a session and invite musicians to collaborate</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Session Name</Label>
                  <Input
                    placeholder="Late Night Groove"
                    value={formState.name}
                    onChange={(e) => setFormState(prev => ({ ...prev, name: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Genre</Label>
                  <Select value={formState.genre} onValueChange={(v) => setFormState(prev => ({ ...prev, genre: v }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select genre" />
                    </SelectTrigger>
                    <SelectContent>
                      {MUSIC_GENRES.map(g => (
                        <SelectItem key={g} value={g}>{g}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  placeholder="Share your vision for this jam..."
                  value={formState.description}
                  onChange={(e) => setFormState(prev => ({ ...prev, description: e.target.value }))}
                  rows={3}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>Tempo (BPM)</Label>
                  <Input
                    type="number"
                    min={40}
                    max={240}
                    value={formState.tempo}
                    onChange={(e) => setFormState(prev => ({ ...prev, tempo: Number(e.target.value) }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Max Participants</Label>
                  <Input
                    type="number"
                    min={2}
                    max={8}
                    value={formState.maxParticipants}
                    onChange={(e) => setFormState(prev => ({ ...prev, maxParticipants: Number(e.target.value) }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Skill Requirement</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={formState.skillRequirement}
                    onChange={(e) => setFormState(prev => ({ ...prev, skillRequirement: Number(e.target.value) }))}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <Label>Private Session</Label>
                  <p className="text-sm text-muted-foreground">Require access code to join</p>
                </div>
                <Switch
                  checked={formState.isPrivate}
                  onCheckedChange={(v) => setFormState(prev => ({ ...prev, isPrivate: v }))}
                />
              </div>

              {formState.isPrivate && (
                <div className="space-y-2">
                  <Label>Access Code</Label>
                  <Input
                    placeholder="e.g. GROOVE2025"
                    value={formState.accessCode}
                    onChange={(e) => setFormState(prev => ({ ...prev, accessCode: e.target.value }))}
                  />
                </div>
              )}

              <Button onClick={handleCreateSession} disabled={isCreating} className="w-full">
                {isCreating ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating...</> : "Launch Jam Session"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <JamSessionHistory outcomes={myOutcomes} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default JamSessionsEnhanced;
