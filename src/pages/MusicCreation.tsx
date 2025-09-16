import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Music,
  Play,
  Pause,
  Trash2,
  Star,
  Coins,
  Volume2,
  Mic,
  Square,
  Waveform,
  Loader2,
  Upload,
  Layers,
} from "lucide-react";

interface Song {
  id: string;
  title: string;
  genre: string;
  lyrics: string;
  status: string;
  quality_score: number;
  recording_cost: number;
  popularity: number;
  plays: number;
  duration: number;
  created_at: string;
  audio_layers?: SongLayer[];
}

interface SongLayer {
  name: string;
  url: string;
  duration?: number;
  storagePath?: string;
  created_at?: string;
}

interface LocalRecording {
  name: string;
  url: string;
  blob: Blob;
  duration: number;
}

type SupabaseSongRow = {
  id: string;
  title?: string | null;
  genre?: string | null;
  lyrics?: string | null;
  status?: string | null;
  quality_score?: number | null;
  recording_cost?: number | null;
  production_cost?: number | null;
  popularity?: number | null;
  plays?: number | null;
  streams?: number | null;
  duration?: number | null;
  created_at?: string | null;
  audio_layers?: unknown;
};

type ProfileInfo = { cash?: number | null } & Record<string, unknown>;

interface ToneRecorder {
  start?: () => Promise<void>;
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
  loaded?: () => Promise<void>;
  load?: (url: string) => Promise<void>;
  toDestination?: () => TonePlayer;
}

interface ToneModule {
  start?: () => Promise<void>;
  context?: {
    state?: string;
    resume?: () => Promise<void>;
  };
  UserMedia: new () => ToneUserMedia;
  Recorder: new () => ToneRecorder;
  Player: new (options: { url: string; autostart?: boolean } | string) => TonePlayer;
}

type RecorderInstance = {
  recorder: ToneRecorder;
  mic: ToneUserMedia;
};

interface PlayerSkills {
  guitar: number;
  vocals: number;
  drums: number;
  bass: number;
  performance: number;
  songwriting: number;
}

