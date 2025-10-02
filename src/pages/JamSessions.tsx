import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/hooks/use-auth-context";
import { useGameData } from "@/hooks/useGameData";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/lib/supabase-types";
import { Loader2, Lock, Music4 } from "lucide-react";

type JamSessionRow = Database["public"]["Tables"]["jam_sessions"]["Row"];

type JamSessionWithHost = JamSessionRow & {
  host?: {
    user_id: string;
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
};

interface FormState {
  name: string;
  description: string;
  genre: string;
  tempo: number;
  maxParticipants: number;
  skillRequirement: number;
  isPrivate: boolean;
  accessCode: string;
}

const DEFAULT_FORM_STATE: FormState = {
  name: "",
  description: "",
  genre: "",
  tempo: 120,
  maxParticipants: 4,
  skillRequirement: 0,
  isPrivate: false,
  accessCode: "",
};

const GENRE_OPTIONS = [
  "Rock",
  "Pop",
  "Metal",
  "Jazz",
  "Blues",
  "Funk",
  "Electronic",
  "Folk",
];

const JamSessions = () => {
  const { user } = useAuth();
  const { profile } = useGameData();
  const { toast } = useToast();

  const [formState, setFormState] = useState<FormState>(DEFAULT_FORM_STATE);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [creatingSession, setCreatingSession] = useState(false);
  const [joiningSessionId, setJoiningSessionId] = useState<string | null>(null);
  const [joinAccessCodes, setJoinAccessCodes] = useState<Record<string, string>>({});
  const [jamSessions, setJamSessions] = useState<JamSessionWithHost[]>([]);

  const profileDisplayName = useMemo(() => {
    if (!profile) {
      return "";
    }

    return profile.display_name || profile.username || "";
  }, [profile]);

  const loadJamSessions = useCallback(async () => {
    setLoadingSessions(true);

    const { data, error } = await supabase
      .from("jam_sessions")
      .select(
        `*, host:profiles!jam_sessions_host_id_fkey(user_id, username, display_name, avatar_url)`
      )
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error loading jam sessions:", error);
      toast({
        title: "Unable to load jam sessions",
        description: error.message,
        variant: "destructive",
      });
      setLoadingSessions(false);
      return;
    }

    setJamSessions((data as any) ?? []);
    setLoadingSessions(false);
  }, [toast]);

  useEffect(() => {
    void loadJamSessions();
  }, [loadJamSessions]);

  useEffect(() => {
    const channel = supabase
      .channel("jam-sessions-feed")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "jam_sessions" },
        () => {
          void loadJamSessions();
        }
      )
      .subscribe();

    return () => {
      void channel.unsubscribe();
    };
  }, [loadJamSessions]);

  const resetForm = () => {
    setFormState(DEFAULT_FORM_STATE);
  };

  const handleFormChange = (field: keyof FormState, value: string | number | boolean) => {
    setFormState((previous) => ({
      ...previous,
      [field]: value,
    }));
  };

  const handleCreateSession = async () => {
    if (!user) {
      toast({
        title: "Sign in required",
        description: "You need to be logged in to host a jam session.",
        variant: "destructive",
      });
      return;
    }

    if (!formState.name || !formState.genre) {
      toast({
        title: "Missing information",
        description: "Please provide a session name and genre to continue.",
      });
      return;
    }

    if (formState.isPrivate && !formState.accessCode) {
      toast({
        title: "Access code required",
        description: "Private sessions must include an access code for attendees.",
      });
      return;
    }

    setCreatingSession(true);

    const payload: Database["public"]["Tables"]["jam_sessions"]["Insert"] = {
      host_id: user.id,
      name: formState.name.trim(),
      description: formState.description.trim() || null,
      genre: formState.genre,
      tempo: formState.tempo,
      max_participants: formState.maxParticipants,
      skill_requirement: formState.skillRequirement,
      is_private: formState.isPrivate,
      access_code: formState.isPrivate ? formState.accessCode.trim() : null,
    };

    const { error } = await supabase.from("jam_sessions").insert(payload);

    if (error) {
      console.error("Error creating jam session:", error);
      toast({
        title: "Unable to create session",
        description: error.message,
        variant: "destructive",
      });
      setCreatingSession(false);
      return;
    }

    toast({
      title: "Jam session created",
      description: "Your session is now available for other musicians to join.",
    });

    resetForm();
    setCreatingSession(false);
  };

  const handleJoinSession = async (session: JamSessionWithHost) => {
    if (!user) {
      toast({
        title: "Sign in required",
        description: "Log in to join a jam session.",
        variant: "destructive",
      });
      return;
    }

    if (session.is_private) {
      const codeAttempt = joinAccessCodes[session.id]?.trim();
      if (!codeAttempt) {
        toast({
          title: "Access code needed",
          description: "Enter the access code provided by the host.",
        });
        return;
      }

      if (session.access_code && session.access_code !== codeAttempt) {
        toast({
          title: "Incorrect access code",
          description: "Double-check the access code with the host and try again.",
          variant: "destructive",
        });
        return;
      }
    }

    setJoiningSessionId(session.id);

    const { data, error } = await (supabase.rpc as any)("join_jam_session", {
      p_session_id: session.id,
    });

    if (error) {
      console.error("Error joining jam session:", error);
      toast({
        title: "Unable to join session",
        description: error.message,
        variant: "destructive",
      });
      setJoiningSessionId(null);
      return;
    }

    setJamSessions((previous) =>
      previous.map((existing) =>
        existing.id === session.id
          ? {
              ...existing,
              current_participants: (data as any)?.current_participants ?? existing.current_participants,
              participant_ids: (data as any)?.participant_ids ?? (existing as any).participant_ids,
            }
          : existing
      )
    );

    toast({
      title: "Joined jam session",
      description: `You're now part of ${session.name}. Get ready to jam!`,
    });

    setJoiningSessionId(null);
  };

  const getHostLabel = (session: JamSessionWithHost) => {
    if (!session.host) {
      return "Unknown host";
    }

    return session.host.display_name || session.host.username || "Unknown host";
  };

  const isJoining = (sessionId: string) => joiningSessionId === sessionId;

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Jam Sessions</h1>
          <p className="text-muted-foreground">
            Coordinate collaborative jams, discover new bandmates, and grow your musical chemistry in real time.
          </p>
        </div>
        {profileDisplayName && (
          <div className="text-sm text-muted-foreground">
            Signed in as <span className="font-medium text-foreground">{profileDisplayName}</span>
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1 self-start">
          <CardHeader>
            <CardTitle>Create a jam session</CardTitle>
            <CardDescription>
              Define your session details so other musicians can join the groove.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="session-name">Session name</Label>
              <Input
                id="session-name"
                placeholder="Late Night Groove"
                value={formState.name}
                onChange={(event) => handleFormChange("name", event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="session-description">Description</Label>
              <Textarea
                id="session-description"
                placeholder="Share your vision, influences, or expectations for the jam."
                value={formState.description}
                onChange={(event) => handleFormChange("description", event.target.value)}
                rows={4}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="session-genre">Genre</Label>
                <Select
                  value={formState.genre}
                  onValueChange={(value) => handleFormChange("genre", value)}
                >
                  <SelectTrigger id="session-genre">
                    <SelectValue placeholder="Select genre" />
                  </SelectTrigger>
                  <SelectContent>
                    {GENRE_OPTIONS.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="session-tempo">Tempo (BPM)</Label>
                <Input
                  id="session-tempo"
                  type="number"
                  min={40}
                  max={240}
                  value={formState.tempo}
                  onChange={(event) => handleFormChange("tempo", Number(event.target.value) || 0)}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="session-max">Max participants</Label>
                <Input
                  id="session-max"
                  type="number"
                  min={1}
                  max={16}
                  value={formState.maxParticipants}
                  onChange={(event) => handleFormChange("maxParticipants", Number(event.target.value) || 0)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="session-skill">Skill requirement</Label>
                <Input
                  id="session-skill"
                  type="number"
                  min={0}
                  max={100}
                  value={formState.skillRequirement}
                  onChange={(event) => handleFormChange("skillRequirement", Number(event.target.value) || 0)}
                />
              </div>
            </div>

            <Separator />

            <div className="flex items-center justify-between gap-4">
              <div className="space-y-1">
                <Label htmlFor="session-private">Private session</Label>
                <p className="text-xs text-muted-foreground">
                  Require an access code so only invited players can join.
                </p>
              </div>
              <Switch
                id="session-private"
                checked={formState.isPrivate}
                onCheckedChange={(checked) => handleFormChange("isPrivate", checked)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="session-access">Access code</Label>
              <Input
                id="session-access"
                placeholder="e.g. GROOVE2025"
                value={formState.accessCode}
                disabled={!formState.isPrivate}
                onChange={(event) => handleFormChange("accessCode", event.target.value)}
              />
            </div>

            <Button
              className="w-full"
              onClick={handleCreateSession}
              disabled={creatingSession}
            >
              {creatingSession ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating...
                </>
              ) : (
                "Launch jam session"
              )}
            </Button>

            <p className="text-xs text-muted-foreground">
              Need inspiration? Coordinate with your bandmates from the <Link to="/band" className="underline">Band Manager</Link> or invite players from your fan community.
            </p>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Active jam sessions</CardTitle>
            <CardDescription>
              Browse upcoming sessions and jump into the ones that fit your vibe.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loadingSessions ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="mr-2 h-5 w-5 animate-spin text-muted-foreground" />
                <span className="text-muted-foreground">Loading jam sessions...</span>
              </div>
            ) : jamSessions.length === 0 ? (
              <div className="rounded-lg border border-dashed p-10 text-center">
                <Music4 className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
                <h3 className="text-lg font-semibold">No sessions yet</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Be the first to host a jam session or check back soon to see what the community is planning.
                </p>
              </div>
            ) : (
              jamSessions.map((session) => {
                const isHost = session.host_id === user?.id;
                const alreadyJoined = session.participant_ids?.includes(user?.id ?? "");
                const isFull = (session.current_participants ?? 0) >= session.max_participants;

                return (
                  <div key={session.id} className="rounded-lg border bg-card p-5 shadow-sm">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-xl font-semibold leading-tight">{session.name}</h3>
                          <Badge variant="secondary">{session.genre}</Badge>
                          {session.is_private ? (
                            <Badge variant="outline" className="flex items-center gap-1">
                              <Lock className="h-3 w-3" /> Private
                            </Badge>
                          ) : (
                            <Badge variant="outline">Open</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {session.description || "No description provided yet."}
                        </p>
                        <div className="text-sm text-muted-foreground">
                          Hosted by <span className="font-medium text-foreground">{getHostLabel(session)}</span>
                        </div>
                      </div>

                      <div className="grid gap-2 text-sm text-muted-foreground sm:text-right">
                        <div>Tempo: <span className="font-medium text-foreground">{session.tempo} BPM</span></div>
                        <div>
                          Participants: {session.current_participants ?? 0} / {session.max_participants}
                        </div>
                        <div>Skill requirement: {session.skill_requirement}</div>
                      </div>
                    </div>

                    <Separator className="my-4" />

                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      {session.is_private ? (
                        <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                          <Input
                            placeholder="Enter access code"
                            value={joinAccessCodes[session.id] ?? ""}
                            onChange={(event) =>
                              setJoinAccessCodes((previous) => ({
                                ...previous,
                                [session.id]: event.target.value,
                              }))
                            }
                            className="sm:w-64"
                          />
                          <p className="text-xs text-muted-foreground sm:text-sm">
                            Ask the host for the access code before joining.
                          </p>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          Open to everyone. Invite your bandmates or friends to jam together.
                        </p>
                      )}

                      <Button
                        onClick={() => handleJoinSession(session)}
                        disabled={
                          isHost || alreadyJoined || isFull || isJoining(session.id)
                        }
                      >
                        {isHost
                          ? "You are the host"
                          : alreadyJoined
                            ? "Already joined"
                            : isFull
                              ? "Session full"
                              : isJoining(session.id)
                                ? (
                                  <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Joining...
                                  </>
                                )
                                : "Join session"}
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default JamSessions;
