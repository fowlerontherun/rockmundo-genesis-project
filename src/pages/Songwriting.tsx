import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import { formatDistanceToNowStrict } from "date-fns";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth-context";
import { useGameData } from "@/hooks/useGameData";
import {
  useSongwritingData,
  type SongwritingProject,
  type SongwritingSession,
  getSongQualityDescriptor,
  SONG_RATING_RANGE,
} from "@/hooks/useSongwritingData";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { MUSIC_GENRES, getGenreSkillSlug } from "@/data/genres";
import { calculateSongQuality, canStartSongwriting, canWriteGenre } from "@/utils/songQuality";
import { getSongRating } from "@/data/songRatings";
import { AILyricsGenerator } from "@/components/songwriting/AILyricsGenerator";
import { SongQualityBreakdown } from "@/components/songwriting/SongQualityBreakdown";
import { SongCompletionDialog } from "@/components/songwriting/SongCompletionDialog";
import { SimplifiedProjectCard } from "@/components/songwriting/SimplifiedProjectCard";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Music,
  Plus,
  Edit,
  Trash2,
  Play,
  CheckCircle2,
  Clock as ClockIcon,
  NotebookPen,
  Trophy,
  Filter,
  History,
  Sparkles,
  Wand2,
  Users,
  Lightbulb,
  BadgeCheck,
  LockOpen,
  Lock,
  Music2,
  Pen,
  UserPlus,
} from "lucide-react";
import logger from "@/lib/logger";

interface Song {
  id: string;
  title: string;
  genre: string;
  status: string;
  quality_score?: number | null;
  song_rating?: number;
  streams?: number | null;
  revenue?: number | null;
  release_date?: string | null;
  lyrics_strength?: number | null;
  melody_strength?: number | null;
  rhythm_strength?: number | null;
  arrangement_strength?: number | null;
  production_potential?: number | null;
  inspiration_modifiers?: string[] | null;
  mood_modifiers?: string[] | null;
  co_writers?: string[] | null;
  split_percentages?: number[] | null;
  rating_revealed_at?: string | null;
  duration_seconds?: number | null;
  duration_display?: string | null;
}

interface ProjectFormState {
  title: string;
  theme_id: string;
  chord_progression_id: string;
  initial_lyrics: string;
  genre: string;
  writingMode: string;
  coWriters: string[];
  producers: string[];
  sessionMusicians: string[];
  inspirationModifiers: string[];
  moodModifiers: string[];
}

type SessionEffortOption = {
  id: "burst-2" | "standard-4";
  label: string;
  hours: number;
  description: string;
};

const SESSION_EFFORT_OPTIONS: SessionEffortOption[] = [
  {
    id: "burst-2",
    label: "2-hour sprint",
    hours: 2,
    description: "Quick focused session for rapid ideas and hooks.",
  },
  {
    id: "standard-4",
    label: "4-hour session",
    hours: 4,
    description: "Balanced creative session with time for refinement.",
  },
];

const DEFAULT_EFFORT_OPTION = SESSION_EFFORT_OPTIONS[0];
const PROGRESS_TARGET = SONG_RATING_RANGE.max * 2;

const DEFAULT_FORM_STATE: ProjectFormState = {
  title: "",
  theme_id: "",
  chord_progression_id: "",
  initial_lyrics: "",
  genre: "",
  writingMode: "",
  coWriters: [],
  producers: [],
  sessionMusicians: [],
  inspirationModifiers: [],
  moodModifiers: [],
};

// Simplified song select - only use existing columns
const SONG_SELECT_COLUMNS = "id, title, genre, status, quality_score, song_rating, streams, revenue, release_date, duration_seconds";

type PostgrestErrorLike = {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
};

type PostgrestErrorContext = {
  code: string | null;
  haystack: string;
};

const getPostgrestErrorContext = (error: unknown): PostgrestErrorContext | null => {
  if (!error || typeof error !== "object") {
    return null;
  }

  const candidate = error as PostgrestErrorLike;
  const code = typeof candidate.code === "string" ? candidate.code : null;
  const haystack = [candidate.message, candidate.details, candidate.hint]
    .filter((value): value is string => typeof value === "string" && value.length > 0)
    .join(" ")
    .toLowerCase();

  return { code, haystack };
};

const isMissingTableError = (error: unknown, tableName: string): boolean => {
  const context = getPostgrestErrorContext(error);

  if (!context) {
    return false;
  }

  const knownMissingTableCodes = new Set(["PGRST201", "PGRST202", "PGRST205", "PGRST114", "42P01"]);
  if (context.code && knownMissingTableCodes.has(context.code)) {
    return true;
  }

  if (!context.haystack) {
    return false;
  }

  const normalizedTable = tableName.toLowerCase();
  if (!context.haystack.includes(normalizedTable)) {
    return false;
  }

  return (
    context.haystack.includes("schema cache") ||
    context.haystack.includes("relation") ||
    context.haystack.includes("table") ||
    context.haystack.includes("does not exist") ||
    context.haystack.includes("not found")
  );
};


type NamedOption = {
  id: string;
  label: string;
  description?: string;
  role?: string;
  familiarity?: string;
  defaultSplit?: number;
};

// Genre library - use centralized genre list from skill tree
const GENRE_LIBRARY = MUSIC_GENRES.map(genre => ({
  id: genre,
  label: genre,
  relatedSkill: getGenreSkillSlug(genre, 'basic')
}));


const WRITING_MODE_OPTIONS: NamedOption[] = [
  { id: "solo", label: "Solo writing", description: "You drive the full process." },
  { id: "topline", label: "Top-line", description: "Craft lyrics and melody over existing track." },
  { id: "track-led", label: "Track-led", description: "Build the production bed before lyric focus." },
  { id: "camp", label: "Writing camp", description: "Coordinate multiple collaborators in rotations." },
];

const CO_WRITER_OPTIONS: NamedOption[] = [
  { id: "lyricist", label: "Specialist Lyricist", familiarity: "Wordsmith", role: "lyrics", defaultSplit: 25 },
  { id: "melodist", label: "Hook Melody Writer", familiarity: "Hook architect", role: "melody", defaultSplit: 25 },
  { id: "producer-writer", label: "Producer Writer", familiarity: "Track architect", role: "production", defaultSplit: 20 },
  { id: "bandmate", label: "Bandmate", familiarity: "Shared chemistry", role: "band", defaultSplit: 15 },
  { id: "remote", label: "Remote collaborator", familiarity: "Online match", role: "remote", defaultSplit: 15 },
];

const PRODUCER_OPTIONS: NamedOption[] = [
  { id: "self-produce", label: "Self-produce", description: "Artist leads the console and creative calls." },
  { id: "trusted-pro", label: "Trusted Producer", description: "Bring in your go-to sonic director." },
  { id: "experimental", label: "Experimental Architect", description: "Chase adventurous textures and sound design." },
];

const SESSION_MUSICIAN_OPTIONS: NamedOption[] = [
  { id: "guitarist", label: "Session Guitarist", role: "guitar" },
  { id: "keys", label: "Keys / Synths", role: "keys" },
  { id: "drums", label: "Drummer", role: "drums" },
  { id: "strings", label: "String Section", role: "strings" },
  { id: "horns", label: "Horn Section", role: "horns" },
];

