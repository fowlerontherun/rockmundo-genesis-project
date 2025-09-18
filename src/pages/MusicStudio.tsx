import { useState, useEffect, useCallback, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth-context";
import { useGameData } from "@/hooks/useGameData";
import {
  buildSkillLevelRecord,
  calculateAverageSkillLevel,
  hasSkillData,
  toSkillProgressMap,
  type SkillKey,
  type SkillLevelRecord,
  type SkillProgressSource
} from "@/utils/skillProgress";
import type { Tables } from "@/integrations/supabase/types";
import {
  Music,
  Mic,
  SlidersHorizontal,
  Sparkles,
  CheckCircle2,
  Play,
  Clock,
  DollarSign,
  Settings2,
  Loader2,
  Waves,
  Trophy
} from "lucide-react";

const stageOrder = ["recording", "mixing", "mastering"] as const;
type Stage = (typeof stageOrder)[number];

type RecordingSession = Tables<"recording_sessions">;
type ProductionTrack = Tables<"production_tracks">;

interface SupabaseSong {
  id: string;
  title: string;
  genre: string;
  status: string;
  quality_score: number;
  mix_quality: number | null;
  master_quality: number | null;
  recording_cost: number | null;
  production_cost: number | null;
  popularity: number | null;
  streams: number | null;
  release_date: string | null;
  created_at: string;
  updated_at: string;
}

interface StageFormState {
  engineer: string;
  scheduledStart: string;
  notes: string;
}

const stageLabels: Record<Stage, string> = {
  recording: "Recording",
  mixing: "Mixing",
  mastering: "Mastering"
};

const stageIcons: Record<Stage, JSX.Element> = {
  recording: <Mic className="h-4 w-4" />,
  mixing: <SlidersHorizontal className="h-4 w-4" />,
  mastering: <Sparkles className="h-4 w-4" />
};

const stageDescriptions: Record<Stage, string> = {
  recording: "Capture the best performances and build your session takes.",
  mixing: "Balance and sculpt the track for clarity and punch.",
  mastering: "Finalize loudness, polish, and prepare for release."
};

const getStageKey = (songId: string, stage: Stage) => `${songId}:${stage}`;

const MIXING_SKILL_KEYS: SkillKey[] = ["guitar", "bass", "drums"];
const MASTERING_SKILL_KEYS: SkillKey[] = ["performance", "vocals", "songwriting"];

const MusicStudio = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const gameData = useGameData();
  const { profile, skills, updateProfile, updateSkills, addActivity, awardActionXp } = gameData;

  const skillProgressSource = useMemo<SkillProgressSource>(() => {
    const withProgress = gameData as unknown as {
      skillProgressMap?: SkillProgressSource;
      skillProgressCollection?: SkillProgressSource;
      skillProgress?: SkillProgressSource;
    };

    return (
      withProgress.skillProgressMap ??
      withProgress.skillProgressCollection ??
      withProgress.skillProgress ??
      null
    );
  }, [gameData]);

  const skillProgressMap = useMemo(
    () => toSkillProgressMap(skillProgressSource, skills),
    [skillProgressSource, skills]
  );

  const skillLevels: SkillLevelRecord = useMemo(
    () => buildSkillLevelRecord(skillProgressMap, skills),
    [skillProgressMap, skills]
  );

  const hasSkillLevels = useMemo(
    () => hasSkillData(skillProgressMap, skills),
    [skillProgressMap, skills]
  );

  const [songs, setSongs] = useState<SupabaseSong[]>([]);
  const [sessionsBySong, setSessionsBySong] = useState<Record<string, RecordingSession[]>>({});
  const [tracksBySession, setTracksBySession] = useState<Record<string, ProductionTrack[]>>({});
  const [sessionForms, setSessionForms] = useState<Record<string, StageFormState>>({});
  const [loading, setLoading] = useState(true);
  const [savingSessionKey, setSavingSessionKey] = useState<string | null>(null);
  const [processingStageKey, setProcessingStageKey] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    try {
      const [songsResponse, sessionsResponse] = await Promise.all([
        supabase
          .from("songs")
          .select("id, title, genre, status, quality_score, mix_quality, master_quality, recording_cost, production_cost, popularity, streams, release_date, created_at, updated_at")
          .eq("artist_id", user.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("recording_sessions")
          .select("*, production_tracks(*)")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
      ]);

      if (songsResponse.error) throw songsResponse.error;
      if (sessionsResponse.error) throw sessionsResponse.error;

      setSongs((songsResponse.data as SupabaseSong[] | null) ?? []);

      const sessionMap: Record<string, RecordingSession[]> = {};
      const tracksMap: Record<string, ProductionTrack[]> = {};
      const forms: Record<string, StageFormState> = {};

      (sessionsResponse.data as (RecordingSession & { production_tracks?: ProductionTrack[] | null })[] | null)?.forEach(
        (session) => {
          sessionMap[session.song_id] = [...(sessionMap[session.song_id] ?? []), session];
          if (Array.isArray(session.production_tracks)) {
            tracksMap[session.id] = session.production_tracks;
          }

          const key = getStageKey(session.song_id, session.stage as Stage);
          forms[key] = {
            engineer: session.engineer_name ?? "",
            scheduledStart: session.scheduled_start ? session.scheduled_start.slice(0, 16) : "",
            notes: session.notes ?? ""
          };
        }
      );

      setSessionsBySong(sessionMap);
      setTracksBySession(tracksMap);
      setSessionForms(forms);
    } catch (error) {
      console.error("Error loading studio data:", error);
      toast({
        variant: "destructive",
        title: "Failed to load studio",
        description: "We couldn't load your production data."
      });
    } finally {
      setLoading(false);
    }
  }, [toast, user]);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [loadData, user]);

  const getStageSessions = useCallback(
    (songId: string, stage: Stage) => (sessionsBySong[songId] ?? []).filter((session) => session.stage === stage),
    [sessionsBySong]
  );

  const getActiveSession = useCallback(
    (songId: string, stage: Stage) => getStageSessions(songId, stage).find((session) => session.status !== "completed"),
    [getStageSessions]
  );

  const calculateMixingCost = useCallback((song: SupabaseSong) => {
    const recordingCost = song.recording_cost ?? 0;
    return Math.max(200, Math.round(recordingCost * 0.6) || 300);
  }, []);

  const calculateMasteringCost = useCallback((song: SupabaseSong) => {
    const recordingCost = song.recording_cost ?? 0;
    return Math.max(150, Math.round(recordingCost * 0.4) || 200);
  }, []);

  const calculateMixQualityBoost = useCallback(() => {
    if (!hasSkillLevels) return 4;
    const average = calculateAverageSkillLevel(
      skillProgressMap,
      MIXING_SKILL_KEYS,
      skills
    );
    if (average <= 0) return 4;
    return Math.max(1, Math.round(average / 10 + Math.random() * 4));
  }, [hasSkillLevels, skillProgressMap, skills]);

  const calculateMasterQualityBoost = useCallback(() => {
    if (!hasSkillLevels) return 5;
    const average = calculateAverageSkillLevel(
      skillProgressMap,
      MASTERING_SKILL_KEYS,
      skills
    );
    if (average <= 0) return 5;
    return Math.max(2, Math.round(average / 8 + Math.random() * 5));
  }, [hasSkillLevels, skillProgressMap, skills]);

  const handleFormChange = (songId: string, stage: Stage, field: keyof StageFormState, value: string) => {
    const key = getStageKey(songId, stage);
    setSessionForms((prev) => ({
      ...prev,
      [key]: {
        engineer: field === "engineer" ? value : prev[key]?.engineer ?? "",
        scheduledStart: field === "scheduledStart" ? value : prev[key]?.scheduledStart ?? "",
        notes: field === "notes" ? value : prev[key]?.notes ?? ""
      }
    }));
  };

  const saveSessionDetails = async (song: SupabaseSong, stage: Stage) => {
    if (!user) return;
    const key = getStageKey(song.id, stage);
    const form = sessionForms[key] ?? { engineer: "", scheduledStart: "", notes: "" };

    setSavingSessionKey(key);
    try {
      const isoSchedule = form.scheduledStart ? new Date(form.scheduledStart).toISOString() : null;
      const existingSessions = getStageSessions(song.id, stage);
      const activeSession = existingSessions[0];

      if (activeSession) {
        const { data, error } = await supabase
          .from("recording_sessions")
          .update({
            engineer_name: form.engineer || null,
            scheduled_start: isoSchedule,
            notes: form.notes || null,
            stage
          })
          .eq("id", activeSession.id)
          .select()
          .single();

        if (error) throw error;

        setSessionsBySong((prev) => ({
          ...prev,
          [song.id]: (prev[song.id] ?? []).map((session) =>
            session.id === activeSession.id ? (data as RecordingSession) : session
          )
        }));
      } else {
        const { data, error } = await supabase
          .from("recording_sessions")
          .insert({
            song_id: song.id,
            user_id: user.id,
            stage,
            status: "scheduled",
            engineer_name: form.engineer || null,
            scheduled_start: isoSchedule,
            notes: form.notes || null
          })
          .select()
          .single();

        if (error) throw error;

        const newSession = data as RecordingSession;
        setSessionsBySong((prev) => ({
          ...prev,
          [song.id]: [newSession, ...(prev[song.id] ?? [])]
        }));
      }

      toast({
        title: `${stageLabels[stage]} session saved`,
        description: `Updated scheduling details for "${song.title}".`
      });
    } catch (error) {
      console.error("Error saving session details:", error);
      toast({
        variant: "destructive",
        title: "Unable to save session",
        description: "Please try again later."
      });
    } finally {
      setSavingSessionKey(null);
    }
  };

  const startStage = async (song: SupabaseSong, stage: Stage) => {
    const key = getStageKey(song.id, stage);
    setProcessingStageKey(key);

    try {
      const activeSession = getActiveSession(song.id, stage);
      if (!activeSession) {
        await saveSessionDetails(song, stage);
      }

      const session = getActiveSession(song.id, stage);
      if (!session) throw new Error("Unable to create session");

      const { data, error } = await supabase
        .from("recording_sessions")
        .update({
          status: "in_progress",
          started_at: new Date().toISOString(),
          engineer_name: sessionForms[key]?.engineer || session.engineer_name || null
        })
        .eq("id", session.id)
        .select()
        .single();

      if (error) throw error;

      setSessionsBySong((prev) => ({
        ...prev,
        [song.id]: (prev[song.id] ?? []).map((item) =>
          item.id === session.id ? (data as RecordingSession) : item
        )
      }));

      toast({
        title: `${stageLabels[stage]} session started`,
        description: `Kicked off ${stageLabels[stage].toLowerCase()} for "${song.title}".`
      });
    } catch (error) {
      console.error("Error starting stage:", error);
      toast({
        variant: "destructive",
        title: "Unable to start stage",
        description: "Please check your session details and try again."
      });
    } finally {
      setProcessingStageKey(null);
    }
  };

  const completeStage = async (song: SupabaseSong, stage: Stage) => {
    if (!user) return;
    const key = getStageKey(song.id, stage);
    const session = getActiveSession(song.id, stage);
    if (!session) {
      toast({
        variant: "destructive",
        title: "No active session",
        description: "Schedule or start this stage before completing it."
      });
      return;
    }

    setProcessingStageKey(key);

    try {
      const completionTime = new Date().toISOString();
      let totalCost = session.total_cost;
      let qualityGain = session.quality_gain;
      let songUpdates: Partial<SupabaseSong> = {};
      let activityMessage = "";

      if (stage === "recording") {
        qualityGain = Math.max(qualityGain, 0);
        totalCost = session.total_cost;
        songUpdates = {
          status: "recorded",
          quality_score: song.quality_score + qualityGain,
          recording_cost: totalCost
        };
        activityMessage = `Finished recording "${song.title}" (${qualityGain} quality)`;
      } else if (stage === "mixing") {
        const cost = calculateMixingCost(song);
        const boost = calculateMixQualityBoost();
        totalCost += cost;
        qualityGain += boost;
        const newMixQuality = (song.mix_quality ?? song.quality_score) + boost;
        songUpdates = {
          mix_quality: newMixQuality,
          production_cost: (song.production_cost ?? 0) + cost
        };
        activityMessage = `Mixed "${song.title}" (+${boost} mix quality)`;
      } else {
        const cost = calculateMasteringCost(song);
        const boost = calculateMasterQualityBoost();
        totalCost += cost;
        qualityGain += boost;
        const newMasterQuality = (song.master_quality ?? song.mix_quality ?? song.quality_score) + boost;
        songUpdates = {
          master_quality: newMasterQuality,
          status: "released",
          release_date: completionTime,
          production_cost: (song.production_cost ?? 0) + cost
        };
        activityMessage = `Mastered "${song.title}" and prepared release (+${boost} master quality)`;
      }

      const { data: updatedSession, error: sessionError } = await supabase
        .from("recording_sessions")
        .update({
          status: "completed",
          completed_at: completionTime,
          total_cost: totalCost,
          quality_gain: qualityGain
        })
        .eq("id", session.id)
        .select()
        .single();

      if (sessionError) throw sessionError;

      const { error: songError } = await supabase
        .from("songs")
        .update({ ...songUpdates, updated_at: completionTime })
        .eq("id", song.id);

      if (songError) throw songError;

      if (profile) {
        const cashDelta = stage === "recording" ? session.total_cost : totalCost - session.total_cost;
        const experienceResult = applyAttributeToValue(qualityGain * 4, attributes, STUDIO_ATTRIBUTE_KEYS);
        const experienceGain = Math.max(0, Math.round(experienceResult.value));

        if (experienceGain > 0) {
          await awardActionXp({
            amount: experienceGain,
            category: "practice",
            actionKey: "studio_session",
            uniqueEventId: session.id,
            metadata: {
              session_id: session.id,
              song_id: song.id,
              stage,
              quality_gain: qualityGain,
              cash_spent: cashDelta,
            },
          });
        }

        await updateProfile({
          cash: Math.max(0, (profile.cash ?? 0) - cashDelta),
        });
      }

      if (hasSkillLevels) {
        if (stage === "mixing") {
          const guitarGain = applyAttributeToValue(1, attributes, SKILL_ATTRIBUTE_MAP.guitar).value;
          const bassGain = applyAttributeToValue(1, attributes, SKILL_ATTRIBUTE_MAP.bass).value;
          const drumsGain = applyAttributeToValue(1, attributes, SKILL_ATTRIBUTE_MAP.drums).value;
          await updateSkills({
            guitar: Math.min(1000, skillLevels.guitar + 1),
            bass: Math.min(1000, skillLevels.bass + 1),
            drums: Math.min(1000, skillLevels.drums + 1)
          });
        } else if (stage === "mastering") {
          const performanceGain = applyAttributeToValue(1, attributes, SKILL_ATTRIBUTE_MAP.performance).value;
          const songwritingGain = applyAttributeToValue(1, attributes, SKILL_ATTRIBUTE_MAP.songwriting).value;
          await updateSkills({
            performance: Math.min(1000, skillLevels.performance + 1),
            songwriting: Math.min(1000, skillLevels.songwriting + 1)
          });
        }
      }

      await addActivity(stage, activityMessage, -totalCost);

      setSessionsBySong((prev) => ({
        ...prev,
        [song.id]: (prev[song.id] ?? []).map((item) =>
          item.id === session.id ? (updatedSession as RecordingSession) : item
        )
      }));

      setSongs((prev) =>
        prev.map((item) => (item.id === song.id ? { ...item, ...songUpdates } : item))
      );

      toast({
        title: `${stageLabels[stage]} completed`,
        description: activityMessage
      });
    } catch (error) {
      console.error("Error completing stage:", error);
      toast({
        variant: "destructive",
        title: "Unable to complete stage",
        description: "Please try again."
      });
    } finally {
      setProcessingStageKey(null);
    }
  };

  const getSongProgress = useMemo(
    () =>
      songs.reduce<Record<string, number>>((acc, song) => {
        const sessions = sessionsBySong[song.id] ?? [];
        const completedStages = new Set(
          sessions.filter((session) => session.status === "completed").map((session) => session.stage as Stage)
        );
        const progress = (completedStages.size / stageOrder.length) * 100;
        acc[song.id] = progress;
        return acc;
      }, {}),
    [sessionsBySong, songs]
  );

  const totalProductionProgress = useMemo(() => {
    if (songs.length === 0) return 0;
    const total = songs.reduce((acc, song) => acc + (getSongProgress[song.id] ?? 0), 0);
    return Math.round(total / songs.length);
  }, [getSongProgress, songs]);

  const isStageUnlocked = (song: SupabaseSong, stage: Stage) => {
    if (stage === "recording") return true;
    if (stage === "mixing") {
      return (sessionsBySong[song.id] ?? []).some(
        (session) => session.stage === "recording" && session.status === "completed"
      );
    }
    return (sessionsBySong[song.id] ?? []).some(
      (session) => session.stage === "mixing" && session.status === "completed"
    );
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary" />
          <p className="font-oswald text-lg">Preparing your studio...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      <div className="space-y-4 text-center">
        <h1 className="text-4xl font-bebas tracking-wider">PRODUCTION CONTROL ROOM</h1>
        <p className="text-lg text-muted-foreground font-oswald">
          Track every stage from the first take to a mastered release.
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Pipeline Progress</CardDescription>
              <CardTitle className="font-oswald text-2xl">{totalProductionProgress}%</CardTitle>
            </CardHeader>
            <CardContent>
              <Progress value={totalProductionProgress} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Songs in Production</CardDescription>
              <CardTitle className="font-oswald text-2xl">{songs.length}</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center gap-2 text-sm text-muted-foreground">
              <Music className="h-4 w-4 text-primary" /> Manage each track's journey
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Available Budget</CardDescription>
              <CardTitle className="font-oswald text-2xl">
                ${profile?.cash?.toLocaleString() ?? 0}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex items-center gap-2 text-sm text-muted-foreground">
              <DollarSign className="h-4 w-4 text-green-500" /> Invest strategically in each stage
            </CardContent>
          </Card>
        </div>
      </div>

      <Tabs defaultValue="sessions" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="sessions">Production Sessions</TabsTrigger>
          <TabsTrigger value="overview">Stage Overview</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <Card>
            <CardHeader>
              <CardTitle className="font-oswald text-xl">Stage Summary</CardTitle>
              <CardDescription>Monitor how your catalog is progressing across each phase.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              {stageOrder.map((stage) => {
                const completed = songs.filter((song) =>
                  (sessionsBySong[song.id] ?? []).some(
                    (session) => session.stage === stage && session.status === "completed"
                  )
                ).length;
                const inProgress = songs.filter((song) =>
                  (sessionsBySong[song.id] ?? []).some(
                    (session) => session.stage === stage && session.status === "in_progress"
                  )
                ).length;

                return (
                  <div key={stage} className="rounded-lg border border-border/60 p-4 space-y-2">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      {stageIcons[stage]}
                      <span>{stageLabels[stage]}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{stageDescriptions[stage]}</p>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Completed</span>
                      <span>{completed}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">In progress</span>
                      <span>{inProgress}</span>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sessions" className="space-y-4">
          {songs.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Music className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
                <h3 className="mb-2 text-lg font-medium">No songs in production</h3>
                <p className="text-muted-foreground">Create a song in the music studio to start production.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {songs.map((song) => (
                <Card key={song.id} className="space-y-4">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="font-oswald text-xl">{song.title}</CardTitle>
                        <CardDescription>
                          {song.genre} • {song.status.toUpperCase()} • {getSongProgress[song.id] ?? 0}% complete
                        </CardDescription>
                      </div>
                      <Badge variant="outline" className="uppercase">
                        {song.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    <Progress value={getSongProgress[song.id] ?? 0} />

                    <div className="grid gap-4 md:grid-cols-3">
                      {stageOrder.map((stage) => {
                        const key = getStageKey(song.id, stage);
                        const form = sessionForms[key] ?? { engineer: "", scheduledStart: "", notes: "" };
                        const stageSessions = getStageSessions(song.id, stage);
                        const activeSession = getActiveSession(song.id, stage);
                        const latestSession = stageSessions[0];
                        const locked = !isStageUnlocked(song, stage);
                        const tracks = latestSession ? tracksBySession[latestSession.id] ?? [] : [];
                        const isCompleted = stageSessions.some((session) => session.status === "completed");

                        return (
                          <div
                            key={stage}
                            className={`space-y-3 rounded-lg border border-border/60 p-4 ${locked ? "opacity-60" : ""}`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 text-sm font-semibold">
                                {stageIcons[stage]}
                                <span>{stageLabels[stage]}</span>
                              </div>
                              <Badge variant={isCompleted ? "default" : activeSession ? "secondary" : "outline"}>
                                {locked ? "Locked" : activeSession?.status ?? (isCompleted ? "completed" : "ready")}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground min-h-[2.5rem]">{stageDescriptions[stage]}</p>

                            <div className="space-y-2 text-xs text-muted-foreground">
                              {latestSession?.scheduled_start && (
                                <div className="flex items-center gap-2">
                                  <Clock className="h-3 w-3" />
                                  <span>
                                    Scheduled {new Date(latestSession.scheduled_start).toLocaleString()}
                                  </span>
                                </div>
                              )}
                              {latestSession?.engineer_name && (
                                <div className="flex items-center gap-2">
                                  <Settings2 className="h-3 w-3" />
                                  <span>Engineer: {latestSession.engineer_name}</span>
                                </div>
                              )}
                              {latestSession && (
                                <div className="flex items-center gap-2">
                                  <DollarSign className="h-3 w-3" />
                                  <span>Cost so far: ${latestSession.total_cost.toLocaleString()}</span>
                                </div>
                              )}
                              {latestSession && (
                                <div className="flex items-center gap-2">
                                  <Trophy className="h-3 w-3" />
                                  <span>Quality gain: +{latestSession.quality_gain}</span>
                                </div>
                              )}
                            </div>

                            {stage === "recording" && tracks.length > 0 && (
                              <div className="space-y-2 rounded bg-muted/60 p-2">
                                <div className="flex items-center gap-2 text-xs font-semibold">
                                  <Waves className="h-3 w-3" />
                                  <span>Takes</span>
                                </div>
                                <ul className="space-y-1 text-xs">
                                  {tracks.map((track) => (
                                    <li key={track.id} className="flex justify-between">
                                      <span>{track.name}</span>
                                      <span className="text-muted-foreground">
                                        +{track.quality_rating ?? 0} quality • ${track.cost}
                                      </span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            <div className="space-y-2">
                              <label className="text-xs font-medium">Engineer</label>
                              <Input
                                value={form.engineer}
                                onChange={(event) => handleFormChange(song.id, stage, "engineer", event.target.value)}
                                disabled={locked}
                              />
                            </div>
                            <div className="space-y-2">
                              <label className="text-xs font-medium">Scheduled start</label>
                              <Input
                                type="datetime-local"
                                value={form.scheduledStart}
                                onChange={(event) => handleFormChange(song.id, stage, "scheduledStart", event.target.value)}
                                disabled={locked}
                              />
                            </div>
                            <div className="space-y-2">
                              <label className="text-xs font-medium">Notes</label>
                              <Textarea
                                rows={3}
                                value={form.notes}
                                onChange={(event) => handleFormChange(song.id, stage, "notes", event.target.value)}
                                disabled={locked}
                              />
                            </div>

                            <div className="flex flex-col gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => saveSessionDetails(song, stage)}
                                disabled={locked || savingSessionKey === key}
                              >
                                {savingSessionKey === key ? (
                                  <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Clock className="mr-2 h-3.5 w-3.5" />
                                )}
                                Save Schedule
                              </Button>
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => startStage(song, stage)}
                                disabled={locked || processingStageKey === key}
                              >
                                {processingStageKey === key ? (
                                  <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Play className="mr-2 h-3.5 w-3.5" />
                                )}
                                Start Stage
                              </Button>
                              <Button
                                variant="default"
                                size="sm"
                                onClick={() => completeStage(song, stage)}
                                disabled={locked || processingStageKey === key || !activeSession}
                              >
                                {processingStageKey === key ? (
                                  <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <CheckCircle2 className="mr-2 h-3.5 w-3.5" />
                                )}
                                Complete Stage
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default MusicStudio;
