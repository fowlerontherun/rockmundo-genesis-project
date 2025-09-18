import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth-context";
import { useGameData } from "@/hooks/useGameData";
import { awardActionXp } from "@/utils/progression";
import {
  AttributeFocus,
  AttributeKey,
  calculateExperienceReward,
  extractAttributeScores
} from "@/utils/gameBalance";
import {
  buildSkillLevelRecord,
  hasSkillData,
  toSkillProgressMap,
  type SkillLevelRecord,
  type SkillProgressSource
} from "@/utils/skillProgress";
import type { Tables } from "@/integrations/supabase/types";
import {
  Music,
  Play,
  Trash2,
  Star,
  Coins,
  Volume2,
  Pencil,
  Mic,
  Square,
  Upload,
  Waves,
  Disc,
  Loader2
} from "lucide-react";

interface SongLayer {
  name: string;
  url: string;
  duration?: number;
  storagePath?: string;
  created_at?: string;
}

type Stage = "recording" | "mixing" | "mastering";

type RecordingSession = Tables<"recording_sessions">;
type ProductionTrack = Tables<"production_tracks">;

interface SupabaseSongRow {
  id: string;
  title?: string | null;
  genre?: string | null;
  lyrics?: string | null;
  status?: string | null;
  quality_score?: number | null;
  duration?: number | null;
  streams?: number | null;
  revenue?: number | null;
  recording_cost?: number | null;
  production_cost?: number | null;
  popularity?: number | null;
  plays?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
  release_date?: string | null;
  chart_position?: number | null;
  artist_id?: string | null;
  user_id?: string | null;
  audio_layers?: unknown;
}

interface Song {
  id: string;
  title: string;
  genre: string;
  lyrics: string;
  status: string;
  quality_score: number;
  duration: number;
  streams: number;
  revenue: number;
  recording_cost: number;
  production_cost: number;
  plays: number;
  popularity: number;
  created_at: string;
  updated_at: string;
  audio_layers: SongLayer[];
}

interface LocalRecording {
  id: string;
  sessionId: string;
  name: string;
  url: string;
  blob: Blob;
  duration: number;
  createdAt: string;
}

interface ToneRecorder {
  start?: () => Promise<void> | void;
  stop: () => Promise<Blob>;
}

interface ToneUserMedia {
  open: () => Promise<void>;
  close?: () => Promise<void>;
  connect: (destination: unknown) => void;
  disconnect?: () => void;
}

interface TonePlayer {
  start?: () => void;
  stop?: () => void;
  dispose?: () => void;
  load?: (url: string) => Promise<void>;
  toDestination?: () => TonePlayer;
  onstop?: () => void;
}

interface ToneModule {
  start?: () => Promise<void>;
  context?: {
    state?: string;
    resume?: () => Promise<void>;
    decodeAudioData?: (data: ArrayBuffer) => Promise<AudioBuffer>;
  };
  Recorder: new () => ToneRecorder;
  UserMedia: new () => ToneUserMedia;
  Player: new (options: { url: string; autostart?: boolean } | string) => TonePlayer;
}

type RecorderInstance = {
  recorder: ToneRecorder;
  mic: ToneUserMedia;
};

const stageLabels: Record<Stage, string> = {
  recording: "Recording",
  mixing: "Mixing",
  mastering: "Mastering"
};

const genres = [
  "Rock",
  "Pop",
  "Hip Hop",
  "Electronic",
  "Jazz",
  "Blues",
  "Country",
  "Metal",
  "Punk",
  "Alternative",
  "Indie",
  "Classical",
  "Folk",
  "R&B"
];

const toNumber = (value: unknown, fallback = 0): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const parseAudioLayers = (layers: SupabaseSongRow["audio_layers"]): SongLayer[] => {
  if (!Array.isArray(layers)) {
    return [];
  }

  return (layers as unknown[])
    .map((layer, index) => {
      if (typeof layer !== "object" || layer === null) return null;

      const record = layer as Record<string, unknown>;
      const url = typeof record.url === "string" ? record.url : "";
      if (!url) return null;

      return {
        name:
          typeof record.name === "string" && record.name.trim().length > 0
            ? record.name
            : `Layer ${index + 1}`,
        url,
        duration:
          typeof record.duration === "number" && Number.isFinite(record.duration)
            ? record.duration
            : undefined,
        storagePath:
          typeof record.storagePath === "string" && record.storagePath.length > 0
            ? record.storagePath
            : undefined,
        created_at:
          typeof record.created_at === "string" && record.created_at.length > 0
            ? record.created_at
            : undefined
      } satisfies SongLayer;
    })
    .filter((layer): layer is SongLayer => Boolean(layer));
};

const normalizeSong = (song: SupabaseSongRow): Song => ({
  id: song.id,
  title: song.title ?? "Untitled Song",
  genre: song.genre ?? "Unknown",
  lyrics: song.lyrics ?? "",
  status: song.status ?? "draft",
  quality_score: toNumber(song.quality_score, 0),
  duration: toNumber(song.duration, 180),
  streams: toNumber(song.streams, 0),
  revenue: toNumber(song.revenue, 0),
  recording_cost: toNumber(song.recording_cost, 500),
  production_cost: toNumber(song.production_cost, 0),
  plays: toNumber(song.plays, 0),
  popularity: toNumber(song.popularity, 0),
  created_at: song.created_at ?? new Date().toISOString(),
  updated_at: song.updated_at ?? new Date().toISOString(),
  audio_layers: parseAudioLayers(song.audio_layers)
});