const INSPIRATION_TAGS: NamedOption[] = [
  { id: "city-nights", label: "City nights" },
  { id: "retro", label: "Retro throwback" },
  { id: "future", label: "Future-facing" },
  { id: "story", label: "Story-driven" },
  { id: "anthemic", label: "Anthemic" },
];

const MOOD_TAGS: NamedOption[] = [
  { id: "uplifting", label: "Uplifting" },
  { id: "moody", label: "Moody" },
  { id: "intimate", label: "Intimate" },
  { id: "urgent", label: "Urgent" },
  { id: "playful", label: "Playful" },
];

const STATUS_METADATA: Record<string, { label: string; badge: "default" | "secondary" | "outline" | "destructive" }> = {
  idea: { label: "Idea", badge: "secondary" },
  draft: { label: "Draft", badge: "secondary" },
  writing: { label: "Writing", badge: "default" },
  arranging: { label: "Arranging", badge: "outline" },
  ready_to_finish: { label: "Ready to Finish", badge: "outline" },
  demo: { label: "Demo", badge: "outline" },
  complete: { label: "Completed", badge: "default" },
  completed: { label: "Completed", badge: "default" },
};

const DEFAULT_STATUS_ORDER = [
  "idea",
  "draft",
  "writing",
  "arranging",
  "ready_to_finish",
  "demo",
  "completed",
];

const ACTIVE_STATUSES = new Set(["writing", "arranging"]);
const RELEASE_READY_STATUSES = new Set(["ready_to_finish", "demo", "completed", "complete"]);

const computeCoreAttributes = (project: SongwritingProject) => {
  const creativeAttributes = project.creative_brief?.core_attributes;
  if (creativeAttributes) {
    return {
      lyrics: creativeAttributes.lyrics ?? 0,
      melody: creativeAttributes.melody ?? 0,
      rhythm: creativeAttributes.rhythm ?? 0,
      arrangement: creativeAttributes.arrangement ?? 0,
      production: creativeAttributes.production ?? 0,
    };
  }

  const lyricsProgress = project.lyrics_progress ?? 0;
  const musicProgress = project.music_progress ?? 0;
  const quality = project.quality_score ?? 0;

  const progressRatio = (value: number) => Math.min(1, Math.max(0, value / PROGRESS_TARGET));
  const qualityRatio = Math.min(1, Math.max(0, quality / SONG_RATING_RANGE.max));

  return {
    lyrics: Math.round(progressRatio(lyricsProgress) * 100),
    melody: Math.round(((progressRatio(musicProgress) * 0.6 + qualityRatio * 0.4) || 0) * 100),
    rhythm: Math.round(progressRatio(musicProgress) * 100),
    arrangement: Math.round(((progressRatio(musicProgress) + qualityRatio) / 2) * 100),
    production: Math.round(qualityRatio * 100),
  };
};

const computeCoWriterSplits = (project: SongwritingProject) => {
  const coWriters = project.creative_brief?.co_writers ?? [];
  if (coWriters.length === 0) {
    return [] as Array<{ id: string; label: string; split: number; role?: string | null }>;
  }

  return coWriters.map((writer) => ({
    id: writer.id,
    label: writer.name,
    split: typeof writer.split === "number" ? Math.round(writer.split) : Math.round(100 / coWriters.length),
    role: writer.role,
  }));
};

const formatWordCount = (value: string) => {
  if (!value.trim()) return "0 words";
  return `${value.trim().split(/\s+/).length} words`;
};

const getStatusMeta = (status: string | null | undefined) => {
  if (!status) {
    return { label: "Unknown", badge: "secondary" as const };
  }

  const normalized = status.toLowerCase();
  return STATUS_METADATA[normalized] ?? {
    label: status.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase()),
    badge: "secondary" as const,
  };
};

const computeLockState = (lockedUntil: string | null | undefined) => {
  if (!lockedUntil) {
    return { locked: false, message: "Ready for the next focus sprint." };
  }

  const target = new Date(lockedUntil);
  if (Number.isNaN(target.getTime()) || target <= new Date()) {
    return { locked: false, message: "Ready for the next focus sprint." };
  }

  const diffMinutes = Math.ceil((target.getTime() - Date.now()) / 60000);
  return {
    locked: true,
    message: `Locked for ${diffMinutes} more minute${diffMinutes === 1 ? "" : "s"}.`,
  };
};

const findActiveSession = (sessions?: SongwritingSession[] | null) => {
  if (!Array.isArray(sessions)) return null;
  return (
    sessions.find((session) => !session.session_end && !session.completed_at) ??
    sessions.find((session) => !session.completed_at)
  );
};

