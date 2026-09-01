import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Activity,
  BatteryMedium,
  Clock3,
  Gauge,
  Loader2,
  Music2,
  Play,
  RefreshCw,
  Sparkles,
  Users,
  WandSparkles,
  X,
} from "lucide-react";

const FOCUS_ACTIONS = [
  { value: "full_run", label: "Full run" },
  { value: "tighten_rhythm", label: "Tighten rhythm" },
  { value: "vocals", label: "Vocals" },
  { value: "arrangement", label: "Arrangement" },
  { value: "improvisation", label: "Improvisation" },
  { value: "dynamics", label: "Dynamics" },
  { value: "stagecraft", label: "Stagecraft" },
] as const;

const SESSION_ROLES = [
  { value: "performer", label: "Performer" },
  { value: "producer", label: "Producer" },
  { value: "sound_tech", label: "Sound tech" },
  { value: "roadie", label: "Roadie" },
] as const;

type FocusAction = (typeof FOCUS_ACTIONS)[number]["value"];
type SessionRole = (typeof SESSION_ROLES)[number]["value"];

type WorkspaceParticipant = {
  profile_id: string;
  display_name: string;
  session_role: SessionRole;
  instrument: string | null;
  fatigue_start: number;
  fatigue_level: number;
  performance_score: number;
};

type WorkspaceSetlistItem = {
  position: number;
  song_id: string | null;
  title: string;
  focus_action: FocusAction;
};

type WorkspaceSlot = {
  slot_index: number;
  scheduled_for: string;
  status: "pending" | "resolved" | "cancelled";
  song_id: string | null;
  title: string;
  focus_action: FocusAction;
  mood_before: number | null;
  mood_after: number | null;
  synergy_score: number | null;
  venue_score: number;
  challenge_score: number;
  result: {
    average_performance?: number;
    mood_delta?: number;
    insight?: string;
  };
  resolved_at: string | null;
};

type WorkspaceOption = {
  id: string;
  name?: string;
  title?: string;
  genre?: string | null;
  description?: string | null;
  difficulty?: string;
  xp_bonus_pct?: number;
  min_participants?: number;
};

type JamWorkspace = {
  session: {
    id: string;
    name: string;
    genre: string;
    tempo: number;
    status: string;
    host_id: string;
    band_id: string | null;
    engine_version: number;
    started_at: string | null;
    scheduled_start: string | null;
    scheduled_end: string | null;
    duration_slots: number;
    slot_minutes: number;
    mood_score: number;
    synergy_score: number;
    venue_trait: string | null;
    venue_trait_bonus: Record<string, number>;
    challenge_id: string | null;
    challenge_completed: boolean;
    configured_at: string | null;
    finalised_at: string | null;
    total_xp_awarded: number;
  };
  viewer: { profile_id: string; is_host: boolean };
  participants: WorkspaceParticipant[];
  setlist: WorkspaceSetlistItem[];
  slots: WorkspaceSlot[];
  challenge: WorkspaceOption | null;
  challenge_options: WorkspaceOption[];
  song_options: WorkspaceOption[];
};

type DraftSetlistItem = {
  song_id: string | null;
  focus_action: FocusAction;
};

const rpcMessage = (error: unknown) => {
  if (error && typeof error === "object" && "message" in error) {
    const message = String((error as { message?: unknown }).message ?? "");
    const friendly: Record<string, string> = {
      jam_too_early_to_start: "This jam can be started from 15 minutes before the booked time.",
      jam_role_producer_limit: "Only one producer can be assigned.",
      jam_role_sound_tech_limit: "Only one sound tech can be assigned.",
      jam_role_roadie_limit: "Only one roadie can be assigned.",
      jam_configuration_locked: "The setup is locked because the session has already started.",
      jam_slot_already_locked: "That slot has started already, so its focus can no longer be changed.",
    };
    return friendly[message] ?? message;
  }
  return "The jam session could not be updated.";
};

const scoreLabel = (score: number) => {
  if (score >= 82) return "Locked in";
  if (score >= 68) return "Solid";
  if (score >= 52) return "Developing";
  return "Needs work";
};