const toNumber = (value: unknown, fallback = 0): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const parseAudioLayers = (layers: SupabaseSongRow["audio_layers"]): SongLayer[] => {
  if (!Array.isArray(layers)) {
    return [];
  }

  return (layers as unknown[])
    .map((layer, index: number) => {
      if (typeof layer !== "object" || layer === null) return null;

      const layerRecord = layer as Record<string, unknown>;
      const url = typeof layerRecord.url === "string" ? layerRecord.url : "";
      if (!url) return null;

      return {
        name:
          typeof layerRecord.name === "string" && layerRecord.name.trim().length > 0
            ? layerRecord.name
            : `Layer ${index + 1}`,
        url,
        duration:
          typeof layerRecord.duration === "number" && Number.isFinite(layerRecord.duration)
            ? layerRecord.duration
            : undefined,
        storagePath:
          typeof layerRecord.storagePath === "string" && layerRecord.storagePath.length > 0
            ? layerRecord.storagePath
            : undefined,
        created_at:
          typeof layerRecord.created_at === "string" && layerRecord.created_at.length > 0
            ? layerRecord.created_at
            : undefined,
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
  recording_cost: toNumber(song.recording_cost ?? song.production_cost, 0),
  popularity: toNumber(song.popularity, 0),
  plays: toNumber(song.plays ?? song.streams, 0),
  duration: toNumber(song.duration, 0),
  created_at: song.created_at ?? new Date().toISOString(),
  audio_layers: parseAudioLayers(song.audio_layers),
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

const MusicCreation = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [songs, setSongs] = useState<Song[]>([]);
  const [skills, setSkills] = useState<PlayerSkills | null>(null);
  const [profile, setProfile] = useState<ProfileInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [recordingSession, setRecordingSession] = useState(false);
  const [audioRecordingSongId, setAudioRecordingSongId] = useState<string | null>(null);
  const [localRecordings, setLocalRecordings] = useState<Record<string, LocalRecording[]>>({});
  const [uploadingLayer, setUploadingLayer] = useState<string | null>(null);
  const [previewSongId, setPreviewSongId] = useState<string | null>(null);
  const [previewLoadingSongId, setPreviewLoadingSongId] = useState<string | null>(null);

  const toneRef = useRef<ToneModule | null>(null);
  const toneLoadPromiseRef = useRef<Promise<ToneModule | null> | null>(null);
  const recorderRef = useRef<RecorderInstance | null>(null);
  const previewPlayersRef = useRef<TonePlayer[]>([]);
  const previewTimeoutRef = useRef<number | null>(null);
  const localRecordingsRef = useRef<Record<string, LocalRecording[]>>({});

  const loadTone = useCallback(async (): Promise<ToneModule | null> => {
    if (toneRef.current) {
      return toneRef.current;
    }

    if (typeof window === "undefined") {
      return null;
    }

    const existingTone = window.Tone as ToneModule | undefined;
    if (existingTone) {
      toneRef.current = existingTone;
      return existingTone;
    }

    if (toneLoadPromiseRef.current) {
      return toneLoadPromiseRef.current;
    }

    toneLoadPromiseRef.current = new Promise<ToneModule | null>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/tone@14.7.77/build/Tone.min.js";
      script.async = true;
      script.onload = () => {
        toneLoadPromiseRef.current = null;
        const loadedTone = window.Tone as ToneModule | undefined;
        if (loadedTone) {
          toneRef.current = loadedTone;
          resolve(loadedTone);
        } else {
          reject(new Error("Tone.js failed to load"));
        }
      };
      script.onerror = () => {
        toneLoadPromiseRef.current = null;
        reject(new Error("Failed to load Tone.js"));
      };
      document.body.appendChild(script);
    });

    return toneLoadPromiseRef.current;
  }, []);

  const stopPreview = useCallback(() => {
    if (typeof window !== "undefined" && previewTimeoutRef.current) {
      window.clearTimeout(previewTimeoutRef.current);
      previewTimeoutRef.current = null;
    }

    previewPlayersRef.current.forEach((player) => {
      try {
        player.stop?.();
      } catch (error) {
        console.error("Error stopping player", error);
      }
      try {
        player.dispose?.();
      } catch (error) {
        console.error("Error disposing player", error);
      }
    });

    previewPlayersRef.current = [];
    setPreviewSongId(null);
    setPreviewLoadingSongId(null);
  }, []);

  useEffect(() => {
    localRecordingsRef.current = localRecordings;
  }, [localRecordings]);

  useEffect(() => {
    return () => {
      stopPreview();

      if (recorderRef.current?.mic?.close) {
        try {
          recorderRef.current.mic.close();
        } catch (error) {
          console.error("Error closing microphone", error);
        }
      }
      recorderRef.current = null;

      if (typeof URL !== "undefined" && typeof URL.revokeObjectURL === "function") {
        Object.values(localRecordingsRef.current).forEach((layers) => {
          layers.forEach((layer) => {
            URL.revokeObjectURL(layer.url);
          });
        });
      }
    };
  }, [stopPreview]);

  const getAudioDuration = useCallback((url: string): Promise<number> => {
    if (typeof document === "undefined") {
      return Promise.resolve(0);
    }

    return new Promise((resolve) => {
      const audio = document.createElement("audio");
      const cleanup = () => {
        audio.removeEventListener("loadedmetadata", onLoadedMetadata);
        audio.removeEventListener("error", onError);
      };

      const onLoadedMetadata = () => {
        const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
        cleanup();
        resolve(duration);
      };

      const onError = () => {
        cleanup();
        resolve(0);
      };

      audio.preload = "metadata";
      audio.addEventListener("loadedmetadata", onLoadedMetadata);
      audio.addEventListener("error", onError);
      audio.src = url;
    });
  }, []);

  const startAudioRecording = useCallback(
    async (songId: string) => {
      if (audioRecordingSongId && audioRecordingSongId !== songId) {
        toast({
          title: "Finish current recording",
          description: "Stop the ongoing recording before starting a new one.",
        });
        return;
      }

      try {
        const Tone = await loadTone();
        if (!Tone) {
          throw new Error("Tone.js is unavailable");
        }

        stopPreview();

        if (Tone.start) {
          await Tone.start();
        } else if (Tone.context?.state === "suspended") {
          await Tone.context.resume();
        }

        const mic = new Tone.UserMedia();
        await mic.open();

        const recorder = new Tone.Recorder();
        mic.connect(recorder);

        recorderRef.current = { recorder, mic };
        await recorder.start?.();
        setAudioRecordingSongId(songId);
      } catch (error) {
        console.error("Error starting audio recording:", error);
        toast({
          variant: "destructive",
          title: "Microphone unavailable",
          description: "We couldn't access your microphone. Please check permissions and try again.",
        });

        if (recorderRef.current?.mic?.close) {
          try {
            recorderRef.current.mic.close();
          } catch (closeError) {
            console.error("Error closing microphone after failure:", closeError);
          }
        }
        recorderRef.current = null;
        setAudioRecordingSongId(null);
      }
    },
    [audioRecordingSongId, loadTone, stopPreview, toast]
  );

  const stopAudioRecording = useCallback(
    async (song: Song) => {
      const activeRecorder = recorderRef.current;
      if (!activeRecorder) {
        setAudioRecordingSongId(null);
        return;
      }

      try {
        const { recorder, mic } = activeRecorder;
        const recording: Blob = await recorder.stop();
        mic.disconnect?.();
        if (mic.close) {
          await mic.close();
        }
        recorderRef.current = null;

        const objectUrl = URL.createObjectURL(recording);
        const duration = await getAudioDuration(objectUrl);
        const pendingLayers = localRecordingsRef.current[song.id] ?? [];
        const layerName = `Layer ${(song.audio_layers?.length ?? 0) + pendingLayers.length + 1}`;

        setLocalRecordings((prev) => ({
          ...prev,
          [song.id]: [...(prev[song.id] ?? []), { name: layerName, url: objectUrl, blob: recording, duration }],
        }));

        toast({
          title: "Layer captured",
          description: "Preview and save your new recording from the layers panel.",
        });
      } catch (error) {
        console.error("Error finalizing recording:", error);
        toast({
          variant: "destructive",
          title: "Recording failed",
          description: "We couldn't capture the audio. Please try again.",
        });

        if (recorderRef.current?.mic?.close) {
          try {
            recorderRef.current.mic.close();
          } catch (closeError) {
            console.error("Error closing microphone after failure:", closeError);
          }
        }
        recorderRef.current = null;
      } finally {
        setAudioRecordingSongId(null);
      }
    },
    [getAudioDuration, toast]
  );

  const discardLocalLayer = useCallback(
    (songId: string, index: number) => {
      const existingLayers = localRecordingsRef.current[songId] ?? [];
      const targetLayer = existingLayers[index];
      if (targetLayer) {
        stopPreview();
        if (typeof URL !== "undefined" && typeof URL.revokeObjectURL === "function") {
          URL.revokeObjectURL(targetLayer.url);
        }
      }

      setLocalRecordings((prev) => {
        const songLayers = prev[songId] ?? [];
        const filteredLayers = songLayers.filter((_, i) => i !== index);
        const nextLayers = { ...prev };
        if (filteredLayers.length > 0) {
          nextLayers[songId] = filteredLayers;
        } else {
          delete nextLayers[songId];
        }
        return nextLayers;
      });
    },
    [stopPreview]
  );

  const saveRecordedLayer = useCallback(
    async (song: Song, layer: LocalRecording, index: number) => {
      if (!user) {
        toast({
          variant: "destructive",
          title: "Sign in required",
          description: "You need to be logged in to store recordings.",
        });
        return;
      }

      stopPreview();

      const identifier = `${song.id}-${index}`;
      setUploadingLayer(identifier);

      try {
        const extension = layer.blob.type.includes("wav")
          ? "wav"
          : layer.blob.type.includes("mp3")
          ? "mp3"
          : layer.blob.type.includes("ogg")
          ? "ogg"
          : "webm";

        const sanitizedName = slugifyName(layer.name) || "layer";
        const storagePath = `${user.id}/${song.id}/${Date.now()}-${sanitizedName}.${extension}`;

        const { error: uploadError } = await supabase.storage
          .from("song-recordings")
          .upload(storagePath, layer.blob, {
            contentType: layer.blob.type,
            upsert: true,
          });

        if (uploadError) {
          throw uploadError;
        }

        const { data: publicUrlData } = supabase.storage.from("song-recordings").getPublicUrl(storagePath);

        if (!publicUrlData?.publicUrl) {
          throw new Error("Unable to obtain public URL for uploaded audio");
        }

        const newLayer: SongLayer = {
          name: layer.name,
          url: publicUrlData.publicUrl,
          duration: Number.isFinite(layer.duration) ? Number(layer.duration.toFixed(2)) : undefined,
          storagePath,
          created_at: new Date().toISOString(),
        };

        const updatedLayers = [...(song.audio_layers ?? []), newLayer];

        const { data: updatedSongData, error: updateError } = await supabase
          .from("songs")
          .update({ audio_layers: updatedLayers })
          .eq("id", song.id)
          .select()
          .single();

        if (updateError) {
          throw updateError;
        }

        const normalizedSong = normalizeSong(updatedSongData as SupabaseSongRow);

        setSongs((prev) => prev.map((s) => (s.id === song.id ? normalizedSong : s)));

        setLocalRecordings((prev) => {
          const songLayers = prev[song.id] ?? [];
          const filteredLayers = songLayers.filter((_, i) => i !== index);
          const nextLayers = { ...prev };
          if (filteredLayers.length > 0) {
            nextLayers[song.id] = filteredLayers;
          } else {
            delete nextLayers[song.id];
          }
          return nextLayers;
        });

        if (typeof URL !== "undefined" && typeof URL.revokeObjectURL === "function") {
          URL.revokeObjectURL(layer.url);
        }

        toast({
          title: "Layer saved",
          description: `${layer.name} was uploaded and linked to ${song.title}.`,
        });
      } catch (error) {
        console.error("Error saving recorded layer:", error);
        toast({
          variant: "destructive",
          title: "Upload failed",
          description: "We couldn't save this take. Please try again.",
        });
      } finally {
        setUploadingLayer(null);
      }
    },
    [stopPreview, toast, user]
  );

  const togglePreviewMix = useCallback(
    async (song: Song) => {
      if (previewSongId === song.id) {
        stopPreview();
        return;
      }

      stopPreview();

      const storedLayers = Array.isArray(song.audio_layers) ? song.audio_layers : [];
      const pendingLayersForSong = localRecordings[song.id] ?? [];
      const combinedLayers: SongLayer[] = [
        ...storedLayers,
        ...pendingLayersForSong.map((layer) => ({
          name: layer.name,
          url: layer.url,
          duration: layer.duration,
        })),
      ];

      if (combinedLayers.length === 0) {
        toast({
          title: "No layers to preview",
          description: "Record or upload a layer to hear a mix preview.",
        });
        return;
      }

      try {
        setPreviewLoadingSongId(song.id);
        const Tone = await loadTone();
        if (!Tone) {
          throw new Error("Tone.js is unavailable");
        }

        if (Tone.start) {
          await Tone.start();
        } else if (Tone.context?.state === "suspended") {
          await Tone.context.resume();
        }

        const players: TonePlayer[] = [];
        for (const layer of combinedLayers) {
          const playerSource = new Tone.Player({ url: layer.url, autostart: false });
          const destinationPlayer = playerSource.toDestination ? playerSource.toDestination() : playerSource;
          if (destinationPlayer.loaded) {
            await destinationPlayer.loaded();
          } else if (destinationPlayer.load) {
            await destinationPlayer.load(layer.url);
          }
          players.push(destinationPlayer);
        }

        previewPlayersRef.current = players;
        setPreviewSongId(song.id);
        players.forEach((player) => {
          player.start?.();
        });

        const longestDuration = Math.max(
          0,
          ...combinedLayers.map((layer) =>
            layer.duration && Number.isFinite(layer.duration) ? layer.duration : 0
          )
        );

        if (longestDuration > 0 && typeof window !== "undefined") {
          if (previewTimeoutRef.current) {
            window.clearTimeout(previewTimeoutRef.current);
          }
          previewTimeoutRef.current = window.setTimeout(() => {
            stopPreview();
          }, Math.ceil(longestDuration * 1000) + 500);
        }
      } catch (error) {
        console.error("Error preparing preview mix:", error);
        toast({
          variant: "destructive",
          title: "Preview failed",
          description: "We couldn't start playback. Please try again.",
        });
        stopPreview();
      } finally {
        setPreviewLoadingSongId(null);
      }
    },
    [loadTone, localRecordings, previewSongId, stopPreview, toast]
  );

  const [newSong, setNewSong] = useState({
    title: "",
    genre: "",
    lyrics: "",
    duration: 180
  });

  const genres = [
    "Rock", "Pop", "Hip Hop", "Electronic", "Jazz", "Blues", "Country", 
    "Metal", "Punk", "Alternative", "Indie", "Classical", "Folk", "R&B"
  ];

  const fetchData = useCallback(async () => {
    try {
      const [songsResponse, skillsResponse, profileResponse] = await Promise.all([
        supabase.from("songs").select("*").eq("artist_id", user?.id).order("created_at", { ascending: false }),
        supabase.from("player_skills").select("*").eq("user_id", user?.id).single(),
        supabase.from("profiles").select("*").eq("user_id", user?.id).single()
      ]);

      if (songsResponse.data) {
        const rawSongs = songsResponse.data as SupabaseSongRow[];
        setSongs(rawSongs.map(normalizeSong));
      }
      if (skillsResponse.data) setSkills(skillsResponse.data as PlayerSkills);
      if (profileResponse.data) setProfile(profileResponse.data as ProfileInfo);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [fetchData, user]);

  const calculateQuality = (): number => {
    if (!skills) return 30;
    
    const baseQuality = (skills.songwriting * 0.4 + skills.guitar * 0.2 + skills.vocals * 0.2 + 
                        skills.performance * 0.1 + skills.drums * 0.05 + skills.bass * 0.05);
    
    // Add randomness and ensure it's between 1-100
    const randomFactor = Math.random() * 20 - 10; // -10 to +10
    return Math.max(1, Math.min(100, Math.round(baseQuality + randomFactor)));
  };

  const calculateRecordingCost = (quality: number): number => {
    const baseCost = 500;
    const qualityMultiplier = quality / 50; // Higher quality = higher cost
    return Math.round(baseCost * qualityMultiplier);
  };

  const createSong = async () => {
    if (!newSong.title || !newSong.genre) {
      toast({
        variant: "destructive",
        title: "Missing Information",
        description: "Please provide a title and genre for your song."
      });
      return;
    }

    setCreating(true);

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

      // Add XP for songwriting
      const xpGain = Math.round(quality / 10);
      await supabase
        .from("player_skills")
        .update({
          songwriting: Math.min(100, (skills?.songwriting || 0) + xpGain)
        })
        .eq("user_id", user?.id);

      // Add activity
      await supabase
        .from("activity_feed")
        .insert({
          user_id: user?.id,
          activity_type: "songwriting",
          message: `Created new song: "${newSong.title}" (Quality: ${quality}%)`,
          earnings: 0
        });

      if (data) {
        const normalized = normalizeSong(data as SupabaseSongRow);
        setSongs(prev => [normalized, ...prev]);
      }
      setNewSong({ title: "", genre: "", lyrics: "", duration: 180 });
      
      toast({
        title: "Song Created!",
        description: `"${newSong.title}" was created with ${quality}% quality. +${xpGain} Songwriting XP!`
      });

    } catch (error) {
      console.error("Error creating song:", error);
      toast({
        variant: "destructive",
        title: "Creation Failed",
        description: "Failed to create song. Please try again."
      });
    } finally {
      setCreating(false);
    }
  };

  const recordSong = async (song: Song) => {
    if ((profile?.cash || 0) < song.recording_cost) {
      toast({
        variant: "destructive",
        title: "Insufficient Funds",
        description: `You need $${song.recording_cost} to record this song.`
      });
      return;
    }

    setRecordingSession(true);

    try {
      // Update song status and profile cash
      const [songUpdate, profileUpdate] = await Promise.all([
        supabase
          .from("songs")
          .update({ status: "recorded" })
          .eq("id", song.id),
        supabase
          .from("profiles")
          .update({ cash: (profile?.cash || 0) - song.recording_cost })
          .eq("user_id", user?.id)
      ]);

      if (songUpdate.error) throw songUpdate.error;
      if (profileUpdate.error) throw profileUpdate.error;

      // Add recording XP to multiple skills
      const performanceXP = Math.round(song.quality_score / 15);
      const vocalXP = Math.round(song.quality_score / 20);
      
      await supabase
        .from("player_skills")
        .update({
          performance: Math.min(100, (skills?.performance || 0) + performanceXP),
          vocals: Math.min(100, (skills?.vocals || 0) + vocalXP)
        })
        .eq("user_id", user?.id);

      // Add activity
      await supabase
        .from("activity_feed")
        .insert({
          user_id: user?.id,
          activity_type: "recording",
          message: `Recorded "${song.title}" in the studio`,
          earnings: -song.recording_cost
        });

      // Update local state
      setSongs(prev => prev.map(s => s.id === song.id ? { ...s, status: "recorded" } : s));
      setProfile(prev => prev ? { ...prev, cash: prev.cash - song.recording_cost } : null);

      toast({
        title: "Recording Complete!",
        description: `"${song.title}" has been recorded and is ready for release!`
      });

    } catch (error) {
      console.error("Error recording song:", error);
      toast({
        variant: "destructive",
        title: "Recording Failed",
        description: "Failed to record song. Please try again."
      });
    } finally {
      setRecordingSession(false);
    }
  };

  const deleteSong = async (songId: string) => {
    try {
      const { error } = await supabase
        .from("songs")
        .delete()
        .eq("id", songId);

      if (error) throw error;

      if (previewSongId === songId) {
        stopPreview();
      }

      if (audioRecordingSongId === songId) {
        setAudioRecordingSongId(null);
        const activeRecorder = recorderRef.current;
        if (activeRecorder) {
          try {
            await activeRecorder.recorder.stop();
          } catch (error) {
            console.error("Error stopping recorder during deletion:", error);
          }
          try {
            activeRecorder.mic.disconnect?.();
          } catch (error) {
            console.error("Error disconnecting mic during deletion:", error);
          }
          if (activeRecorder.mic?.close) {
            try {
              await activeRecorder.mic.close();
            } catch (error) {
              console.error("Error closing mic during deletion:", error);
            }
          }
        }
        recorderRef.current = null;
      }

      setLocalRecordings((prev) => {
        const next = { ...prev };
        const layers = next[songId];
        if (layers && typeof URL !== "undefined" && typeof URL.revokeObjectURL === "function") {
          layers.forEach((layer) => URL.revokeObjectURL(layer.url));
        }
        delete next[songId];
        return next;
      });

      setSongs(prev => prev.filter(s => s.id !== songId));

      toast({
        title: "Song Deleted",
        description: "The song has been removed from your catalog."
      });

    } catch (error) {
      console.error("Error deleting song:", error);
      toast({
        variant: "destructive",
        title: "Delete Failed",
        description: "Failed to delete song. Please try again."
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "draft": return "bg-yellow-500";
      case "recorded": return "bg-green-500";
      case "released": return "bg-blue-500";
      default: return "bg-gray-500";
    }
  };

  const getQualityColor = (quality: number) => {
    if (quality >= 80) return "text-purple-400";
    if (quality >= 60) return "text-blue-400";
    if (quality >= 40) return "text-green-400";
    if (quality >= 20) return "text-yellow-400";
    return "text-red-400";
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-lg font-oswald">Loading music studio...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bebas tracking-wider">MUSIC STUDIO</h1>
        <p className="text-lg text-muted-foreground font-oswald">
          Create, record, and manage your musical masterpieces
        </p>
        <div className="flex items-center justify-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <Coins className="h-4 w-4 text-yellow-400" />
            <span className="font-oswald">${profile?.cash?.toLocaleString() || 0}</span>
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
              <CardDescription>
                Channel your creativity and write your next hit
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Song Title</label>
                  <Input
                    placeholder="Enter song title..."
                    value={newSong.title}
                    onChange={(e) => setNewSong(prev => ({ ...prev, title: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Genre</label>
                  <Select value={newSong.genre} onValueChange={(value) => setNewSong(prev => ({ ...prev, genre: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select genre" />
                    </SelectTrigger>
                    <SelectContent>
                      {genres.map(genre => (
                        <SelectItem key={genre} value={genre}>{genre}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Lyrics (Optional)</label>
                <Textarea
                  placeholder="Write your lyrics here..."
                  value={newSong.lyrics}
                  onChange={(e) => setNewSong(prev => ({ ...prev, lyrics: e.target.value }))}
                  rows={6}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Duration (seconds)</label>
                <Input
                  type="number"
                  min="30"
                  max="600"
                  value={newSong.duration}
                  onChange={(e) => setNewSong(prev => ({ ...prev, duration: parseInt(e.target.value) || 180 }))}
                />
              </div>

              {skills && (
                <div className="bg-muted p-4 rounded-lg space-y-2">
                  <h4 className="font-medium">Estimated Quality: {calculateQuality()}%</h4>
                  <p className="text-sm text-muted-foreground">
                    Based on your songwriting skill ({skills.songwriting}/100) and other musical abilities
                  </p>
                </div>
              )}

              <Button 
                onClick={createSong}
                disabled={creating || !newSong.title || !newSong.genre}
                className="w-full"
              >
                {creating ? "Creating..." : "Create Song"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="catalog" className="space-y-4">
          {songs.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <Music className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">No Songs Yet</h3>
                <p className="text-muted-foreground">Create your first song to get started!</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {songs.map((song) => {
                const pendingLayers = localRecordings[song.id] ?? [];
                const storedLayers = song.audio_layers ?? [];
                const totalLayerCount = storedLayers.length + pendingLayers.length;

                return (
                  <Card key={song.id} className="relative">
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
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-sm">
                        <span>Quality</span>
                        <span className={`font-mono ${getQualityColor(song.quality_score)}`}>
                          {song.quality_score}%
                        </span>
                      </div>
                      <Progress value={song.quality_score} className="h-2" />
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="flex items-center gap-1">
                        <Volume2 className="h-3 w-3 text-blue-400" />
                        <span>{song.plays.toLocaleString()} plays</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Star className="h-3 w-3 text-yellow-400" />
                        <span>{song.popularity} popularity</span>
                      </div>
                    </div>

                    {song.lyrics && (
                      <div className="text-xs text-muted-foreground bg-muted p-2 rounded max-h-20 overflow-y-auto">
                        {song.lyrics}
                      </div>
                    )}

                    <div className="space-y-3 rounded-lg border border-muted/40 bg-muted/10 p-3">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            <Layers className="h-4 w-4 text-blue-400" />
                            Studio Layers
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Record takes, stack layers, and audition your mix instantly.
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant={audioRecordingSongId === song.id ? "destructive" : "outline"}
                            disabled={
                              (audioRecordingSongId !== null && audioRecordingSongId !== song.id) ||
                              previewSongId === song.id ||
                              previewLoadingSongId === song.id ||
                              uploadingLayer !== null
                            }
                            onClick={() =>
                              audioRecordingSongId === song.id
                                ? stopAudioRecording(song)
                                : startAudioRecording(song.id)
                            }
                          >
                            {audioRecordingSongId === song.id ? (
                              <>
                                <Square className="mr-1 h-4 w-4" />
                                Stop
                              </>
                            ) : (
                              <>
                                <Mic className="mr-1 h-4 w-4" />
                                Record Layer
                              </>
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant={previewSongId === song.id ? "secondary" : "outline"}
                            disabled={
                              totalLayerCount === 0 ||
                              audioRecordingSongId !== null ||
                              previewLoadingSongId === song.id
                            }
                            onClick={() => togglePreviewMix(song)}
                          >
                            {previewSongId === song.id ? (
                              <>
                                <Pause className="mr-1 h-4 w-4" />
                                Stop Preview
                              </>
                            ) : previewLoadingSongId === song.id ? (
                              <>
                                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                                Preparing
                              </>
                            ) : (
                              <>
                                <Play className="mr-1 h-4 w-4" />
                                Preview Mix
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                      <div className="space-y-2">
                        {storedLayers.length > 0 &&
                          storedLayers.map((layer, index) => (
                            <div
                              key={`${song.id}-stored-${index}`}
                              className="space-y-2 rounded border border-muted bg-background/80 p-2"
                            >
                              <div className="flex items-center justify-between text-sm font-medium">
                                <span className="flex items-center gap-2">
                                  <Waveform className="h-4 w-4 text-blue-400" />
                                  {layer.name || `Layer ${index + 1}`}
                                </span>
                                {layer.duration ? (
                                  <span className="text-xs text-muted-foreground">{formatDuration(layer.duration)}</span>
                                ) : null}
                              </div>
                              <audio controls src={layer.url} className="w-full" preload="metadata" />
                            </div>
                          ))}

                        {pendingLayers.map((layer, index) => {
                          const identifier = `${song.id}-${index}`;
                          const isUploading = uploadingLayer === identifier;
                          return (
                            <div
                              key={`${song.id}-pending-${index}`}
                              className="space-y-2 rounded border border-primary/40 bg-primary/10 p-3"
                            >
                              <div className="flex items-center justify-between text-sm font-medium">
                                <span className="flex items-center gap-2">
                                  <Waveform className="h-4 w-4 text-primary" />
                                  {layer.name}
                                  <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                                    Pending
                                  </Badge>
                                </span>
                                {layer.duration ? (
                                  <span className="text-xs text-muted-foreground">{formatDuration(layer.duration)}</span>
                                ) : null}
                              </div>
                              <audio controls src={layer.url} className="w-full" preload="metadata" />
                              <div className="flex flex-wrap gap-2">
                                <Button
                                  size="sm"
                                  onClick={() => saveRecordedLayer(song, layer, index)}
                                  disabled={isUploading}
                                >
                                  {isUploading ? (
                                    <>
                                      <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                                      Saving...
                                    </>
                                  ) : (
                                    <>
                                      <Upload className="mr-1 h-4 w-4" />
                                      Save to Supabase
                                    </>
                                  )}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => discardLocalLayer(song.id, index)}
                                  disabled={isUploading}
                                >
                                  Discard
                                </Button>
                              </div>
                            </div>
                          );
                        })}

                        {totalLayerCount === 0 && (
                          <p className="text-xs text-muted-foreground">
                            No recordings yet. Capture a new take or save a layer to start building this track.
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      {song.status === "draft" && (
                        <Button
                          onClick={() => recordSong(song)}
                          disabled={recordingSession || (profile?.cash || 0) < song.recording_cost}
                          className="flex-1"
                          variant="default"
                        >
                          <Play className="h-4 w-4 mr-2" />
                          Record (${song.recording_cost})
                        </Button>
                      )}
                      
                      <Button
                        onClick={() => deleteSong(song.id)}
                        variant="destructive"
                        size="sm"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default MusicCreation;