const getProgressPercent = (value?: number | null) => {
  if (!value || Number.isNaN(value)) {
    return 0;
  }
  return Math.min(100, Math.round((value / PROGRESS_TARGET) * 100));
};
const Songwriting = () => {
  const { user } = useAuth();
  const { profile, activityStatus, startActivity, clearActivityStatus, refreshActivityStatus, skills, attributes: rawAttributes } = useGameData();
  const {
    themes,
    chordProgressions,
    projects,
    isLoadingProjects,
    isLoadingThemes,
    isLoadingChordProgressions,
    createProject,
    updateProject,
    deleteProject,
    startSession,
    pauseSession,
    completeSession,
    convertToSong,
    refetchProjects,
  } = useSongwritingData(user?.id);

  // Map attributes to required format
  const attributes = useMemo(() => {
    if (!rawAttributes) return null;
    return {
      creative_insight: rawAttributes.creative_insight || 10,
      musical_ability: rawAttributes.musical_ability || 10,
      technical_mastery: rawAttributes.technical_mastery || 10
    };
  }, [rawAttributes]);

  const [songs, setSongs] = useState<Song[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("active");
  const [themeFilter, setThemeFilter] = useState<string>("all");
  const [showActiveOnly, setShowActiveOnly] = useState(false);
  const [showLockedOnly, setShowLockedOnly] = useState(false);
  const [showReadyOnly, setShowReadyOnly] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<SongwritingProject | null>(null);
  const [historyProject, setHistoryProject] = useState<SongwritingProject | null>(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [completionProject, setCompletionProject] = useState<SongwritingProject | null>(null);
  const [completionNotes, setCompletionNotes] = useState("");
  const [formState, setFormState] = useState<ProjectFormState>(DEFAULT_FORM_STATE);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [effortSelections, setEffortSelections] = useState<Record<string, SessionEffortOption["id"]>>({});
  const [sessionParticipants, setSessionParticipants] = useState<
    Record<string, { coWriters: string[]; producers: string[]; musicians: string[] }>
  >({});
  const [rehearsalUnlocks, setRehearsalUnlocks] = useState<Record<string, boolean>>({});
  
  // Song completion dialog state
  const [showCompletionDialog, setShowCompletionDialog] = useState(false);
  const [completedProject, setCompletedProject] = useState<SongwritingProject | null>(null);
  const [completionQuality, setCompletionQuality] = useState<any>(null);
  const [completionXp, setCompletionXp] = useState(0);
  
  // Check if player can start songwriting
  const canWrite = useMemo(() => {
    return canStartSongwriting(skills || {});
  }, [skills]);
  
  // Filter genres by unlocked skills
  const availableGenres = useMemo(() => {
    return MUSIC_GENRES.filter(genre => 
      canWriteGenre(genre, skills || {})
    );
  }, [skills]);

  const fetchSongs = useCallback(async () => {
    const userId = user?.id ?? null;

    if (!userId) {
      setSongs([]);
      return;
    }

    logger.info("Fetching songs for songwriting", { userId });

    try {
      const { data, error } = await supabase
        .from("songs")
        .select(SONG_SELECT_COLUMNS)
        .eq("user_id", userId)
        .order("updated_at", { ascending: false });

      if (error) {
        throw error;
      }

      const resolvedSongs = Array.isArray(data) ? (data as unknown as Song[]) : [];
      setSongs(resolvedSongs);
    } catch (error) {
      logger.error("Error fetching songs for songwriting", { userId, error });
      toast.error("Failed to load songs");
      setSongs([]);
    }
  }, [user?.id]);

  useEffect(() => {
    void fetchSongs();
  }, [fetchSongs]);

  useEffect(() => {
    void refreshActivityStatus();
  }, [refreshActivityStatus]);

  useEffect(() => {
    if (convertToSong.isSuccess || createProject.isSuccess || updateProject.isSuccess) {
      void fetchSongs();
    }
  }, [convertToSong.isSuccess, createProject.isSuccess, updateProject.isSuccess, fetchSongs]);

  const projectsList = useMemo(() => projects ?? [], [projects]);
  const themesList = useMemo(() => themes ?? [], [themes]);
  const progressionsList = useMemo(() => chordProgressions ?? [], [chordProgressions]);
  const coWriterOptionMap = useMemo(
    () =>
      CO_WRITER_OPTIONS.reduce<Record<string, NamedOption>>((accumulator, option) => {
        accumulator[option.id] = option;
        return accumulator;
      }, {}),
    [],
  );
  const producerOptionMap = useMemo(
    () =>
      PRODUCER_OPTIONS.reduce<Record<string, NamedOption>>((accumulator, option) => {
        accumulator[option.id] = option;
        return accumulator;
      }, {}),
    [],
  );
  const sessionMusicianOptionMap = useMemo(
    () =>
      SESSION_MUSICIAN_OPTIONS.reduce<Record<string, NamedOption>>((accumulator, option) => {
        accumulator[option.id] = option;
        return accumulator;
      }, {}),
    [],
  );
  const inspirationTagMap = useMemo(
    () =>
      INSPIRATION_TAGS.reduce<Record<string, NamedOption>>((accumulator, option) => {
        accumulator[option.id] = option;
        return accumulator;
      }, {}),
    [],
  );
  const moodTagMap = useMemo(
    () =>
      MOOD_TAGS.reduce<Record<string, NamedOption>>((accumulator, option) => {
        accumulator[option.id] = option;
        return accumulator;
      }, {}),
    [],
  );

  const genreOptions = useMemo(() => {
    if (!skills) {
      return GENRE_LIBRARY.slice(0, 6);
    }

    const familiarGenres = GENRE_LIBRARY.filter((genre) => {
      if (!genre.relatedSkill) return true;
      const skillScore = skills[genre.relatedSkill as keyof typeof skills];
      if (typeof skillScore !== "number") {
        return false;
      }
      return skillScore >= 25;
    });

    return (familiarGenres.length > 0 ? familiarGenres : GENRE_LIBRARY.slice(0, 6)).map((genre) => ({
      id: genre.id,
      label: genre.label,
    }));
  }, [skills]);

  const plannedCoWriterSplits = useMemo(() => {
    const total = formState.coWriters.length;
    if (total === 0) {
      return [] as Array<{ id: string; label: string; split: number; role?: string }>;
    }

    const evenSplit = Math.floor(100 / total);
    const remainder = 100 - evenSplit * total;

    return formState.coWriters.map((coWriterId, index) => {
      const option = coWriterOptionMap[coWriterId];
      return {
        id: coWriterId,
        label: option?.label ?? coWriterId,
        split: evenSplit + (index === 0 ? remainder : 0),
        role: option?.role,
      };
    });
  }, [formState.coWriters, coWriterOptionMap]);

  const selectedWritingMode = useMemo(
    () => WRITING_MODE_OPTIONS.find((option) => option.id === formState.writingMode) ?? null,
    [formState.writingMode],
  );

  const songMap = useMemo(() => {
    return songs.reduce<Record<string, Song>>((accumulator, song) => {
      accumulator[song.id] = song;
      return accumulator;
    }, {});
  }, [songs]);

  const initializedProjectsRef = useRef<Set<string>>(new Set());
  const lastCheckRef = useRef<number>(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Auto-check for completed sessions
  const checkAutoCompletions = useCallback(async (force = false) => {
    const now = Date.now();
    // Check immediately on first load, then throttle to 30 seconds
    if (!force && lastCheckRef.current > 0 && now - lastCheckRef.current < 30000) return;
    lastCheckRef.current = now;

    try {
      setIsRefreshing(true);
      const { data, error } = await supabase.functions.invoke('cleanup-songwriting');
      
      if (error) {
        console.error('Auto-complete error:', error);
        if (force) {
          toast.error('Failed to check for completed sessions');
        }
        return;
      }
      
      if (data?.completedSessions > 0) {
        toast.success(`${data.completedSessions} session(s) completed! Progress updated.`);
        await refetchProjects();
      } else if (force) {
        toast.info('No sessions ready to complete');
      }
    } catch (error) {
      console.error('Auto-complete check failed:', error);
      if (force) {
        toast.error('Failed to refresh sessions');
      }
    } finally {
      setIsRefreshing(false);
    }
  }, [refetchProjects]);

  // Check immediately on mount and when page becomes visible
  useEffect(() => {
    checkAutoCompletions();

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        checkAutoCompletions();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Poll every 30 seconds while page is visible
    const interval = setInterval(() => {
      if (!document.hidden) {
        checkAutoCompletions();
      }
    }, 30000);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearInterval(interval);
    };
  }, [checkAutoCompletions]);

  useEffect(() => {
    const newProjects = projectsList.filter(p => !initializedProjectsRef.current.has(p.id));
    
    if (newProjects.length === 0) return;
    
    setEffortSelections((previous) => {
      const nextSelections = { ...previous };
      
      newProjects.forEach((project) => {
        if (!project.id) return;
        const defaultEffort = SESSION_EFFORT_OPTIONS.find(
          (option) => option.id === (project.creative_brief?.effort_level as SessionEffortOption["id"]),
        );
        nextSelections[project.id] = defaultEffort?.id ?? DEFAULT_EFFORT_OPTION.id;
      });
      
      return nextSelections;
    });

    setSessionParticipants((previous) => {
      const nextParticipants = { ...previous };
      
      newProjects.forEach((project) => {
        if (!project.id) return;
        nextParticipants[project.id] = {
          coWriters: project.creative_brief?.co_writers?.map((writer) => writer.id) ?? [],
          producers: project.creative_brief?.producers ?? [],
          musicians: project.creative_brief?.session_musicians ?? [],
        };
      });
      
      return nextParticipants;
    });
    
    // Track that we've initialized these projects
    newProjects.forEach(p => initializedProjectsRef.current.add(p.id));
  }, [projectsList]);

  useEffect(() => {
    setRehearsalUnlocks((previous) => {
      const nextUnlocks = { ...previous };
      projectsList.forEach((project) => {
        if (!project.id) return;
        if (project.creative_brief?.rating_revealed_at) {
          nextUnlocks[project.id] = true;
        }
      });
      return nextUnlocks;
    });
  }, [projectsList]);

  const statusOptions = useMemo(() => {
    const knownStatuses = new Set(DEFAULT_STATUS_ORDER);
    projectsList.forEach((project) => {
      if (project.status) {
        knownStatuses.add(project.status.toLowerCase());
      }
    });

    return Array.from(knownStatuses).map((status) => ({
      value: status,
      label: getStatusMeta(status).label,
    }));
  }, [projectsList]);

  const globalActivityLock = useMemo(() => {
    if (!activityStatus || activityStatus.status === "idle") {
      return { locked: false, endsAt: null as Date | null, label: null as string | null };
    }

    const label = activityStatus.status.replace(/_/g, " ");

    if (typeof activityStatus.duration_minutes !== "number") {
      return { locked: true, endsAt: null as Date | null, label };
    }

    const explicitEndsAt = activityStatus.ends_at ? new Date(activityStatus.ends_at) : null;
    if (explicitEndsAt && !Number.isNaN(explicitEndsAt.getTime())) {
      return { locked: explicitEndsAt.getTime() > Date.now(), endsAt: explicitEndsAt, label };
    }

    if (!activityStatus.started_at) {
      return { locked: false, endsAt: null as Date | null, label };
    }

    const startedAt = new Date(activityStatus.started_at);
    if (Number.isNaN(startedAt.getTime())) {
      return { locked: false, endsAt: null as Date | null, label };
    }

    const computedEnds = new Date(startedAt.getTime() + activityStatus.duration_minutes * 60_000);
    return { locked: computedEnds.getTime() > Date.now(), endsAt: computedEnds, label };
  }, [activityStatus]);

  const globalActivityCountdown = useMemo(() => {
    if (!globalActivityLock.locked || !globalActivityLock.endsAt) {
      return null;
    }

    try {
      return formatDistanceToNowStrict(globalActivityLock.endsAt, { addSuffix: true });
    } catch (error) {
      logger.warn("Failed to compute activity countdown", {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }, [globalActivityLock]);

  const totalProjects = projectsList.length;
  const totalSessions = projectsList.reduce((sum, project) => sum + (project.total_sessions ?? 0), 0);
  const focusMinutes = projectsList.reduce((total, project) => {
    const effortOption = SESSION_EFFORT_OPTIONS.find(
      (option) => option.id === (project.creative_brief?.effort_level as SessionEffortOption["id"]),
    );
    const hours = effortOption?.hours ?? DEFAULT_EFFORT_OPTION.hours;
    return total + (project.total_sessions ?? 0) * hours * 60;
  }, 0);
  const activeProjects = projectsList.filter((project) =>
    ACTIVE_STATUSES.has((project.status || "").toLowerCase())
  ).length;
  const completedProjects = projectsList.filter((project) =>
    RELEASE_READY_STATUSES.has((project.status || "").toLowerCase()) &&
    (project.music_progress ?? 0) >= PROGRESS_TARGET &&
    (project.lyrics_progress ?? 0) >= PROGRESS_TARGET
  ).length;
  const readyProjects = projectsList.filter((project) =>
    RELEASE_READY_STATUSES.has((project.status || "").toLowerCase())
  ).length;
  const averageQualityScore = totalProjects
    ? Math.round(
        projectsList.reduce((sum, project) => sum + (project.quality_score ?? 0), 0) / totalProjects
      )
    : 0;
  const averageQualityDescriptor = getSongQualityDescriptor(averageQualityScore);

  const filteredProjects = useMemo(() => {
    return projectsList.filter((project) => {
      const status = (project.status || "").toLowerCase();
      
      // Filter out completed by default when statusFilter is "active"
      if (statusFilter === "active" && (status === "completed" || status === "complete")) {
        return false;
      }
      
      const matchesStatus =
        statusFilter === "all" ||
        statusFilter === "active" ||
        status === statusFilter ||
        (statusFilter === "completed" && status === "complete");

      const matchesTheme = themeFilter === "all" || project.theme_id === themeFilter;
      const activeSession = findActiveSession(project.songwriting_sessions);
      const matchesActive = !showActiveOnly || Boolean(activeSession);
      const lockState = computeLockState(project.locked_until ?? null);
      const matchesLocked = !showLockedOnly || lockState.locked;
      const matchesReady = !showReadyOnly || RELEASE_READY_STATUSES.has(status);

      return matchesStatus && matchesTheme && matchesActive && matchesLocked && matchesReady;
    });
  }, [projectsList, statusFilter, themeFilter, showActiveOnly, showLockedOnly, showReadyOnly]);

  const formatCurrency = useMemo(
    () =>
      new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
      }),
    []
  );

  const formatNumber = useMemo(
    () =>
      new Intl.NumberFormat("en-US", {
        maximumFractionDigits: 0,
      }),
    []
  );

  const resetForm = useCallback(() => {
    setFormState(DEFAULT_FORM_STATE);
    setSelectedProject(null);
    setFormErrors({});
  }, []);

  const toggleSelection = useCallback((list: string[], id: string, checked: boolean) => {
    if (checked) {
      return Array.from(new Set([...list, id]));
    }
    return list.filter((item) => item !== id);
  }, []);

  const updateSessionParticipant = useCallback(
    (projectId: string, key: "coWriters" | "producers" | "musicians", value: string, checked: boolean) => {
      setSessionParticipants((previous) => {
        const current = previous[projectId] ?? { coWriters: [], producers: [], musicians: [] };
        return {
          ...previous,
          [projectId]: {
            ...current,
            [key]: toggleSelection(current[key], value, checked),
          },
        };
      });
    },
    [toggleSelection],
  );
  const handleOpenCreate = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const handleEdit = (project: SongwritingProject) => {
    setSelectedProject(project);
    const creativeBrief = project.creative_brief ?? null;
    setFormState({
      title: project.title,
      theme_id: project.theme_id ?? "",
      chord_progression_id: project.chord_progression_id ?? "",
      initial_lyrics: project.lyrics ?? project.initial_lyrics ?? "",
      genre: creativeBrief?.genre ?? "",
      writingMode: creativeBrief?.writing_mode ?? "",
      coWriters: creativeBrief?.co_writers?.map((writer) => writer.id) ?? [],
      producers: creativeBrief?.producers ?? [],
      sessionMusicians: creativeBrief?.session_musicians ?? [],
      inspirationModifiers: creativeBrief?.inspiration_modifiers ?? [],
      moodModifiers: creativeBrief?.mood_modifiers ?? [],
    });
    setFormErrors({});
    setIsDialogOpen(true);
  };

  const handleDelete = async (project: SongwritingProject) => {
    if (!confirm(`Delete songwriting project "${project.title}"?`)) {
      return;
    }

    try {
      await deleteProject.mutateAsync(project.id);
    } catch (error) {
      logger.error("Failed to delete songwriting project", {
        projectId: project.id,
        error: error instanceof Error ? error.message : String(error),
      });
      toast.error("Failed to delete songwriting project");
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedTitle = formState.title.trim();
    const validationErrors: Record<string, string> = {};

    if (!trimmedTitle) {
      validationErrors.title = "Give your project a working title.";
    }

    if (!formState.genre) {
      validationErrors.genre = "Select a genre focus to unlock tailored prompts.";
    }

    if (!formState.writingMode) {
      validationErrors.writingMode = "Pick how this session will unfold.";
    }

    setFormErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) {
      return;
    }

    const totalCoWriters = formState.coWriters.length;
    const evenSplit = totalCoWriters > 0 ? Math.floor(100 / totalCoWriters) : 0;
    const remainder = totalCoWriters > 0 ? 100 - evenSplit * totalCoWriters : 0;

    const coWriterEntries = formState.coWriters.map((coWriterId, index) => {
      const option = coWriterOptionMap[coWriterId];
      return {
        id: coWriterId,
        name: option?.label ?? coWriterId,
        role: option?.role ?? null,
        familiarity: option?.familiarity ?? null,
        split: evenSplit + (index === 0 ? remainder : 0),
      };
    });

    const creativeBrief = {
      genre: formState.genre,
      writing_mode: formState.writingMode,
      familiarity_tags: formState.genre ? [formState.genre] : [],
      co_writers: coWriterEntries,
      producers: formState.producers,
      session_musicians: formState.sessionMusicians,
      inspiration_modifiers: formState.inspirationModifiers,
      mood_modifiers: formState.moodModifiers,
      rating_revealed_at: selectedProject?.creative_brief?.rating_revealed_at ?? null,
      core_attributes: selectedProject?.creative_brief?.core_attributes ?? null,
    } as const;

    const payload = {
      title: trimmedTitle,
      theme_id: formState.theme_id,
      chord_progression_id: formState.chord_progression_id,
      initial_lyrics: formState.initial_lyrics,
      creative_brief: creativeBrief,
    };

    try {
      if (selectedProject) {
        await updateProject.mutateAsync({
          id: selectedProject.id,
          title: payload.title,
          theme_id: payload.theme_id || null,
          chord_progression_id: payload.chord_progression_id || null,
          initial_lyrics: payload.initial_lyrics ?? null,
          lyrics: payload.initial_lyrics ?? null,
          creative_brief: payload.creative_brief,
        });
      } else {
        await createProject.mutateAsync({
          title: payload.title,
          theme_id: payload.theme_id || null,
          chord_progression_id: payload.chord_progression_id || null,
          initial_lyrics: payload.initial_lyrics ?? undefined,
          creative_brief: payload.creative_brief,
        });
      }

      setIsDialogOpen(false);
      resetForm();
    } catch (error) {
      logger.error("Failed to save songwriting project", {
        projectId: selectedProject?.id,
        error: error instanceof Error ? error.message : String(error),
      });
      toast.error("Failed to save project");
    }
  };

  const handleStartSession = async (project: SongwritingProject) => {
    const effortId = effortSelections[project.id] ?? DEFAULT_EFFORT_OPTION.id;
    const effortOption =
      SESSION_EFFORT_OPTIONS.find((option) => option.id === effortId) ?? DEFAULT_EFFORT_OPTION;
    const participants = sessionParticipants[project.id] ?? {
      coWriters: project.creative_brief?.co_writers?.map((writer) => writer.id) ?? [],
      producers: project.creative_brief?.producers ?? [],
      musicians: project.creative_brief?.session_musicians ?? [],
    };

    try {
      await startSession.mutateAsync({ projectId: project.id, effortHours: effortOption.hours });
      await startActivity({
        status: "songwriting_session",
        durationMinutes: effortOption.hours * 60,
        metadata: {
          projectId: project.id,
          effortHours: effortOption.hours,
          coWriters: participants.coWriters,
          producers: participants.producers,
          sessionMusicians: participants.musicians,
        },
      });
      await refreshActivityStatus();
    } catch (error) {
      logger.error("Failed to start songwriting session", {
        projectId: project.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const handlePauseSession = async (project: SongwritingProject) => {
    const activeSession = findActiveSession(project.songwriting_sessions);
    if (!activeSession) {
      toast.info("No active sprint to pause for this project.");
      return;
    }

    try {
      await pauseSession.mutateAsync({ sessionId: activeSession.id });
      await clearActivityStatus();
      await refreshActivityStatus();
    } catch (error) {
      logger.error("Failed to pause songwriting session", {
        projectId: project.id,
        sessionId: activeSession.id,
        error: error instanceof Error ? error.message : String(error),
      });
      toast.error("Unable to pause session");
    }
  };

  const handleOpenCompletionDialog = (project: SongwritingProject) => {
    setCompletionProject(project);
    setCompletionNotes("");
  };

  const handleUnlockRating = async (project: SongwritingProject) => {
    if (rehearsalUnlocks[project.id]) {
      return;
    }

    const nextBrief = {
      ...(project.creative_brief ?? {}),
      rating_revealed_at: new Date().toISOString(),
    };

    setRehearsalUnlocks((previous) => ({ ...previous, [project.id]: true }));

    try {
      await updateProject.mutateAsync({
        id: project.id,
        creative_brief: nextBrief,
      });
    } catch (error) {
      setRehearsalUnlocks((previous) => ({ ...previous, [project.id]: false }));
      logger.error("Failed to unlock rating", {
        projectId: project.id,
        error: error instanceof Error ? error.message : String(error),
      });
      toast.error("Unable to reveal rating yet. Try again after saving your rehearsal notes.");
    }
  };

  const handleCompleteSessionSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!completionProject) return;

    const activeSession = findActiveSession(completionProject.songwriting_sessions);
    if (!activeSession) {
      toast.info("No active session to complete for this project.");
      return;
    }

    if (!activeSession.id) {
      toast.error("Session ID is missing - cannot complete.");
      logger.error("Active session missing ID", { project: completionProject.id });
      return;
    }

    try {
      await completeSession.mutateAsync({
        sessionId: activeSession.id,
        notes: completionNotes,
        effortHours: activeSession.effort_hours ?? 2,
        skillLevels: skills || {},
        attributes: attributes || {
          creative_insight: 10,
          musical_ability: 10,
          technical_mastery: 10
        }
      });

      setCompletionProject(null);
      setCompletionNotes("");
      await clearActivityStatus();
      await refreshActivityStatus();
    } catch (error) {
      logger.error("Failed to complete songwriting session", {
        projectId: completionProject.id,
        sessionId: activeSession.id,
        error: error instanceof Error ? error.message : String(error),
      });
      toast.error("Failed to complete session");
    }
  };

  const handleConvertProject = async (project: SongwritingProject, catalogStatus: string = 'private', bandId?: string) => {
    try {
      // Calculate final quality using actual player data
      const quality = calculateSongQuality({
        genre: project.genres?.[0] || 'Rock',
        skillLevels: skills || {},
        attributes: attributes || {
          creative_insight: 10,
          musical_ability: 10,
          technical_mastery: 10
        },
        sessionHours: (project.total_sessions || 0) * 6,
        coWriters: project.creative_brief?.co_writers?.length || 0,
        aiLyrics: project.lyrics?.includes('[AI]') || false
      });

      await convertToSong.mutateAsync({
        projectId: project.id,
        quality,
        catalogStatus,
        bandId
      });
    } catch (error) {
      logger.error("Failed to convert songwriting project", {
        projectId: project.id,
        error: error instanceof Error ? error.message : String(error),
      });
      toast.error("Failed to create song from project");
    }
  };

  const handleCompletionDialogChange = (open: boolean) => {
    if (!open) {
      setCompletionProject(null);
      setCompletionNotes("");
    }
  };

  const handleHistoryDialogChange = (open: boolean) => {
    if (!open) {
      setHistoryProject(null);
    }
  };
  // Check if player can access songwriting
  if (!canWrite) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              Songwriting Studio - Locked
            </CardTitle>
            <CardDescription>
              You need to train your basic composing skills to unlock songwriting.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              Required: <strong>Songwriting Basic Composing</strong> level 10 or higher
            </p>
            <p className="text-sm text-muted-foreground">
              Head to the Skills page to train your songwriting abilities and unlock this feature.
            </p>
            <Button asChild>
              <Link to="/skills">
                <Music className="mr-2 h-4 w-4" />
                Train Skills
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  if (isLoadingProjects && projectsList.length === 0) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">Loading songwriting studio...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-3 md:p-6 space-y-4 md:space-y-6 max-w-7xl">
        <div className="flex flex-col gap-3 md:gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
              <Music className="h-6 w-6 md:h-8 md:w-8 text-primary" />
              Songwriting Studio
            </h1>
            <p className="text-sm md:text-base text-muted-foreground mt-1 md:mt-2">
              Create songwriting sprints, track progress, and convert to songs.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => checkAutoCompletions(true)}
              variant="outline"
              size="sm"
              disabled={isRefreshing}
            >
              <CheckCircle2 className="mr-2 h-4 w-4" />
              {isRefreshing ? 'Checking...' : 'Refresh Sessions'}
            </Button>
          </div>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={handleOpenCreate} size="sm" className="md:size-default">
              <Plus className="mr-2 h-4 w-4" />
              New Project
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>{selectedProject ? "Edit Songwriting Project" : "Create Songwriting Project"}</DialogTitle>
              <DialogDescription>
                {selectedProject
                  ? "Update your creative plan or refresh the concept notes for this project."
                  : "Define the creative direction and we'll forecast the focus sprints you'll need."}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              <Tabs defaultValue="basics" className="w-full">
                <TabsList className="grid w-full grid-cols-3 mb-6">
                  <TabsTrigger value="basics" className="flex items-center gap-2">
                    <Music2 className="h-4 w-4" />
                    <span className="hidden sm:inline">Basics</span>
                  </TabsTrigger>
                  <TabsTrigger value="creative" className="flex items-center gap-2">
                    <Pen className="h-4 w-4" />
                    <span className="hidden sm:inline">Creative Brief</span>
                  </TabsTrigger>
                  <TabsTrigger value="collaborators" className="flex items-center gap-2">
                    <UserPlus className="h-4 w-4" />
                    <span className="hidden sm:inline">Collaborators</span>
                  </TabsTrigger>
                </TabsList>

                <div className="max-h-[60vh] overflow-y-auto pr-2">
                  {/* Tab 1: Basics */}
                  <TabsContent value="basics" className="space-y-4 mt-0">
                    <div className="space-y-2">
                      <Label htmlFor="project-title">Project Title *</Label>
                      <Input
                        id="project-title"
                        value={formState.title}
                        onChange={(event) => setFormState((previous) => ({ ...previous, title: event.target.value }))}
                        placeholder="e.g., Anthemic stadium rock banger"
                        aria-invalid={Boolean(formErrors.title)}
                      />
                      {formErrors.title && <p className="text-sm text-destructive">{formErrors.title}</p>}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="project-genre">Primary Genre *</Label>
                      <Select
                        value={formState.genre || "none"}
                        onValueChange={(value) =>
                          setFormState((previous) => ({ ...previous, genre: value === "none" ? "" : value }))
                        }
                      >
                        <SelectTrigger id="project-genre">
                          <SelectValue placeholder="Select a genre" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Explore something new</SelectItem>
                          {MUSIC_GENRES.map((genre) => {
                            const isUnlocked = canWriteGenre(genre, skills || {});
                            const genreSkillSlug = getGenreSkillSlug(genre, 'basic');
                            const skillLevel = genreSkillSlug ? (skills?.[genreSkillSlug] || 0) : 0;
                            return (
                              <SelectItem 
                                key={genre} 
                                value={genre}
                                disabled={!isUnlocked}
                              >
                                {genre} {isUnlocked ? '✓' : `🔒 (Need level 10, currently ${skillLevel})`}
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                      {formErrors.genre && <p className="text-sm text-destructive">{formErrors.genre}</p>}
                      {availableGenres.length === 0 && (
                        <p className="text-xs text-muted-foreground">
                          Learn genre skills through University, Books, or Mentors to unlock songwriting genres.
                        </p>
                      )}
                      {availableGenres.length > 0 && availableGenres.length < MUSIC_GENRES.length && (
                        <p className="text-xs text-muted-foreground">
                          {availableGenres.length} of {MUSIC_GENRES.length} genres unlocked. Learn more through University!
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="project-theme">Song Theme</Label>
                      <Select
                        value={formState.theme_id || "none"}
                        onValueChange={(value) =>
                          setFormState((previous) => ({ ...previous, theme_id: value === "none" ? "" : value }))
                        }
                        disabled={isLoadingThemes && themesList.length === 0}
                      >
                        <SelectTrigger id="project-theme">
                          <SelectValue placeholder="Choose a theme (optional)" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No specific theme</SelectItem>
                          {themesList.map((theme) => (
                            <SelectItem key={theme.id} value={theme.id}>
                              {theme.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="project-progression">Chord Progression</Label>
                      <Select
                        value={formState.chord_progression_id || "none"}
                        onValueChange={(value) =>
                          setFormState((previous) => ({
                            ...previous,
                            chord_progression_id: value === "none" ? "" : value,
                          }))
                        }
                        disabled={isLoadingChordProgressions && progressionsList.length === 0}
                      >
                        <SelectTrigger id="project-progression">
                          <SelectValue placeholder="Select a progression (optional)" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No progression yet</SelectItem>
                          {progressionsList.map((progression) => (
                            <SelectItem key={progression.id} value={progression.id}>
                              {progression.name} · {progression.progression}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </TabsContent>

                  {/* Tab 2: Creative Brief */}
                  <TabsContent value="creative" className="space-y-4 mt-0">
                    <div className="space-y-2">
                      <Label htmlFor="project-lyrics">Lyrics & Song Notes</Label>
                      <Textarea
                        id="project-lyrics"
                        value={formState.initial_lyrics}
                        onChange={(event) =>
                          setFormState((previous) => ({ ...previous, initial_lyrics: event.target.value }))
                        }
                        placeholder="Capture the core concept, lyric fragments, or production notes."
                        className="min-h-32"
                      />
                      <p className="text-right text-xs text-muted-foreground">{formatWordCount(formState.initial_lyrics)}</p>
                    </div>
                    
                    {/* AI Lyrics Generator - Collapsible */}
                    <div className="pt-2">
                      <AILyricsGenerator
                        title={selectedProject?.title || formState.title}
                        theme={selectedProject?.song_themes?.name || ''}
                        genre={formState.genre}
                        chordProgression={selectedProject?.chord_progressions?.progression || ''}
                        onLyricsGenerated={(lyrics) => {
                          setFormState(prev => ({
                            ...prev,
                            initial_lyrics: prev.initial_lyrics ? `${prev.initial_lyrics}\n\n[AI Generated]\n${lyrics}` : `[AI Generated]\n${lyrics}`
                          }));
                          if (selectedProject) {
                            updateProject.mutate({
                              id: selectedProject.id,
                              initial_lyrics: `${formState.initial_lyrics}\n\n[AI Generated]\n${lyrics}`,
                              lyrics: `${formState.initial_lyrics}\n\n[AI Generated]\n${lyrics}`
                            });
                          }
                        }}
                      />
                    </div>

                    <div className="space-y-3">
                      <div>
                        <Label className="flex items-center gap-2 mb-2">
                          <Lightbulb className="h-4 w-4 text-amber-500" />
                          Inspiration Anchors
                        </Label>
                        <div className="flex flex-wrap gap-2">
                          {INSPIRATION_TAGS.map((tag) => {
                            const selected = formState.inspirationModifiers.includes(tag.id);
                            return (
                              <Button
                                type="button"
                                key={tag.id}
                                size="sm"
                                variant={selected ? "default" : "outline"}
                                onClick={() =>
                                  setFormState((previous) => ({
                                    ...previous,
                                    inspirationModifiers: toggleSelection(
                                      previous.inspirationModifiers,
                                      tag.id,
                                      !selected,
                                    ),
                                  }))
                                }
                              >
                                {tag.label}
                              </Button>
                            );
                          })}
                        </div>
                      </div>

                      <div>
                        <Label className="flex items-center gap-2 mb-2">
                          <Sparkles className="h-4 w-4 text-purple-500" />
                          Mood Palette
                        </Label>
                        <div className="flex flex-wrap gap-2">
                          {MOOD_TAGS.map((tag) => {
                            const selected = formState.moodModifiers.includes(tag.id);
                            return (
                              <Button
                                type="button"
                                key={tag.id}
                                size="sm"
                                variant={selected ? "default" : "outline"}
                                onClick={() =>
                                  setFormState((previous) => ({
                                    ...previous,
                                    moodModifiers: toggleSelection(previous.moodModifiers, tag.id, !selected),
                                  }))
                                }
                              >
                                {tag.label}
                              </Button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </TabsContent>

                  {/* Tab 3: Collaborators */}
                  <TabsContent value="collaborators" className="space-y-4 mt-0">
                    <div className="space-y-2">
                      <Label htmlFor="project-writing-mode">Writing Mode *</Label>
                      <Select
                        value={formState.writingMode || "none"}
                        onValueChange={(value) =>
                          setFormState((previous) => ({ ...previous, writingMode: value === "none" ? "" : value }))
                        }
                      >
                        <SelectTrigger id="project-writing-mode">
                          <SelectValue placeholder="How will this sprint run?" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Decide later</SelectItem>
                          {WRITING_MODE_OPTIONS.map((option) => (
                            <SelectItem key={option.id} value={option.id}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        {selectedWritingMode?.description ?? "Pick a mode to set expectations for collaborators."}
                      </p>
                      {formErrors.writingMode && <p className="text-sm text-destructive">{formErrors.writingMode}</p>}
                    </div>

                    <div className="space-y-3">
                      <div>
                        <Label className="text-sm font-semibold mb-2 block">Co-writers</Label>
                        <p className="text-xs text-muted-foreground mb-3">
                          Invite collaborators to shape the song. Royalty splits will be calculated automatically.
                        </p>
                        <div className="space-y-2">
                          {CO_WRITER_OPTIONS.map((option) => (
                            <label
                              key={option.id}
                              className="flex items-start gap-2 p-2 rounded-md border hover:bg-muted/50 cursor-pointer"
                            >
                              <Checkbox
                                checked={formState.coWriters.includes(option.id)}
                                onCheckedChange={(checked) =>
                                  setFormState((previous) => ({
                                    ...previous,
                                    coWriters: toggleSelection(previous.coWriters, option.id, Boolean(checked)),
                                  }))
                                }
                              />
                              <div className="space-y-1">
                                <p className="text-sm font-medium">{option.label}</p>
                                <p className="text-xs text-muted-foreground">
                                  {option.description ?? option.familiarity}
                                </p>
                              </div>
                            </label>
                          ))}
                        </div>
                        {plannedCoWriterSplits.length > 0 && (
                          <div className="mt-3 rounded-md bg-muted p-3">
                            <p className="text-xs font-semibold mb-2 flex items-center gap-1">
                              <Users className="h-3.5 w-3.5" /> Royalty Split Preview
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {plannedCoWriterSplits.map((entry) => (
                                <Badge key={entry.id} variant="secondary">
                                  {entry.label}: {entry.split}%
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      <div>
                        <Label className="text-sm font-semibold mb-2 block">Producer Leadership</Label>
                        <div className="space-y-2">
                          {PRODUCER_OPTIONS.map((option) => (
                            <label key={option.id} className="flex items-start gap-2 p-2 rounded-md border hover:bg-muted/50 cursor-pointer">
                              <Checkbox
                                checked={formState.producers.includes(option.id)}
                                onCheckedChange={(checked) =>
                                  setFormState((previous) => ({
                                    ...previous,
                                    producers: toggleSelection(previous.producers, option.id, Boolean(checked)),
                                  }))
                                }
                              />
                              <div className="space-y-1">
                                <p className="text-sm font-medium">{option.label}</p>
                                {option.description && (
                                  <p className="text-xs text-muted-foreground">{option.description}</p>
                                )}
                              </div>
                            </label>
                          ))}
                        </div>
                      </div>

                      <div>
                        <Label className="text-sm font-semibold mb-2 block">Session Musicians</Label>
                        <div className="grid gap-2 sm:grid-cols-2">
                          {SESSION_MUSICIAN_OPTIONS.map((option) => (
                            <label key={option.id} className="flex items-center gap-2 text-sm p-2 rounded-md border hover:bg-muted/50 cursor-pointer">
                              <Checkbox
                                checked={formState.sessionMusicians.includes(option.id)}
                                onCheckedChange={(checked) =>
                                  setFormState((previous) => ({
                                    ...previous,
                                    sessionMusicians: toggleSelection(previous.sessionMusicians, option.id, Boolean(checked)),
                                  }))
                                }
                              />
                              <span>{option.label}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>
                  </TabsContent>
                </div>
              </Tabs>

              <div className="flex justify-end gap-2 mt-6 pt-4 border-t">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createProject.isPending || updateProject.isPending}>
                  {selectedProject ? "Update Project" : "Create Project"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      <Card className="overflow-hidden">
        <CardContent className="p-4 md:py-6">
          <div className="grid gap-3 md:gap-4 grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border bg-card p-4">
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                Active Projects
                <NotebookPen className="h-4 w-4" />
              </div>
              <p className="mt-2 text-2xl font-semibold">{activeProjects}</p>
              <p className="text-xs text-muted-foreground">Songs currently in writing or arranging phases.</p>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                Focus Minutes Logged
                <ClockIcon className="h-4 w-4" />
              </div>
              <p className="mt-2 text-2xl font-semibold">{formatNumber.format(focusMinutes)}</p>
              <p className="text-xs text-muted-foreground">Cumulative deep work invested across all projects.</p>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                Average Quality
                <Trophy className="h-4 w-4" />
              </div>
              <p className="mt-2 text-2xl font-semibold">{averageQualityDescriptor.label}</p>
              <p className="text-xs text-muted-foreground">{averageQualityDescriptor.hint}</p>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                Release Ready
                <Sparkles className="h-4 w-4" />
              </div>
              <p className="mt-2 text-2xl font-semibold">{completedProjects}</p>
              <p className="text-xs text-muted-foreground">Projects that hit 100% on both creative tracks.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Filter className="h-4 w-4" />
            Refine your view
          </CardTitle>
          <CardDescription>Slice your studio dashboard by status, theme, and sprint readiness.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  {statusOptions.map((status) => (
                    <SelectItem key={status.value} value={status.value}>
                      {status.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Theme</Label>
              <Select value={themeFilter} onValueChange={setThemeFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All themes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All themes</SelectItem>
                  {themesList.map((theme) => (
                    <SelectItem key={theme.id} value={theme.id}>
                      {theme.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2 border rounded-md p-3">
              <Checkbox
                id="filter-active"
                checked={showActiveOnly}
                onCheckedChange={(checked) => setShowActiveOnly(Boolean(checked))}
              />
              <Label htmlFor="filter-active" className="text-sm font-medium">
                Active sprint in progress
              </Label>
            </div>
            <div className="flex items-center gap-2 border rounded-md p-3">
              <Checkbox
                id="filter-ready"
                checked={showReadyOnly}
                onCheckedChange={(checked) => setShowReadyOnly(Boolean(checked))}
              />
              <Label htmlFor="filter-ready" className="text-sm font-medium">
                Ready for polish or release
              </Label>
            </div>
            <div className="flex items-center gap-2 border rounded-md p-3">
              <Checkbox
                id="filter-locked"
                checked={showLockedOnly}
                onCheckedChange={(checked) => setShowLockedOnly(Boolean(checked))}
              />
              <Label htmlFor="filter-locked" className="text-sm font-medium">
                Currently locked for recovery
              </Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {globalActivityLock.locked && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          You're currently focused on {globalActivityLock.label ?? "another activity"}.{" "}
          {globalActivityCountdown
            ? `You'll be free ${globalActivityCountdown}.`
            : "Wrap up your current activity to start a new sprint."}
        </div>
      )}

      {filteredProjects.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Music className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No songwriting projects yet</h3>
            <p className="text-muted-foreground text-center mb-4 max-w-md">
              Capture a new concept, set creative targets, and let focus sprints carry you to a finished song.
            </p>
            <Button onClick={handleOpenCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Start your first project
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredProjects.map((project) => {
            const isLocked = project.is_locked && project.locked_until && new Date(project.locked_until) > new Date();

            return (
              <SimplifiedProjectCard
                key={project.id}
                project={project}
                isLocked={!!isLocked}
                onStartSession={() => handleStartSession(project)}
                onEdit={() => handleEdit(project)}
                onDelete={() => handleDelete(project)}
                onViewHistory={() => {
                  setHistoryProject(project);
                  setIsHistoryOpen(true);
                }}
                onComplete={() => refetchProjects()}
              />
            );
          })}
        </div>
      )}

      <Dialog open={Boolean(completionProject)} onOpenChange={handleCompletionDialogChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Log your sprint notes</DialogTitle>
            <DialogDescription>
              Capture the breakthroughs from this focus session before marking it complete.
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleCompleteSessionSubmit}>
            <div className="space-y-2">
              <Label htmlFor="completion-notes">What did you accomplish?</Label>
              <Textarea
                id="completion-notes"
                value={completionNotes}
                onChange={(event) => setCompletionNotes(event.target.value)}
                placeholder="Captured a new chorus hook, refined verse lyrics..."
              />
              <p className="text-xs text-muted-foreground text-right">{formatWordCount(completionNotes)}</p>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => handleCompletionDialogChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!completionProject || completeSession.isPending}>
                Complete Sprint
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Song Completion Dialog */}
      <SongCompletionDialog
        open={showCompletionDialog}
        onOpenChange={(open) => {
          setShowCompletionDialog(open);
          if (!open) {
            setCompletedProject(null);
            setCompletionQuality(null);
            setCompletionXp(0);
          }
        }}
        quality={completionQuality}
        xpEarned={completionXp}
        isInBand={false}
        onKeepPrivate={() => {
          if (completedProject) {
            handleConvertProject(completedProject, 'private');
            setShowCompletionDialog(false);
          }
        }}
        onAddToBand={() => {
          if (completedProject) {
            toast.info("Band catalog feature coming soon!");
            setShowCompletionDialog(false);
          }
        }}
        onListForSale={() => {
          if (completedProject) {
            handleConvertProject(completedProject, 'for_sale');
            setShowCompletionDialog(false);
            toast.success("Song listed on marketplace!");
          }
        }}
        onGift={() => {
          if (completedProject) {
            toast.info("Gifting feature coming soon!");
            setShowCompletionDialog(false);
          }
        }}
      />

      <Dialog open={isHistoryOpen} onOpenChange={handleHistoryDialogChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {historyProject ? `Sprint history · ${historyProject.title}` : "Sprint history"}
            </DialogTitle>
            <DialogDescription>
              Review every focus sprint, including timestamps, gains, and notes captured along the way.
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-72 pr-4">
            <div className="space-y-4">
              {historyProject?.songwriting_sessions && historyProject.songwriting_sessions.length > 0 ? (
                [...historyProject.songwriting_sessions]
                  .sort((a, b) => new Date(b.session_start).getTime() - new Date(a.session_start).getTime())
                  .map((session) => {
                    const started = session.session_start;
                    const ended = session.completed_at ?? session.session_end;
                    return (
                      <div key={session.id} className="rounded-md border p-3 text-sm space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-medium">{new Date(started).toLocaleString()}</p>
                          </div>
                          <Badge variant={session.completed_at ? "default" : "secondary"}>
                            {session.completed_at ? "Completed" : "In progress"}
                          </Badge>
                        </div>
                        {ended && (
                          <p className="text-xs text-muted-foreground">Completed {new Date(ended).toLocaleString()}</p>
                        )}
                        <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                          <div>
                            <p>Music +</p>
                            <p className="font-semibold text-foreground">{session.music_progress_gained ?? 0}</p>
                          </div>
                          <div>
                            <p>Lyrics +</p>
                            <p className="font-semibold text-foreground">{session.lyrics_progress_gained ?? 0}</p>
                          </div>
                          <div>
                            <p>XP</p>
                            <p className="font-semibold text-foreground">{session.xp_earned ?? 0}</p>
                          </div>
                        </div>
                        {session.notes && (
                          <div className="rounded-md bg-muted/40 p-2">
                            <p className="text-xs uppercase text-muted-foreground mb-1">Session notes</p>
                            <p>{session.notes}</p>
                          </div>
                        )}
                      </div>
                    );
                  })
              ) : (
                <div className="text-sm text-muted-foreground">
                  No sprint history recorded yet. Complete a sprint to see it here.
                </div>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Songwriting;