const formatDuration = (seconds: number | undefined): string => {
  if (!seconds || !Number.isFinite(seconds)) {
    return "0:00";
  }

  const totalSeconds = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = totalSeconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
};

const slugifyName = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");

const defaultEngineerName = "Self-produced";

const MusicCreation = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const gameData = useGameData();
  const {
    profile,
    skills,
    attributes,
    updateProfile,
    updateSkills,
    updateAttributes,
    refreshProgressionState,
    addActivity
  } = gameData;

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

  const [songs, setSongs] = useState<Song[]>([]);
  const [sessionsBySong, setSessionsBySong] = useState<Record<string, RecordingSession[]>>({});
  const [tracksBySession, setTracksBySession] = useState<Record<string, ProductionTrack[]>>({});
  const [loading, setLoading] = useState(true);
  const [creatingSong, setCreatingSong] = useState(false);
  const [newSong, setNewSong] = useState({ title: "", genre: "", lyrics: "", duration: 180 });
  const [localRecordings, setLocalRecordings] = useState<Record<string, LocalRecording[]>>({});
  const localRecordingsRef = useRef<Record<string, LocalRecording[]>>({});
  const [audioRecordingSongId, setAudioRecordingSongId] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [playingRecordingId, setPlayingRecordingId] = useState<string | null>(null);
  const [uploadingRecordingId, setUploadingRecordingId] = useState<string | null>(null);
  const [completingSessionId, setCompletingSessionId] = useState<string | null>(null);
  const [editingSong, setEditingSong] = useState<Song | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editSongForm, setEditSongForm] = useState({ title: "", genre: "", lyrics: "", duration: 180 });
  const [deletingSongId, setDeletingSongId] = useState<string | null>(null);

  const toneModuleRef = useRef<ToneModule | null>(null);
  const recorderRef = useRef<RecorderInstance | null>(null);
  const activeSessionRef = useRef<string | null>(null);
  const playerRefs = useRef<Record<string, TonePlayer>>({});

  const loadData = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    try {
      const [songsResponse, sessionsResponse] = await Promise.all([
        supabase
          .from("songs")
          .select("*")
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

      const fetchedSongs = (songsResponse.data as SupabaseSongRow[] | null)?.map(normalizeSong) ?? [];
      setSongs(fetchedSongs);

      const sessionMap: Record<string, RecordingSession[]> = {};
      const tracksMap: Record<string, ProductionTrack[]> = {};

      (sessionsResponse.data as (RecordingSession & { production_tracks?: ProductionTrack[] | null })[] | null)?.forEach(
        (session) => {
          sessionMap[session.song_id] = [...(sessionMap[session.song_id] ?? []), session];
          if (Array.isArray(session.production_tracks)) {
            tracksMap[session.id] = session.production_tracks;
          }
        }
      );

      setSessionsBySong(sessionMap);
      setTracksBySession(tracksMap);
    } catch (error) {
      console.error("Error loading music data:", error);
      toast({
        variant: "destructive",
        title: "Failed to load music studio",
        description: "We couldn't load your songs right now. Please try again."
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

  useEffect(() => {
    localRecordingsRef.current = localRecordings;
  }, [localRecordings]);

  useEffect(() => {
    return () => {
      const activeRecorder = recorderRef.current;
      const players = playerRefs.current;
      const recordings = localRecordingsRef.current;
      if (activeRecorder) {
        try {
          void activeRecorder.recorder.stop();
        } catch (error) {
          console.warn("Unable to stop recorder during cleanup", error);
        }
        activeRecorder.mic.disconnect?.();
        activeRecorder.mic.close?.();
        recorderRef.current = null;
      }

      Object.entries(players).forEach(([id, player]) => {
        player.stop?.();
        player.dispose?.();
        delete players[id];
      });
      playerRefs.current = {};

      Object.values(recordings).forEach((entries) => {
        entries.forEach((entry) => {
          if (typeof URL !== "undefined") {
            URL.revokeObjectURL(entry.url);
          }
        });
      });
    };
  }, []);

  const ensureToneModule = useCallback(async (): Promise<ToneModule | null> => {
    if (typeof window === "undefined") return null;

    if (!toneModuleRef.current) {
      // @ts-expect-error dynamic remote import handled at runtime
      const tone = (await import(/* @vite-ignore */ "https://esm.sh/tone@14.8.55")) as unknown as ToneModule;
      toneModuleRef.current = tone;
      if (tone.start) {
        await tone.start();
      }
    }

    if (toneModuleRef.current?.context?.state !== "running") {
      await toneModuleRef.current?.context?.resume?.();
    }

    return toneModuleRef.current;
  }, []);

  const calculateQuality = useCallback((): number => {
    const randomFactor = Math.random() * 20 - 10;

    if (!hasSkillLevels) {
      return Math.max(1, Math.min(100, Math.round(30 + randomFactor)));
    }

    const baseQuality =
      skillLevels.songwriting * 0.4 +
      skillLevels.guitar * 0.2 +
      skillLevels.vocals * 0.2 +
      skillLevels.performance * 0.1 +
      skillLevels.drums * 0.05 +
      skillLevels.bass * 0.05;

    return Math.max(1, Math.min(100, Math.round(baseQuality + randomFactor)));
  }, [hasSkillLevels, skillLevels]);

  const calculateRecordingCost = (quality: number): number => {
    const baseCost = 500;
    const qualityMultiplier = Math.max(0.6, quality / 50);
    return Math.round(baseCost * qualityMultiplier);
  };

  const getStageSessions = useCallback(
    (songId: string, stage: Stage) => (sessionsBySong[songId] ?? []).filter((session) => session.stage === stage),
    [sessionsBySong]
  );

  const getOrCreateRecordingSession = useCallback(
    async (song: Song): Promise<RecordingSession | null> => {
      if (!user) {
        toast({
          variant: "destructive",
          title: "Sign in required",
          description: "You need to be signed in to start recording."
        });
        return null;
      }

      const existingSessions = getStageSessions(song.id, "recording");
      const activeSession = existingSessions.find((session) => session.status !== "completed");
      if (activeSession) {
        if (activeSession.status !== "in_progress") {
          const { data, error } = await supabase
            .from("recording_sessions")
            .update({
              status: "in_progress",
              started_at: new Date().toISOString(),
              engineer_name: activeSession.engineer_name ?? defaultEngineerName
            })
            .eq("id", activeSession.id)
            .select()
            .single();

          if (error) throw error;

          const updatedSession = data as RecordingSession;
          setSessionsBySong((prev) => ({
            ...prev,
            [song.id]: (prev[song.id] ?? []).map((item) =>
              item.id === updatedSession.id ? updatedSession : item
            )
          }));
          activeSessionRef.current = updatedSession.id;
          return updatedSession;
        }

        activeSessionRef.current = activeSession.id;
        return activeSession;
      }

      const { data, error } = await supabase
        .from("recording_sessions")
        .insert({
          song_id: song.id,
          user_id: user.id,
          stage: "recording",
          status: "in_progress",
          engineer_name: defaultEngineerName,
          started_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;

      const newSession = data as RecordingSession;
      setSessionsBySong((prev) => ({
        ...prev,
        [song.id]: [newSession, ...(prev[song.id] ?? [])]
      }));
      activeSessionRef.current = newSession.id;
      return newSession;
    },
    [getStageSessions, toast, user]
  );

  const createSong = async () => {
    if (!newSong.title || !newSong.genre) {
      toast({
        variant: "destructive",
        title: "Missing information",
        description: "Please provide a song title and genre."
      });
      return;
    }

    setCreatingSong(true);
    try {
      const quality = calculateQuality();
      const recordingCost = calculateRecordingCost(quality);

      const { data, error } = await supabase
        .from("songs")
        .insert({
          title: newSong.title,
          genre: newSong.genre,
          lyrics: newSong.lyrics,
          duration: newSong.duration,
          artist_id: user?.id,
          quality_score: quality,
          recording_cost: recordingCost,
          status: "draft",
          audio_layers: []
        })
        .select()
        .single();

      if (error) throw error;

      const normalized = normalizeSong(data as SupabaseSongRow);
      setSongs((prev) => [normalized, ...prev]);
      setNewSong({ title: "", genre: "", lyrics: "", duration: 180 });

      await addActivity(
        "songwriting",
        `Created new song: "${normalized.title}" (Quality: ${quality}%)`,
        0
      );

      toast({
        title: "Song created",
        description: `"${normalized.title}" is ready for production.`
      });
    } catch (error) {
      console.error("Error creating song:", error);
      toast({
        variant: "destructive",
        title: "Creation failed",
        description: "We couldn't create the song. Please try again."
      });
    } finally {
      setCreatingSong(false);
    }
  };

  const startRecordingTake = async (song: Song) => {
    if (isRecording) {
      toast({
        variant: "destructive",
        title: "Recording already in progress",
        description: "Stop the current recording before starting a new take."
      });
      return;
    }

    try {
      const tone = await ensureToneModule();
      if (!tone) {
        toast({
          variant: "destructive",
          title: "Audio unavailable",
          description: "Audio recording is not supported in this environment."
        });
        return;
      }

      const session = await getOrCreateRecordingSession(song);
      if (!session) return;

      const recorder = new tone.Recorder();
      const mic = new tone.UserMedia();

      await mic.open();
      mic.connect(recorder);
      await recorder.start?.();

      recorderRef.current = { recorder, mic };
      setAudioRecordingSongId(song.id);
      setIsRecording(true);

      toast({
        title: "Recording started",
        description: `Tracking a new take for "${song.title}".`
      });
    } catch (error) {
      console.error("Error starting recording:", error);
      toast({
        variant: "destructive",
        title: "Recording failed",
        description: "We couldn't access your microphone."
      });
      setIsRecording(false);
      setAudioRecordingSongId(null);
    }
  };

  const computeRecordingDuration = async (blob: Blob): Promise<number> => {
    try {
      const module = toneModuleRef.current;
      if (module?.context?.decodeAudioData) {
        const arrayBuffer = await blob.arrayBuffer();
        const buffer = await module.context.decodeAudioData(arrayBuffer);
        return buffer.duration;
      }
    } catch (error) {
      console.warn("Unable to decode audio duration", error);
    }
    return 0;
  };

  const stopRecordingTake = async (song: Song) => {
    const activeRecorder = recorderRef.current;
    if (!activeRecorder) {
      setIsRecording(false);
      setAudioRecordingSongId(null);
      return;
    }

    try {
      const blob = await activeRecorder.recorder.stop();
      activeRecorder.mic.disconnect?.();
      await activeRecorder.mic.close?.();

      const url = typeof URL !== "undefined" ? URL.createObjectURL(blob) : "";
      const duration = await computeRecordingDuration(blob);
      const sessionId = activeSessionRef.current;
      const recordingId = `${sessionId ?? song.id}-${Date.now()}`;

      setLocalRecordings((prev) => {
        const entries = prev[song.id] ?? [];
        const newEntry: LocalRecording = {
          id: recordingId,
          sessionId: sessionId ?? "",
          name: `Take ${entries.length + 1}`,
          url,
          blob,
          duration,
          createdAt: new Date().toISOString()
        };
        return {
          ...prev,
          [song.id]: [...entries, newEntry]
        };
      });

      toast({
        title: "Take captured",
        description: `Saved a new take for "${song.title}". Review it before uploading.`
      });
    } catch (error) {
      console.error("Error stopping recording:", error);
      toast({
        variant: "destructive",
        title: "Recording error",
        description: "We couldn't finish this take. Please try again."
      });
    } finally {
      recorderRef.current = null;
      setIsRecording(false);
      setAudioRecordingSongId(null);
    }
  };

  const togglePlayback = async (recording: LocalRecording) => {
    if (playingRecordingId === recording.id) {
      const player = playerRefs.current[recording.id];
      player?.stop?.();
      player?.dispose?.();
      delete playerRefs.current[recording.id];
      setPlayingRecordingId(null);
      return;
    }

    try {
      const tone = await ensureToneModule();
      if (!tone) return;

      if (playingRecordingId) {
        const currentPlayer = playerRefs.current[playingRecordingId];
        currentPlayer?.stop?.();
        currentPlayer?.dispose?.();
        delete playerRefs.current[playingRecordingId];
        setPlayingRecordingId(null);
      }

      const player = new tone.Player({ url: recording.url, autostart: false }).toDestination?.();
      playerRefs.current[recording.id] = player ?? new tone.Player(recording.url);
      const activePlayer = playerRefs.current[recording.id];

      if (activePlayer.load) {
        await activePlayer.load(recording.url);
      }

      activePlayer.start?.();
      activePlayer.onstop = () => {
        activePlayer.dispose?.();
        delete playerRefs.current[recording.id];
        setPlayingRecordingId((current) => (current === recording.id ? null : current));
      };

      setPlayingRecordingId(recording.id);
    } catch (error) {
      console.error("Error playing recording:", error);
      toast({
        variant: "destructive",
        title: "Playback failed",
        description: "We couldn't play this take."
      });
    }
  };

  const updateLocalRecordingName = (songId: string, recordingId: string, name: string) => {
    setLocalRecordings((prev) => ({
      ...prev,
      [songId]: (prev[songId] ?? []).map((entry) =>
        entry.id === recordingId ? { ...entry, name } : entry
      )
    }));
  };

  const discardLocalRecording = (songId: string, recordingId: string) => {
    setLocalRecordings((prev) => {
      const entries = prev[songId] ?? [];
      const entry = entries.find((item) => item.id === recordingId);
      if (entry && typeof URL !== "undefined") {
        URL.revokeObjectURL(entry.url);
      }

      return {
        ...prev,
        [songId]: entries.filter((item) => item.id !== recordingId)
      };
    });

    if (playingRecordingId === recordingId) {
      const player = playerRefs.current[recordingId];
      player?.stop?.();
      player?.dispose?.();
      delete playerRefs.current[recordingId];
      setPlayingRecordingId(null);
    }
  };

  const uploadLocalRecording = async (song: Song, recording: LocalRecording) => {
    if (!user) return;

    const sessionId = recording.sessionId || activeSessionRef.current;
    if (!sessionId) {
      toast({
        variant: "destructive",
        title: "Session missing",
        description: "Start a recording session before uploading takes."
      });
      return;
    }

    const session = getStageSessions(song.id, "recording").find((item) => item.id === sessionId);
    if (!session) {
      toast({
        variant: "destructive",
        title: "Session not found",
        description: "The session for this take no longer exists."
      });
      return;
    }

    setUploadingRecordingId(recording.id);
    try {
      const takeCost = Math.round((song.recording_cost || 500) * 0.1);
      const baseQuality = song.quality_score;
      const skillBonus = hasSkillLevels
        ? (skillLevels.performance + skillLevels.vocals) / 15
        : 0;
      const qualityBoost = Math.max(1, Math.round(baseQuality / 20 + skillBonus + Math.random() * 4));
      const fileExtension = recording.blob.type.includes("mpeg") ? "mp3" : "webm";
      const storagePath = `${user.id}/${song.id}/${sessionId}/${slugifyName(recording.name || "take")}-${Date.now()}.${fileExtension}`;

      const { error: uploadError } = await supabase.storage
        .from("song-layers")
        .upload(storagePath, recording.blob, {
          contentType: recording.blob.type || "audio/webm"
        });

      if (uploadError) throw uploadError;

      const { data: publicData } = supabase.storage
        .from("song-layers")
        .getPublicUrl(storagePath);

      const publicUrl = publicData.publicUrl;
      const existingTracks = tracksBySession[sessionId] ?? [];
      const takeNumber = existingTracks.length + 1;

      const { data: insertedTrack, error: trackError } = await supabase
        .from("production_tracks")
        .insert({
          session_id: sessionId,
          song_id: song.id,
          user_id: user.id,
          stage: "recording",
          name: recording.name,
          take_number: takeNumber,
          storage_path: storagePath,
          public_url: publicUrl,
          duration_seconds: recording.duration,
          quality_rating: qualityBoost,
          cost: takeCost
        })
        .select()
        .single();

      if (trackError) throw trackError;

      const { data: updatedSession, error: sessionUpdateError } = await supabase
        .from("recording_sessions")
        .update({
          total_takes: session.total_takes + 1,
          total_cost: session.total_cost + takeCost,
          quality_gain: session.quality_gain + qualityBoost
        })
        .eq("id", sessionId)
        .select()
        .single();

      if (sessionUpdateError) throw sessionUpdateError;

      const newLayers = [...song.audio_layers, {
        name: recording.name,
        url: publicUrl,
        duration: recording.duration,
        storagePath,
        created_at: new Date().toISOString()
      } satisfies SongLayer];

      const { error: songError } = await supabase
        .from("songs")
        .update({ audio_layers: newLayers })
        .eq("id", song.id);

      if (songError) throw songError;

      setSongs((prev) => prev.map((item) =>
        item.id === song.id ? { ...item, audio_layers: newLayers } : item
      ));

      setSessionsBySong((prev) => ({
        ...prev,
        [song.id]: (prev[song.id] ?? []).map((item) =>
          item.id === sessionId ? (updatedSession as RecordingSession) : item
        )
      }));

      setTracksBySession((prev) => ({
        ...prev,
        [sessionId]: [...(prev[sessionId] ?? []), insertedTrack as ProductionTrack]
      }));

      discardLocalRecording(song.id, recording.id);

      toast({
        title: "Take uploaded",
        description: `Added "${recording.name}" to the session.`
      });
    } catch (error) {
      console.error("Error uploading recording:", error);
      toast({
        variant: "destructive",
        title: "Upload failed",
        description: "We couldn't upload this take. Please try again."
      });
    } finally {
      setUploadingRecordingId(null);
    }
  };

  const completeRecordingSession = async (song: Song, session: RecordingSession) => {
    if (!user) return;
    if (session.status === "completed") return;

    setCompletingSessionId(session.id);
    try {
      const completionTime = new Date().toISOString();
      const updatedQuality = song.quality_score + session.quality_gain;

      const { data: updatedSession, error: sessionError } = await supabase
        .from("recording_sessions")
        .update({
          status: "completed",
          completed_at: completionTime
        })
        .eq("id", session.id)
        .select()
        .single();

      if (sessionError) throw sessionError;

      const { error: songError } = await supabase
        .from("songs")
        .update({
          status: "recorded",
          quality_score: updatedQuality,
          recording_cost: session.total_cost,
          updated_at: completionTime
        })
        .eq("id", song.id);

      if (songError) throw songError;

      const attributeScores = extractAttributeScores(attributes);
      const recordingFocus: AttributeFocus = "songwriting";
      const experienceGain = Math.max(
        0,
        calculateExperienceReward(session.quality_gain * 5, attributeScores, recordingFocus)
      );

      const sessionDurationMinutes = (() => {
        if (session.started_at) {
          const started = new Date(session.started_at).getTime();
          const completed = new Date(completionTime).getTime();
          if (Number.isFinite(started) && Number.isFinite(completed) && completed > started) {
            return Math.max(1, Math.round((completed - started) / 60000));
          }
        }
        const durationField = (session as Record<string, unknown>).duration_minutes;
        if (typeof durationField === "number" && Number.isFinite(durationField) && durationField > 0) {
          return Math.round(durationField);
        }
        return null;
      })();

      const collaborators = (() => {
        if (Array.isArray((session as Record<string, unknown>).collaborators)) {
          return ((session as Record<string, unknown>).collaborators as unknown[])
            .map((entry) =>
              typeof entry === "string"
                ? entry
                : typeof entry === "object" && entry !== null && "name" in entry
                  ? String((entry as { name?: unknown }).name ?? "")
                  : ""
            )
            .filter((name) => name.length > 0);
        }

        const engineerName = typeof session.engineer_name === "string" ? session.engineer_name : null;
        return engineerName ? [engineerName] : [];
      })();

      await awardActionXp({
        amount: experienceGain,
        actionKey: `music_creation_${session.stage}`,
        metadata: {
          session_id: session.id,
          song_id: song.id,
          stage_type: session.stage,
          duration_minutes: sessionDurationMinutes,
          quality_gain: session.quality_gain,
          collaborators,
          professionalism_notes: session.notes ?? null
        },
        uniqueEventId: session.id
      });

      await refreshProgressionState();

      if (profile) {
        await updateProfile({
          cash: Math.max(0, (profile.cash ?? 0) - session.total_cost)
        });
      }

      if (hasSkillLevels) {
        await updateSkills({
          performance: Math.min(
            100,
            skillLevels.performance + Math.round(session.quality_gain / 4)
          ),
          vocals: Math.min(
            100,
            skillLevels.vocals + Math.round(session.total_takes / 2)
          )
        });
      }

      const attributeUpdates: Partial<Record<AttributeKey, number>> = {};
      const currentMusicality = attributeScores.musicality ?? 0;
      const currentCharisma = attributeScores.charisma ?? 0;

      const musicalityGain = Math.round(experienceGain * 0.6);
      const charismaGain = Math.round(experienceGain * 0.25);

      if (musicalityGain > 0) {
        attributeUpdates.musicality = Math.min(1000, Math.round(currentMusicality + musicalityGain));
      }

      if (charismaGain > 0) {
        attributeUpdates.charisma = Math.min(1000, Math.round(currentCharisma + charismaGain));
      }

      if (Object.keys(attributeUpdates).length > 0) {
        await updateAttributes(attributeUpdates);
      }

      await addActivity(
        "recording",
        `Completed recording session for "${song.title}"`,
        -session.total_cost
      );

      setSongs((prev) =>
        prev.map((item) =>
          item.id === song.id
            ? {
                ...item,
                status: "recorded",
                quality_score: updatedQuality,
                recording_cost: session.total_cost
              }
            : item
        )
      );

      setSessionsBySong((prev) => ({
        ...prev,
        [song.id]: (prev[song.id] ?? []).map((item) =>
          item.id === session.id ? (updatedSession as RecordingSession) : item
        )
      }));

      toast({
        title: "Recording session completed",
        description: `"${song.title}" is now ready for mixing.`
      });
    } catch (error) {
      console.error("Error completing session:", error);
      toast({
        variant: "destructive",
        title: "Unable to complete session",
        description: "Please try again."
      });
    } finally {
      setCompletingSessionId(null);
    }
  };

  const openEditDialog = (song: Song) => {
    setEditingSong(song);
    setEditSongForm({
      title: song.title,
      genre: song.genre,
      lyrics: song.lyrics,
      duration: song.duration
    });
    setIsEditDialogOpen(true);
  };

  const updateSong = async () => {
    if (!editingSong) return;
    if (!editSongForm.title || !editSongForm.genre) {
      toast({
        variant: "destructive",
        title: "Missing information",
        description: "Please provide a title and genre."
      });
      return;
    }

    try {
      const { error } = await supabase
        .from("songs")
        .update({
          title: editSongForm.title,
          genre: editSongForm.genre,
          lyrics: editSongForm.lyrics,
          duration: editSongForm.duration
        })
        .eq("id", editingSong.id);

      if (error) throw error;

      setSongs((prev) =>
        prev.map((item) =>
          item.id === editingSong.id
            ? {
                ...item,
                title: editSongForm.title,
                genre: editSongForm.genre,
                lyrics: editSongForm.lyrics,
                duration: editSongForm.duration
              }
            : item
        )
      );

      toast({
        title: "Song updated",
        description: `Saved changes to "${editSongForm.title}".`
      });

      setIsEditDialogOpen(false);
      setEditingSong(null);
      setEditSongForm({ title: "", genre: "", lyrics: "", duration: 180 });
    } catch (error) {
      console.error("Error updating song:", error);
      toast({
        variant: "destructive",
        title: "Update failed",
        description: "We couldn't save your changes."
      });
    }
  };

  const deleteSong = async (songId: string) => {
    setDeletingSongId(songId);
    try {
      const { error } = await supabase
        .from("songs")
        .delete()
        .eq("id", songId);

      if (error) throw error;

      setSongs((prev) => prev.filter((item) => item.id !== songId));
      setSessionsBySong((prev) => {
        const next = { ...prev };
        delete next[songId];
        return next;
      });
      setTracksBySession((prev) => {
        const next = { ...prev };
        Object.entries(prev).forEach(([sessionId, tracks]) => {
          if (tracks.some((track) => track.song_id === songId)) {
            delete next[sessionId];
          }
        });
        return next;
      });
      setLocalRecordings((prev) => {
        const next = { ...prev };
        const entries = next[songId];
        if (entries) {
          entries.forEach((entry) => {
            if (typeof URL !== "undefined") {
              URL.revokeObjectURL(entry.url);
            }
          });
        }
        delete next[songId];
        return next;
      });

      toast({
        title: "Song deleted",
        description: "Removed from your catalog."
      });
    } catch (error) {
      console.error("Error deleting song:", error);
      toast({
        variant: "destructive",
        title: "Delete failed",
        description: "We couldn't delete the song."
      });
    } finally {
      setDeletingSongId(null);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "draft":
        return "bg-yellow-500";
      case "recorded":
        return "bg-green-500";
      case "released":
        return "bg-blue-500";
      default:
        return "bg-gray-500";
    }
  };

  const getQualityColor = (quality: number) => {
    if (quality >= 80) return "text-purple-400";
    if (quality >= 60) return "text-blue-400";
    if (quality >= 40) return "text-green-400";
    if (quality >= 20) return "text-yellow-400";
    return "text-red-400";
  };

  const renderLocalRecordings = (song: Song) => {
    const recordings = localRecordings[song.id] ?? [];
    if (recordings.length === 0) return null;

    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Waves className="h-4 w-4 text-primary" />
          <span>Local takes (not yet uploaded)</span>
        </div>
        <div className="space-y-3">
          {recordings.map((recording) => (
            <div
              key={recording.id}
              className="flex flex-col gap-2 rounded-lg border border-border/50 p-3"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <Input
                  value={recording.name}
                  onChange={(event) => updateLocalRecordingName(song.id, recording.id, event.target.value)}
                  className="sm:max-w-xs"
                />
                <div className="text-xs text-muted-foreground">
                  Captured {new Date(recording.createdAt).toLocaleString()} • {formatDuration(recording.duration)}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => togglePlayback(recording)}
                >
                  {playingRecordingId === recording.id ? (
                    <Square className="mr-2 h-3.5 w-3.5" />
                  ) : (
                    <Play className="mr-2 h-3.5 w-3.5" />
                  )}
                  {playingRecordingId === recording.id ? "Stop" : "Preview"}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => uploadLocalRecording(song, recording)}
                  disabled={uploadingRecordingId === recording.id}
                >
                  {uploadingRecordingId === recording.id ? (
                    <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Upload className="mr-2 h-3.5 w-3.5" />
                  )}
                  {uploadingRecordingId === recording.id ? "Uploading" : "Upload"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => discardLocalRecording(song.id, recording.id)}
                >
                  <Trash2 className="mr-2 h-3.5 w-3.5" />
                  Discard
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary" />
          <p className="font-oswald text-lg">Loading music studio...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bebas tracking-wider">MUSIC STUDIO</h1>
        <p className="text-lg text-muted-foreground font-oswald">
          Capture takes, manage sessions, and shape your next release.
        </p>
        <div className="flex items-center justify-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <Coins className="h-4 w-4 text-yellow-400" />
            <span className="font-oswald">${profile?.cash?.toLocaleString() ?? 0}</span>
          </div>
          <div className="flex items-center gap-2">
            <Music className="h-4 w-4 text-blue-400" />
            <span className="font-oswald">{songs.length} Songs</span>
          </div>
        </div>
      </div>

      <Tabs defaultValue="create" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="create">Create New Song</TabsTrigger>
          <TabsTrigger value="catalog">Song Catalog</TabsTrigger>
        </TabsList>

        <TabsContent value="create" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="font-bebas text-2xl">NEW SONG CREATION</CardTitle>
              <CardDescription>Channel your creativity and prepare the next hit.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Song Title</label>
                  <Input
                    placeholder="Enter song title"
                    value={newSong.title}
                    onChange={(event) => setNewSong((prev) => ({ ...prev, title: event.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Genre</label>
                  <Select
                    value={newSong.genre}
                    onValueChange={(value) => setNewSong((prev) => ({ ...prev, genre: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select genre" />
                    </SelectTrigger>
                    <SelectContent>
                      {genres.map((genre) => (
                        <SelectItem key={genre} value={genre}>
                          {genre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Lyrics (optional)</label>
                <Textarea
                  rows={6}
                  placeholder="Write your lyrics here"
                  value={newSong.lyrics}
                  onChange={(event) => setNewSong((prev) => ({ ...prev, lyrics: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Duration (seconds)</label>
                <Input
                  type="number"
                  min={30}
                  max={600}
                  value={newSong.duration}
                  onChange={(event) =>
                    setNewSong((prev) => ({
                      ...prev,
                      duration: Number.parseInt(event.target.value, 10) || 180
                    }))
                  }
                />
              </div>
              {hasSkillLevels && (
                <div className="rounded-lg bg-muted p-4">
                  <h4 className="font-medium">Estimated Quality: {calculateQuality()}%</h4>
                  <p className="text-sm text-muted-foreground">
                    Based on songwriting {skillLevels.songwriting}/100 and overall performance skill.
                  </p>
                </div>
              )}
              <Button
                onClick={createSong}
                disabled={creatingSong || !newSong.title || !newSong.genre}
                className="w-full"
              >
                {creatingSong ? "Creating..." : "Create Song"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="catalog" className="space-y-4">
          {songs.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Music className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
                <h3 className="mb-2 text-lg font-medium">No Songs Yet</h3>
                <p className="text-muted-foreground">Create your first song to get started.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {songs.map((song) => {
                const recordingSessions = getStageSessions(song.id, "recording");
                const activeSession = recordingSessions.find((session) => session.status !== "completed");
                const completedSessions = recordingSessions.filter((session) => session.status === "completed");

                return (
                  <Card key={song.id} className="relative space-y-4">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="font-oswald text-lg">{song.title}</CardTitle>
                          <CardDescription>
                            {song.genre} • {formatDuration(song.duration)}
                          </CardDescription>
                        </div>
                        <Badge className={`${getStatusColor(song.status)} text-white capitalize`}>
                          {song.status}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-5">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span>Quality</span>
                          <span className={`font-mono ${getQualityColor(song.quality_score)}`}>
                            {song.quality_score}%
                          </span>
                        </div>
                        <Progress value={song.quality_score} className="h-2" />
                      </div>

                      {song.lyrics && (
                        <div className="max-h-24 overflow-y-auto rounded bg-muted p-3 text-xs text-muted-foreground">
                          {song.lyrics}
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div className="flex items-center gap-2">
                          <Volume2 className="h-4 w-4 text-blue-400" />
                          <span>{song.plays.toLocaleString()} plays</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Star className="h-4 w-4 text-yellow-400" />
                          <span>{song.popularity} popularity</span>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="flex flex-wrap gap-2">
                          <Button
                            onClick={() =>
                              audioRecordingSongId === song.id && isRecording
                                ? stopRecordingTake(song)
                                : startRecordingTake(song)
                            }
                            disabled={uploadingRecordingId !== null}
                            className="flex-1"
                            variant="default"
                          >
                            {audioRecordingSongId === song.id && isRecording ? (
                              <Square className="mr-2 h-4 w-4" />
                            ) : (
                              <Mic className="mr-2 h-4 w-4" />
                            )}
                            {audioRecordingSongId === song.id && isRecording
                              ? "Stop Recording"
                              : "Record Take"}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEditDialog(song)}
                          >
                            <Pencil className="mr-1 h-4 w-4" />
                            Edit
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => deleteSong(song.id)}
                            disabled={deletingSongId === song.id}
                          >
                            <Trash2 className="mr-1 h-4 w-4" />
                            {deletingSongId === song.id ? "Deleting" : "Delete"}
                          </Button>
                        </div>

                        {renderLocalRecordings(song)}

                        <div className="space-y-3">
                          <div className="flex items-center gap-2 text-sm font-medium">
                            <Disc className="h-4 w-4 text-primary" />
                            <span>Committed layers</span>
                          </div>
                          {song.audio_layers.length === 0 ? (
                            <p className="text-sm text-muted-foreground">
                              No uploaded layers yet. Capture and upload takes to build your session.
                            </p>
                          ) : (
                            <ul className="space-y-2 text-sm">
                              {song.audio_layers.map((layer) => (
                                <li key={`${layer.storagePath}-${layer.url}`} className="flex justify-between rounded border border-border/40 px-3 py-2">
                                  <span>{layer.name}</span>
                                  <span className="text-xs text-muted-foreground">
                                    {formatDuration(layer.duration)}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>

                        {activeSession && (
                          <div className="space-y-3 rounded-lg border border-border/60 p-3">
                            <div className="flex items-center justify-between">
                              <div className="text-sm font-semibold">Active Recording Session</div>
                              <Badge variant="outline" className="capitalize">
                                {activeSession.status}
                              </Badge>
                            </div>
                            <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-3">
                              <div>
                                <div className="font-medium">Takes</div>
                                <div>{activeSession.total_takes}</div>
                              </div>
                              <div>
                                <div className="font-medium">Quality gain</div>
                                <div>+{activeSession.quality_gain}</div>
                              </div>
                              <div>
                                <div className="font-medium">Cost</div>
                                <div>${activeSession.total_cost.toLocaleString()}</div>
                              </div>
                            </div>
                            <Button
                              variant="secondary"
                              onClick={() => completeRecordingSession(song, activeSession)}
                              disabled={completingSessionId === activeSession.id || activeSession.total_takes === 0}
                            >
                              {completingSessionId === activeSession.id ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              ) : (
                                <Disc className="mr-2 h-4 w-4" />
                              )}
                              {completingSessionId === activeSession.id
                                ? "Completing"
                                : "Commit Recording Session"}
                            </Button>
                          </div>
                        )}

                        {completedSessions.length > 0 && (
                          <div className="space-y-2 text-xs text-muted-foreground">
                            <div className="font-semibold text-sm text-foreground">Past Sessions</div>
                            {completedSessions.map((session) => (
                              <div key={session.id} className="rounded border border-border/40 p-2">
                                <div className="flex items-center justify-between">
                                  <span>
                                    {stageLabels[session.stage]} • {session.total_takes} takes • +{session.quality_gain} quality
                                  </span>
                                  {session.completed_at && (
                                    <span>{new Date(session.completed_at).toLocaleDateString()}</span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog
        open={isEditDialogOpen}
        onOpenChange={(open) => {
          setIsEditDialogOpen(open);
          if (!open) {
            setEditingSong(null);
            setEditSongForm({ title: "", genre: "", lyrics: "", duration: 180 });
          }
        }}
      >
        <DialogContent>
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              await updateSong();
            }}
            className="space-y-6"
          >
            <DialogHeader>
              <DialogTitle>Edit Song</DialogTitle>
              <DialogDescription>
                Update your song details before moving to the next production stage.
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Title</label>
                <Input
                  value={editSongForm.title}
                  onChange={(event) => setEditSongForm((prev) => ({ ...prev, title: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Genre</label>
                <Select
                  value={editSongForm.genre}
                  onValueChange={(value) => setEditSongForm((prev) => ({ ...prev, genre: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select genre" />
                  </SelectTrigger>
                  <SelectContent>
                    {genres.map((genre) => (
                      <SelectItem key={genre} value={genre}>
                        {genre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Lyrics</label>
              <Textarea
                rows={6}
                value={editSongForm.lyrics}
                onChange={(event) => setEditSongForm((prev) => ({ ...prev, lyrics: event.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Duration (seconds)</label>
              <Input
                type="number"
                min={30}
                max={600}
                value={editSongForm.duration}
                onChange={(event) =>
                  setEditSongForm((prev) => ({
                    ...prev,
                    duration: Number.parseInt(event.target.value, 10) || 180
                  }))
                }
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!editSongForm.title || !editSongForm.genre}>
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MusicCreation;