export const JamSessionH1Workspace = ({ sessionId }: { sessionId: string }) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [roles, setRoles] = useState<Record<string, SessionRole>>({});
  const [challengeId, setChallengeId] = useState("none");
  const [setlistDraft, setSetlistDraft] = useState<DraftSetlistItem[]>([
    { song_id: null, focus_action: "improvisation" },
  ]);
  const [setupDirty, setSetupDirty] = useState(false);

  const workspaceQuery = useQuery({
    queryKey: ["jam-session-workspace", sessionId],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("get_jam_session_workspace", {
        p_session_id: sessionId,
      });
      if (error) throw error;
      return data as JamWorkspace;
    },
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
  });

  const workspace = workspaceQuery.data;

  useEffect(() => {
    if (!workspace || setupDirty || workspace.session.status !== "waiting") return;
    setRoles(
      Object.fromEntries(
        workspace.participants.map((participant) => [participant.profile_id, participant.session_role]),
      ),
    );
    setChallengeId(workspace.session.challenge_id || "none");
    setSetlistDraft(
      workspace.setlist.length
        ? workspace.setlist.map((item) => ({
            song_id: item.song_id,
            focus_action: item.focus_action,
          }))
        : [{ song_id: null, focus_action: "improvisation" }],
    );
  }, [setupDirty, workspace]);

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["jam-session-workspace", sessionId] }),
      queryClient.invalidateQueries({ queryKey: ["jam-sessions"] }),
      queryClient.invalidateQueries({ queryKey: ["jam-session-outcomes"] }),
      queryClient.invalidateQueries({ queryKey: ["profile"] }),
      queryClient.invalidateQueries({ queryKey: ["scheduled-activities"] }),
    ]);
  };

  const configureMutation = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase.rpc as any)("configure_jam_session_v2", {
        p_session_id: sessionId,
        p_setlist: setlistDraft,
        p_roles: roles,
        p_challenge_id: challengeId === "none" ? null : challengeId,
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      setSetupDirty(false);
      await invalidate();
      toast({ title: "Jam setup saved", description: "Roles, song focus and challenge are locked server-side when the jam starts." });
    },
    onError: (error: unknown) =>
      toast({ title: "Unable to save setup", description: rpcMessage(error), variant: "destructive" }),
  });

  const startMutation = useMutation({
    mutationFn: async () => {
      if (setupDirty) {
        const { error: configureError } = await (supabase.rpc as any)("configure_jam_session_v2", {
          p_session_id: sessionId,
          p_setlist: setlistDraft,
          p_roles: roles,
          p_challenge_id: challengeId === "none" ? null : challengeId,
        });
        if (configureError) throw configureError;
      }
      const { error } = await (supabase.rpc as any)("start_jam_session_v2", {
        p_session_id: sessionId,
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      setSetupDirty(false);
      await invalidate();
      toast({ title: "Jam started", description: "The timed slot engine will continue resolving while players are offline." });
    },
    onError: (error: unknown) =>
      toast({ title: "Unable to start jam", description: rpcMessage(error), variant: "destructive" }),
  });

  const focusMutation = useMutation({
    mutationFn: async ({ slotIndex, focusAction }: { slotIndex: number; focusAction: FocusAction }) => {
      const { error } = await (supabase.rpc as any)("set_jam_slot_focus_v2", {
        p_session_id: sessionId,
        p_slot_index: slotIndex,
        p_focus_action: focusAction,
        p_song_id: null,
      });
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (error: unknown) =>
      toast({ title: "Unable to change slot focus", description: rpcMessage(error), variant: "destructive" }),
  });

  const processMutation = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase.rpc as any)("process_jam_session_v2", {
        p_session_id: sessionId,
      });
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (error: unknown) =>
      toast({ title: "Unable to refresh progress", description: rpcMessage(error), variant: "destructive" }),
  });

  const nextPendingSlot = useMemo(
    () => workspace?.slots.find((slot) => slot.status === "pending") ?? null,
    [workspace?.slots],
  );

  if (workspaceQuery.isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center gap-2 py-10 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading jam workspace…
        </CardContent>
      </Card>
    );
  }

  if (workspaceQuery.isError || !workspace) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Jam workspace unavailable</CardTitle>
          <CardDescription>{rpcMessage(workspaceQuery.error)}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={() => workspaceQuery.refetch()}>
            <RefreshCw className="mr-2 h-4 w-4" /> Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  const isHost = workspace.viewer.is_host;
  const isWaiting = workspace.session.status === "waiting";
  const isActive = workspace.session.status === "active";
  const isCompleted = workspace.session.status === "completed";
  const scheduledStart = workspace.session.scheduled_start
    ? new Date(workspace.session.scheduled_start)
    : null;

  return (
    <Card className="border-primary/30">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" /> Jam Session 2.0
            </CardTitle>
            <CardDescription>
              Ten-minute slots resolve deterministically on the server. Refreshing cannot reroll a result.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">{workspace.session.genre}</Badge>
            <Badge variant="outline">{workspace.session.tempo} BPM</Badge>
            <Badge>{workspace.session.status}</Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border p-3">
            <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground"><Sparkles className="h-3.5 w-3.5" /> Mood</div>
            <div className="text-2xl font-semibold">{workspace.session.mood_score}%</div>
            <Progress value={workspace.session.mood_score} className="mt-2 h-1.5" />
          </div>
          <div className="rounded-lg border p-3">
            <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground"><Users className="h-3.5 w-3.5" /> Synergy</div>
            <div className="text-2xl font-semibold">{workspace.session.synergy_score}%</div>
            <Progress value={workspace.session.synergy_score} className="mt-2 h-1.5" />
          </div>
          <div className="rounded-lg border p-3">
            <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground"><Gauge className="h-3.5 w-3.5" /> Venue</div>
            <div className="text-sm font-semibold">{workspace.session.venue_trait || "Assessed on start"}</div>
            {workspace.session.venue_trait_bonus?.equipment != null && (
              <p className="mt-1 text-xs text-muted-foreground">Equipment {workspace.session.venue_trait_bonus.equipment}%</p>
            )}
          </div>
          <div className="rounded-lg border p-3">
            <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground"><Clock3 className="h-3.5 w-3.5" /> Progress</div>
            <div className="text-sm font-semibold">
              {workspace.slots.filter((slot) => slot.status === "resolved").length} / {workspace.session.duration_slots} slots
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {nextPendingSlot ? `Next ${new Date(nextPendingSlot.scheduled_for).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : isCompleted ? "Session complete" : "Starts when host begins"}
            </p>
          </div>
        </div>

        {isWaiting && (
          <div className="space-y-5 rounded-lg border bg-muted/20 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-semibold">Pre-jam setup</h3>
                <p className="text-sm text-muted-foreground">
                  Choose jobs, song focus and an optional challenge before the first slot locks.
                </p>
              </div>
              {scheduledStart && <Badge variant="outline">Booked {scheduledStart.toLocaleString()}</Badge>}
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {workspace.participants.map((participant) => (
                <div key={participant.profile_id} className="rounded-lg border bg-background p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div>
                      <p className="font-medium">{participant.display_name}</p>
                      <p className="text-xs text-muted-foreground">{participant.instrument || "Flexible musician"}</p>
                    </div>
                    <Badge variant="outline">Fatigue {participant.fatigue_level}%</Badge>
                  </div>
                  {isHost ? (
                    <Select
                      value={roles[participant.profile_id] || participant.session_role}
                      onValueChange={(value: SessionRole) => {
                        setRoles((current) => ({ ...current, [participant.profile_id]: value }));
                        setSetupDirty(true);
                      }}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {SESSION_ROLES.map((role) => <SelectItem key={role.value} value={role.value}>{role.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Badge>{SESSION_ROLES.find((role) => role.value === participant.session_role)?.label || participant.session_role}</Badge>
                  )}
                </div>
              ))}
            </div>

            {isHost && (
              <>
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <h4 className="text-sm font-semibold">Setlist focus</h4>
                      <p className="text-xs text-muted-foreground">Up to six songs or improvisation blocks. The pattern repeats across the timed slots.</p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={setlistDraft.length >= 6}
                      onClick={() => {
                        setSetlistDraft((current) => [...current, { song_id: null, focus_action: "full_run" }]);
                        setSetupDirty(true);
                      }}
                    >
                      <Music2 className="mr-1 h-4 w-4" /> Add focus
                    </Button>
                  </div>

                  {setlistDraft.map((item, index) => (
                    <div key={index} className="grid gap-2 rounded-lg border bg-background p-3 sm:grid-cols-[1fr_1fr_auto]">
                      <Select
                        value={item.song_id || "improv"}
                        onValueChange={(value) => {
                          setSetlistDraft((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, song_id: value === "improv" ? null : value } : row));
                          setSetupDirty(true);
                        }}
                      >
                        <SelectTrigger><SelectValue placeholder="Choose song" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="improv">Improvisation</SelectItem>
                          {workspace.song_options.map((song) => <SelectItem key={song.id} value={song.id}>{song.title}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <Select
                        value={item.focus_action}
                        onValueChange={(value: FocusAction) => {
                          setSetlistDraft((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, focus_action: value } : row));
                          setSetupDirty(true);
                        }}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {FOCUS_ACTIONS.map((focus) => <SelectItem key={focus.value} value={focus.value}>{focus.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        disabled={setlistDraft.length === 1}
                        onClick={() => {
                          setSetlistDraft((current) => current.filter((_, rowIndex) => rowIndex !== index));
                          setSetupDirty(true);
                        }}
                        aria-label="Remove setlist focus"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>

                <div className="space-y-2">
                  <h4 className="text-sm font-semibold">Optional challenge</h4>
                  <Select value={challengeId} onValueChange={(value) => { setChallengeId(value); setSetupDirty(true); }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No challenge</SelectItem>
                      {workspace.challenge_options.map((challenge) => (
                        <SelectItem key={challenge.id} value={challenge.id}>
                          {challenge.name} · {challenge.difficulty || "medium"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => configureMutation.mutate()} disabled={configureMutation.isPending || !setupDirty}>
                    {configureMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <WandSparkles className="mr-2 h-4 w-4" />}
                    Save setup
                  </Button>
                  <Button onClick={() => startMutation.mutate()} disabled={startMutation.isPending}>
                    {startMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
                    Start jam
                  </Button>
                </div>
              </>
            )}
          </div>
        )}

        {(isActive || isCompleted) && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-semibold">Live session analytics</h3>
                <p className="text-sm text-muted-foreground">Fatigue accumulates by role and focus; each resolved slot keeps its own evidence.</p>
              </div>
              {isActive && (
                <Button variant="outline" size="sm" onClick={() => processMutation.mutate()} disabled={processMutation.isPending}>
                  {processMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                  Refresh progress
                </Button>
              )}
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {workspace.participants.map((participant) => (
                <div key={participant.profile_id} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="font-medium">{participant.display_name}</p>
                      <p className="text-xs text-muted-foreground">{SESSION_ROLES.find((role) => role.value === participant.session_role)?.label || participant.session_role}</p>
                    </div>
                    <Badge variant="outline">Performance {Math.round(participant.performance_score)}%</Badge>
                  </div>
                  <div className="mt-3 space-y-1">
                    <div className="flex justify-between text-xs text-muted-foreground"><span className="flex items-center gap-1"><BatteryMedium className="h-3.5 w-3.5" /> Fatigue</span><span>{participant.fatigue_level}%</span></div>
                    <Progress value={participant.fatigue_level} className="h-1.5" />
                  </div>
                </div>
              ))}
            </div>

            <div className="grid gap-3 lg:grid-cols-2">
              {workspace.slots.map((slot) => {
                const resolvedScore = Number(slot.result?.average_performance ?? 0);
                const canChangeFocus = isHost && slot.status === "pending" && new Date(slot.scheduled_for).getTime() > Date.now();
                return (
                  <div key={slot.slot_index} className="rounded-lg border p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold">Slot {slot.slot_index} · {slot.title}</p>
                        <p className="text-xs text-muted-foreground">{new Date(slot.scheduled_for).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
                      </div>
                      <Badge variant={slot.status === "resolved" ? "default" : "outline"}>{slot.status}</Badge>
                    </div>

                    <div className="mt-3">
                      {canChangeFocus ? (
                        <Select value={slot.focus_action} onValueChange={(value: FocusAction) => focusMutation.mutate({ slotIndex: slot.slot_index, focusAction: value })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {FOCUS_ACTIONS.map((focus) => <SelectItem key={focus.value} value={focus.value}>{focus.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge variant="secondary">{FOCUS_ACTIONS.find((focus) => focus.value === slot.focus_action)?.label || slot.focus_action}</Badge>
                      )}
                    </div>

                    {slot.status === "resolved" && (
                      <div className="mt-4 space-y-2">
                        <div className="flex items-center justify-between text-sm"><span>{scoreLabel(resolvedScore)}</span><strong>{Math.round(resolvedScore)}%</strong></div>
                        <Progress value={resolvedScore} className="h-2" />
                        <div className="flex flex-wrap gap-2 text-xs">
                          <Badge variant="outline">Synergy {slot.synergy_score ?? 0}%</Badge>
                          <Badge variant="outline">Venue {slot.venue_score}%</Badge>
                          {slot.mood_after != null && slot.mood_before != null && <Badge variant="outline">Mood {slot.mood_after - slot.mood_before >= 0 ? "+" : ""}{slot.mood_after - slot.mood_before}</Badge>}
                        </div>
                        {slot.result?.insight && <p className="text-sm text-muted-foreground">{slot.result.insight}</p>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {workspace.challenge && (
          <div className="rounded-lg border p-4">
            <div className="flex items-center gap-2 font-semibold"><Sparkles className="h-4 w-4" /> {workspace.challenge.name}</div>
            <p className="mt-1 text-sm text-muted-foreground">{workspace.challenge.description}</p>
            {isCompleted && <Badge className="mt-2">{workspace.session.challenge_completed ? "Challenge completed" : "Challenge missed"}</Badge>}
          </div>
        )}

        {isCompleted && (
          <div className="rounded-lg border bg-muted/20 p-4">
            <p className="text-sm text-muted-foreground">Final server-settled reward</p>
            <p className="mt-1 text-2xl font-semibold">{workspace.session.total_xp_awarded} XP</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
