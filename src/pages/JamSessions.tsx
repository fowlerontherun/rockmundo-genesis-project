import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/hooks/use-auth-context";
import { useGameData } from "@/hooks/useGameData";
import {
  fetchJamSessionMessages,
  fetchJamSessionParticipants,
  postJamSessionMessage,
  subscribeToJamSessionMessages,
  updateParticipantReadiness,
  upsertJamSessionParticipant,
  type JamSessionMessage,
  type JamSessionParticipant,
} from "@/integrations/supabase/jamSessions";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/lib/supabase-types";
import { createCommunityPost } from "@/lib/api/feed";
import { MUSIC_GENRES } from "@/data/genres";
import { Loader2, Lock, Megaphone, Music4, Send, Share2, Users } from "lucide-react";

type JamSessionRow = Database["public"]["Tables"]["jam_sessions"]["Row"];

type JamSessionWithHost = JamSessionRow & {
  host?: {
    user_id: string;
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
  participant_ids?: string[];
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

const GENRE_OPTIONS = MUSIC_GENRES;

const deriveSkillTierFromLevel = (level?: number | null) => {
  if (!level || level < 5) return "Rising Star";
  if (level < 15) return "Stage Pro";
  if (level < 25) return "Tour Veteran";
  return "Arena Legend";
};

const buildInviteUrl = (sessionId: string) => {
  if (typeof window !== "undefined" && window.location?.origin) {
    return `${window.location.origin}/jam-sessions?session=${sessionId}`;
  }

  return `https://app.rockmundo.com/jam-sessions?session=${sessionId}`;
};

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
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [participants, setParticipants] = useState<JamSessionParticipant[]>([]);
  const [participantsLoading, setParticipantsLoading] = useState(false);
  const [messages, setMessages] = useState<JamSessionMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const [broadcastPending, setBroadcastPending] = useState(false);

  const selectedSession = useMemo(
    () => jamSessions.find((session) => session.id === selectedSessionId) ?? null,
    [jamSessions, selectedSessionId],
  );

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
        `*, host:profiles!jam_sessions_host_id_fkey(user_id, username, display_name, avatar_url)`,
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

    setJamSessions((data as JamSessionWithHost[]) ?? []);
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
        },
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

  const ensureParticipantRecord = useCallback(
    async (session: JamSessionWithHost) => {
      if (!profile?.id) {
        return;
      }

      const isParticipant =
        session.host_id === profile.id ||
        session.participant_ids?.includes(profile.id) ||
        session.participant_ids?.includes(user?.id ?? "");

      if (!isParticipant) {
        return;
      }

      try {
        await upsertJamSessionParticipant({
          sessionId: session.id,
          profileId: profile.id,
          defaults: {
            skill_tier: deriveSkillTierFromLevel(profile.level),
          },
        });
      } catch (error) {
        console.error("Unable to sync participant record", error);
      }
    },
    [profile?.id, profile?.level, user?.id],
  );

  const handleCreateSession = async () => {
    if (!user) {
      toast({
        title: "Sign in required",
        description: "You need to be logged in to host a jam session.",
        variant: "destructive",
      });
      return;
    }

    if (!profile?.id) {
      toast({
        title: "Profile not ready",
        description: "We couldn't find your profile information. Please try again shortly.",
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
      host_id: profile.id,
      name: formState.name.trim(),
      description: formState.description.trim() || null,
      genre: formState.genre,
      tempo: formState.tempo,
      max_participants: formState.maxParticipants,
      skill_requirement: formState.skillRequirement,
      is_private: formState.isPrivate,
      access_code: formState.isPrivate ? formState.accessCode.trim() : null,
    };

    const { data, error } = await supabase
      .from("jam_sessions")
      .insert(payload)
      .select("id, host_id")
      .single();

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

    if (data?.id) {
      try {
        await upsertJamSessionParticipant({
          sessionId: data.id,
          profileId: profile.id,
          defaults: {
            skill_tier: deriveSkillTierFromLevel(profile.level),
          },
        });
      } catch (participantError) {
        console.error("Unable to register host as participant", participantError);
      }
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

    if (profile?.id) {
      try {
        await upsertJamSessionParticipant({
          sessionId: session.id,
          profileId: profile.id,
          defaults: { skill_tier: deriveSkillTierFromLevel(profile.level) },
        });
      } catch (participantError) {
        console.error("Unable to upsert participant entry", participantError);
      }
    }

    setJamSessions((previous) =>
      previous.map((existing) =>
        existing.id === session.id
          ? {
              ...existing,
              current_participants: (data as JamSessionRow)?.current_participants ?? existing.current_participants,
              participant_ids: (data as JamSessionWithHost)?.participant_ids ?? existing.participant_ids,
            }
          : existing,
      ),
    );

    toast({
      title: "Joined jam session",
      description: `You're now part of ${session.name}. Get ready to jam!`,
    });

    setJoiningSessionId(null);
  };

  const loadParticipantsForSession = useCallback(
    async (sessionId: string) => {
      setParticipantsLoading(true);
      try {
        const rows = await fetchJamSessionParticipants(sessionId);
        setParticipants(rows);
      } catch (error) {
        console.error("Unable to load participants", error);
        toast({
          title: "Cannot load lobby",
          description: "We couldn't fetch the participant roster.",
          variant: "destructive",
        });
      } finally {
        setParticipantsLoading(false);
      }
    },
    [toast],
  );

  const loadMessagesForSession = useCallback(async (sessionId: string) => {
    setMessagesLoading(true);
    try {
      const rows = await fetchJamSessionMessages(sessionId);
      setMessages(rows);
    } catch (error) {
      console.error("Unable to load chat messages", error);
    } finally {
      setMessagesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedSession?.id) {
      setParticipants([]);
      setMessages([]);
      return;
    }

    void loadParticipantsForSession(selectedSession.id);
    void loadMessagesForSession(selectedSession.id);
    void ensureParticipantRecord(selectedSession);

    const channel = subscribeToJamSessionMessages(selectedSession.id, () => {
      void loadMessagesForSession(selectedSession.id);
    });

    return () => {
      void channel.unsubscribe();
    };
  }, [selectedSession, loadParticipantsForSession, loadMessagesForSession, ensureParticipantRecord]);

  const getHostLabel = (session: JamSessionWithHost) => {
    if (!session.host) {
      return "Unknown host";
    }

    return session.host.display_name || session.host.username || "Unknown host";
  };

  const isJoining = (sessionId: string) => joiningSessionId === sessionId;

  const handleSendMessage = async () => {
    if (!selectedSession?.id || !profile?.id) {
      toast({
        title: "Join the jam",
        description: "You need a profile to chat with the lobby.",
        variant: "destructive",
      });
      return;
    }

    const trimmed = chatInput.trim();
    if (!trimmed) {
      return;
    }

    setSendingMessage(true);
    try {
      const newMessage = await postJamSessionMessage({
        sessionId: selectedSession.id,
        senderProfileId: profile.id,
        message: trimmed,
      });
      setChatInput("");
      setMessages((previous) => [...previous, newMessage]);
    } catch (error) {
      console.error("Unable to send message", error);
      toast({
        title: "Message failed",
        description: "We couldn't send your chat message.",
        variant: "destructive",
      });
    } finally {
      setSendingMessage(false);
    }
  };

  const handleReadinessChange = async (nextReady: boolean) => {
    if (!selectedSession?.id || !profile?.id) {
      return;
    }

    try {
      const updated = await updateParticipantReadiness({
        sessionId: selectedSession.id,
        profileId: profile.id,
        isReady: nextReady,
      });

      setParticipants((previous) =>
        previous.map((participant) => (participant.id === updated.id ? updated : participant)),
      );
    } catch (error) {
      console.error("Unable to toggle readiness", error);
      toast({
        title: "Couldn't update readiness",
        description: "Try again in a moment.",
        variant: "destructive",
      });
    }
  };

  const handleCopyInviteLink = async () => {
    if (!selectedSession) {
      return;
    }

    const inviteUrl = buildInviteUrl(selectedSession.id);

    try {
      await navigator.clipboard.writeText(inviteUrl);
      toast({
        title: "Invite link copied",
        description: "Share it with players you want in the room.",
      });
    } catch (error) {
      console.error("Clipboard copy failed", error);
      toast({
        title: "Unable to copy link",
        description: inviteUrl,
      });
    }
  };

  const handleBroadcastToggle = async (value: boolean) => {
    if (!selectedSession) {
      return;
    }

    setBroadcastPending(true);
    const inviteUrl = buildInviteUrl(selectedSession.id);

    try {
      const { error } = await supabase
        .from("jam_sessions")
        .update({ broadcast_to_feed: value })
        .eq("id", selectedSession.id);

      if (error) {
        throw error;
      }

      setJamSessions((previous) =>
        previous.map((session) =>
          session.id === selectedSession.id ? { ...session, broadcast_to_feed: value } : session,
        ),
      );

      if (value && profile?.id) {
        await createCommunityPost({
          authorId: profile.id,
          content: `🎵 ${selectedSession.name} is live — jump in: ${inviteUrl}`,
        });
      }

      toast({
        title: value ? "Broadcast enabled" : "Broadcast disabled",
        description: value
          ? "Your session now appears in the community feed."
          : "The session is no longer highlighted in the feed.",
      });
    } catch (error) {
      console.error("Unable to toggle broadcast", error);
      toast({
        title: "Broadcast failed",
        description: "We couldn't update the community feed toggle.",
        variant: "destructive",
      });
    } finally {
      setBroadcastPending(false);
    }
  };

  const selectedInviteUrl = selectedSession ? buildInviteUrl(selectedSession.id) : "";
  const inviteQrUrl = selectedInviteUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(selectedInviteUrl)}`
    : "";

  const readyCount = useMemo(
    () => participants.filter((participant) => participant.is_ready).length,
    [participants],
  );

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
                <Select value={formState.genre} onValueChange={(value) => handleFormChange("genre", value)}>
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

            <Button className="w-full" onClick={handleCreateSession} disabled={creatingSession}>
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
                const isHost = session.host_id === profile?.id;
                const alreadyJoined = session.participant_ids?.includes(profile?.id ?? "");
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
                          {session.broadcast_to_feed && (
                            <Badge variant="destructive" className="flex items-center gap-1">
                              <Megaphone className="h-3 w-3" /> Broadcasting
                            </Badge>
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
                        <div>Tempo: <span className="font-semibold text-foreground">{session.tempo} BPM</span></div>
                        <div>Participants: {session.current_participants ?? 0} / {session.max_participants}</div>
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

                      <div className="flex flex-col gap-2 sm:flex-row">
                        <Button
                          variant="outline"
                          onClick={() => {
                            setSelectedSessionId(session.id);
                            setDrawerOpen(true);
                          }}
                        >
                          <Users className="mr-2 h-4 w-4" /> Live lobby
                        </Button>
                        <Button
                          onClick={() => handleJoinSession(session)}
                          disabled={isHost || alreadyJoined || isFull || isJoining(session.id)}
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
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>

      <Drawer
        open={drawerOpen && !!selectedSession}
        onOpenChange={(open) => {
          setDrawerOpen(open);
          if (!open) {
            setSelectedSessionId(null);
          }
        }}
      >
        <DrawerContent className="max-h-[92vh] overflow-y-auto">
          <div className="mx-auto max-w-6xl px-4 pb-8 pt-6">
            <DrawerHeader className="space-y-2 border-b pb-4">
              <DrawerTitle className="text-left text-2xl font-semibold">
                {selectedSession?.name || "Session lobby"}
              </DrawerTitle>
              <DrawerDescription>
                {selectedSession?.description || "Keep your crew in sync before the jam kicks off."}
              </DrawerDescription>
            </DrawerHeader>

            <div className="grid gap-6 py-6 lg:grid-cols-2">
              <div className="space-y-6">
                <div className="rounded-lg border p-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Host</p>
                      <p className="font-semibold">{selectedSession ? getHostLabel(selectedSession) : ""}</p>
                    </div>
                    <Badge variant="secondary">{selectedSession?.genre}</Badge>
                  </div>

                  <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                    <div>
                      <dt className="text-muted-foreground">Tempo</dt>
                      <dd className="font-semibold">{selectedSession?.tempo} BPM</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Skill requirement</dt>
                      <dd className="font-semibold">{selectedSession?.skill_requirement}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Capacity</dt>
                      <dd className="font-semibold">
                        {selectedSession?.current_participants ?? 0} / {selectedSession?.max_participants}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Ready players</dt>
                      <dd className="font-semibold">{readyCount} ready</dd>
                    </div>
                  </dl>
                </div>

                <div className="rounded-lg border p-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold">Invite others</p>
                      <p className="text-xs text-muted-foreground">Share a link or QR to bring players directly here.</p>
                    </div>
                    <Button variant="outline" size="sm" onClick={handleCopyInviteLink}>
                      <Share2 className="mr-2 h-3.5 w-3.5" /> Copy link
                    </Button>
                  </div>

                  {selectedInviteUrl && (
                    <>
                      <Input className="mt-4" value={selectedInviteUrl} readOnly />
                      {inviteQrUrl && (
                        <div className="mt-4 flex justify-center">
                          <img src={inviteQrUrl} alt="Session invite QR code" className="h-44 w-44 rounded-md border bg-white p-2" />
                        </div>
                      )}
                    </>
                  )}
                </div>

                {selectedSession?.host_id === profile?.id && (
                  <div className="rounded-lg border p-4 shadow-sm">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold">Broadcast to community feed</p>
                        <p className="text-xs text-muted-foreground">
                          Promote this lobby so explorers can find it on the community feed page.
                        </p>
                      </div>
                      <Switch
                        checked={selectedSession?.broadcast_to_feed ?? false}
                        disabled={broadcastPending}
                        onCheckedChange={handleBroadcastToggle}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-6">
                <div className="rounded-lg border p-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold">Live lobby</p>
                      <p className="text-xs text-muted-foreground">Track who is ready and see their chemistry.</p>
                    </div>
                    <Badge variant="outline" className="flex items-center gap-1">
                      <Users className="h-3.5 w-3.5" /> {participants.length}
                    </Badge>
                  </div>

                  {participantsLoading ? (
                    <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading roster...
                    </div>
                  ) : participants.length === 0 ? (
                    <p className="py-6 text-sm text-muted-foreground">No one has joined yet. Share the invite to get the groove going.</p>
                  ) : (
                    <ScrollArea className="mt-4 h-64 pr-4">
                      <div className="space-y-3">
                        {participants.map((participant) => {
                          const name =
                            participant.profile?.display_name ||
                            participant.profile?.username ||
                            "Guest";
                          const initials = name
                            .split(" ")
                            .map((piece) => piece[0])
                            .join("")
                            .slice(0, 2)
                            .toUpperCase();

                          return (
                            <div key={participant.id} className="flex items-center justify-between rounded-md border p-3">
                              <div className="flex items-center gap-3">
                                <Avatar className="h-10 w-10">
                                  <AvatarImage src={participant.profile?.avatar_url || undefined} alt={name} />
                                  <AvatarFallback>{initials || "J"}</AvatarFallback>
                                </Avatar>
                                <div>
                                  <p className="font-semibold leading-tight">{name}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {participant.skill_tier || deriveSkillTierFromLevel(participant.profile?.level)} · {participant.co_play_count} co-plays
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge variant={participant.is_ready ? "default" : "secondary"}>
                                  {participant.is_ready ? "Ready" : "Warming up"}
                                </Badge>
                                {participant.profile?.id === profile?.id && (
                                  <Switch
                                    checked={participant.is_ready}
                                    onCheckedChange={(checked) => handleReadinessChange(checked)}
                                  />
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </ScrollArea>
                  )}
                </div>

                <div className="space-y-4 rounded-lg border p-4 shadow-sm">
                  <div>
                    <p className="text-sm font-semibold">Lobby chat</p>
                    <p className="text-xs text-muted-foreground">Call out song ideas, tempos, or requests.</p>
                  </div>
                  <div className="rounded-md border bg-muted/30">
                    {messagesLoading ? (
                      <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading messages...
                      </div>
                    ) : messages.length === 0 ? (
                      <p className="p-4 text-sm text-muted-foreground">Say hello to kick things off.</p>
                    ) : (
                      <ScrollArea className="h-64 p-4 pr-6">
                        <div className="space-y-4">
                          {messages.map((message) => {
                            const author =
                              message.sender?.display_name || message.sender?.username || "Player";
                            const timestamp = formatDistanceToNow(new Date(message.created_at), {
                              addSuffix: true,
                            });

                            return (
                              <div key={message.id} className="flex gap-3">
                                <Avatar className="h-9 w-9">
                                  <AvatarImage src={message.sender?.avatar_url || undefined} alt={author} />
                                  <AvatarFallback>
                                    {(author[0] || "J").toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="space-y-1 text-sm">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="font-semibold">{author}</span>
                                    <span className="text-xs text-muted-foreground">{timestamp}</span>
                                  </div>
                                  <p>{message.message}</p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </ScrollArea>
                    )}
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <Textarea
                      placeholder="Drop a note for the lobby"
                      value={chatInput}
                      onChange={(event) => setChatInput(event.target.value)}
                      disabled={!profile?.id}
                    />
                    <Button
                      className="sm:w-40"
                      onClick={handleSendMessage}
                      disabled={!chatInput.trim() || sendingMessage || !profile?.id}
                    >
                      {sendingMessage ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending...
                        </>
                      ) : (
                        <>
                          <Send className="mr-2 h-4 w-4" /> Send
                        </>
                      )}
                    </Button>
                  </div>
                  {!profile?.id && (
                    <p className="text-xs text-muted-foreground">
                      Log in and join the session to chat with the lobby.
                    </p>
                  )}
                </div>
              </div>
            </div>

            <DrawerFooter className="border-t pt-4">
              <DrawerClose asChild>
                <Button variant="outline">Close</Button>
              </DrawerClose>
            </DrawerFooter>
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
};

export default JamSessions;
