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
import { Badge } from "@/components/ui/badge";
import { MUSIC_GENRES, getGenreSkillSlug } from "@/data/genres";
import { calculateSongQuality, canStartSongwriting, canWriteGenre } from "@/utils/songQuality";
import { getSongRating } from "@/data/songRatings";
import { AILyricsGenerator } from "@/components/songwriting/AILyricsGenerator";
import { SongQualityBreakdown } from "@/components/songwriting/SongQualityBreakdown";
import { SongCompletionDialog } from "@/components/songwriting/SongCompletionDialog";
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
  effortLevel: SessionEffortOption["id"];
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
  effortLevel: DEFAULT_EFFORT_OPTION.id,
};

const SONG_SELECT_VARIANTS: ReadonlyArray<ReadonlyArray<string>> = [
  [
    "id",
    "title",
    "genre",
    "status",
    "quality_score",
    "song_rating",
    "streams",
    "revenue",
    "release_date",
    "rating_revealed_at",
    "duration_seconds",
    "duration_display",
  ],
  ["id", "title", "genre", "status", "quality_score", "song_rating", "release_date", "rating_revealed_at", "duration_seconds", "duration_display"],
  ["id", "title", "genre", "status", "quality_score", "song_rating", "duration_seconds", "duration_display"],
  ["id", "title", "genre", "status", "duration_seconds", "duration_display"],
];

type SongFilterStrategy = {
  column: "user_id" | "profile_id" | null;
  requires?: "user" | "profile";
};

const SONG_FILTER_STRATEGIES: ReadonlyArray<SongFilterStrategy> = [
  { column: "user_id", requires: "user" },
  { column: "profile_id", requires: "profile" },
  { column: null },
];

const SONG_ORDER_COLUMNS: ReadonlyArray<string | null> = ["updated_at", "created_at", null];

const SONG_QUERY_MAX_ATTEMPTS =
  SONG_SELECT_VARIANTS.length + SONG_FILTER_STRATEGIES.length + SONG_ORDER_COLUMNS.length + 2;

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

const isMissingColumnError = (error: unknown, columnName: string): boolean => {
  const context = getPostgrestErrorContext(error);

  if (!context) {
    return false;
  }

  if (context.code === "42703") {
    return true;
  }

  if (!context.haystack) {
    return false;
  }

  const normalizedColumn = columnName.toLowerCase();

  return (
    context.haystack.includes(normalizedColumn) &&
    (context.haystack.includes("column") || context.haystack.includes("does not exist") || context.haystack.includes("schema cache"))
  );
};

const findNextVariantWithoutColumn = (currentIndex: number, columnName: string): number => {
  const target = columnName.toLowerCase();

  for (let index = currentIndex + 1; index < SONG_SELECT_VARIANTS.length; index += 1) {
    const variant = SONG_SELECT_VARIANTS[index];
    const hasColumn = variant.some((column) => column.toLowerCase() === target);

    if (!hasColumn) {
      return index;
    }
  }

  return -1;
};

const formatErrorForLog = (error: unknown): Record<string, unknown> => {
  if (error && typeof error === "object") {
    return { ...(error as Record<string, unknown>) };
  }

  return {
    error: typeof error === "string" ? error : String(error),
  };
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
  const songsTableAvailableRef = useRef(true);
  const songSelectVariantRef = useRef(0);
  const songFilterStrategyRef = useRef(0);
  const songOrderIndexRef = useRef(0);
  const [statusFilter, setStatusFilter] = useState<string>("all");
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
    const profileId = profile?.id ?? null;

    if (!userId && !profileId) {
      setSongs([]);
      return;
    }

    if (!songsTableAvailableRef.current) {
      setSongs([]);
      return;
    }

    logger.info("Fetching songs for songwriting", { userId, profileId });

    try {
      let selectIndex = Math.min(songSelectVariantRef.current, SONG_SELECT_VARIANTS.length - 1);
      let filterIndex = Math.min(songFilterStrategyRef.current, SONG_FILTER_STRATEGIES.length - 1);
      let orderIndex = Math.min(songOrderIndexRef.current, SONG_ORDER_COLUMNS.length - 1);
      let attempts = 0;
      let lastError: unknown = null;

      while (attempts < SONG_QUERY_MAX_ATTEMPTS) {
        const selectColumns =
          SONG_SELECT_VARIANTS[selectIndex] ?? SONG_SELECT_VARIANTS[SONG_SELECT_VARIANTS.length - 1];
        const selectClause = selectColumns.join(", ");

        let query: any = supabase.from("songs").select(selectClause);
        let appliedFilterIndex = filterIndex;
        let filterApplied = false;

        while (appliedFilterIndex < SONG_FILTER_STRATEGIES.length && !filterApplied) {
          const strategy = SONG_FILTER_STRATEGIES[appliedFilterIndex];

          if (!strategy.column) {
            filterApplied = true;
            break;
          }

          if (strategy.column === "user_id") {
            if (userId) {
              query = query.eq("user_id", userId);
              filterApplied = true;
              break;
            }
          } else if (strategy.column === "profile_id") {
            if (profileId) {
              query = query.eq("profile_id", profileId);
              filterApplied = true;
              break;
            }
          }

          appliedFilterIndex += 1;
        }

        if (!filterApplied) {
          appliedFilterIndex = SONG_FILTER_STRATEGIES.length - 1;
        }

        if (appliedFilterIndex !== filterIndex) {
          filterIndex = appliedFilterIndex;
          songFilterStrategyRef.current = filterIndex;
        }

        const orderColumn = SONG_ORDER_COLUMNS[orderIndex] ?? null;
        if (orderColumn) {
          query = query.order(orderColumn, { ascending: false });
        }

        const { data, error, status, statusText } = await query;

        if (!error) {
          songSelectVariantRef.current = selectIndex;
          songFilterStrategyRef.current = filterIndex;
          songOrderIndexRef.current = orderIndex;

          const resolvedSongs = Array.isArray(data) ? (data as unknown as Song[]) : [];
          setSongs(resolvedSongs);
          return;
        }

        if (status === 404 || isMissingTableError(error, "songs")) {
          songsTableAvailableRef.current = false;
          logger.warn("Songs table is unavailable; skipping future queries", {
            status,
            statusText,
            ...formatErrorForLog(error),
          });
          setSongs([]);
          return;
        }

        const orderColumnName = orderColumn;
        if (orderColumnName && isMissingColumnError(error, orderColumnName)) {
          if (orderIndex < SONG_ORDER_COLUMNS.length - 1) {
            orderIndex += 1;
            songOrderIndexRef.current = orderIndex;
            const fallbackOrder = SONG_ORDER_COLUMNS[orderIndex] ?? "none";
            logger.warn(
              `Songs ordering column '${orderColumnName}' unavailable; falling back to '${fallbackOrder}'.`,
              {
                ...formatErrorForLog(error),
              },
            );
            attempts += 1;
            continue;
          }
        }

        const activeFilterColumn = SONG_FILTER_STRATEGIES[filterIndex]?.column;
        if (activeFilterColumn && isMissingColumnError(error, activeFilterColumn)) {
          if (filterIndex < SONG_FILTER_STRATEGIES.length - 1) {
            const previousColumn = activeFilterColumn;
            filterIndex += 1;
            songFilterStrategyRef.current = filterIndex;
            logger.warn(`Songs filter column '${previousColumn}' unavailable; adjusting filter strategy.`, {
              ...formatErrorForLog(error),
            });
            attempts += 1;
            continue;
          }
        }

        const missingColumn = selectColumns.find((column) => isMissingColumnError(error, column));
        if (missingColumn) {
          const nextIndex = findNextVariantWithoutColumn(selectIndex, missingColumn);
          if (nextIndex !== -1) {
            selectIndex = nextIndex;
            songSelectVariantRef.current = selectIndex;
            logger.warn(`Songs column '${missingColumn}' unavailable; falling back to reduced selection.`, {
              ...formatErrorForLog(error),
            });
            attempts += 1;
            continue;
          }
        }

        lastError = error;
        break;
      }

      if (lastError) {
        throw lastError;
      }

      throw new Error("Unable to fetch songs due to unknown error");
    } catch (error) {
      logger.error("Error fetching songs for songwriting", {
        userId,
        profileId,
        ...formatErrorForLog(error),
      });
      toast.error("Failed to load songs for linking");
    }
  }, [user?.id, profile?.id]);

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
  const selectedEffortOption = useMemo(
    () => SESSION_EFFORT_OPTIONS.find((option) => option.id === formState.effortLevel) ?? DEFAULT_EFFORT_OPTION,
    [formState.effortLevel],
  );

  const songMap = useMemo(() => {
    return songs.reduce<Record<string, Song>>((accumulator, song) => {
      accumulator[song.id] = song;
      return accumulator;
    }, {});
  }, [songs]);

  useEffect(() => {
    // Only update if projects actually changed (by checking length and IDs)
    const projectIds = projectsList.map(p => p.id).join(',');
    
    setEffortSelections((previous) => {
      const nextSelections = { ...previous };
      let hasChanges = false;
      
      projectsList.forEach((project) => {
        if (!project.id || nextSelections[project.id]) {
          return;
        }
        hasChanges = true;
        const defaultEffort = SESSION_EFFORT_OPTIONS.find(
          (option) => option.id === (project.creative_brief?.effort_level as SessionEffortOption["id"]),
        );
        nextSelections[project.id] = defaultEffort?.id ?? DEFAULT_EFFORT_OPTION.id;
      });
      
      return hasChanges ? nextSelections : previous;
    });

    setSessionParticipants((previous) => {
      const nextParticipants = { ...previous };
      let hasChanges = false;
      
      projectsList.forEach((project) => {
        if (!project.id || nextParticipants[project.id]) {
          return;
        }
        hasChanges = true;
        nextParticipants[project.id] = {
          coWriters: project.creative_brief?.co_writers?.map((writer) => writer.id) ?? [],
          producers: project.creative_brief?.producers ?? [],
          musicians: project.creative_brief?.session_musicians ?? [],
        };
      });
      
      return hasChanges ? nextParticipants : previous;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projects]); // Use projects from query, not computed projectsList

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
      const matchesStatus =
        statusFilter === "all" ||
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
      effortLevel: (creativeBrief?.effort_level as SessionEffortOption["id"]) ?? DEFAULT_EFFORT_OPTION.id,
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
      effort_level: formState.effortLevel,
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

    try {
      await completeSession.mutateAsync({
        sessionId: activeSession.id,
        notes: completionNotes,
        effortHours: activeSession.effort_hours ?? undefined,
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
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="project-title">Project Title</Label>
                <Input
                  id="project-title"
                  value={formState.title}
                  onChange={(event) => setFormState((previous) => ({ ...previous, title: event.target.value }))}
                  placeholder="anthemic stadium rock banger"
                  aria-invalid={Boolean(formErrors.title)}
                />
                {formErrors.title && <p className="text-sm text-destructive">{formErrors.title}</p>}
              </div>

              <div className="grid gap-4 md:grid-cols-2">
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
                      <SelectValue placeholder="Choose a theme" />
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
                      <SelectValue placeholder="Select a progression" />
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
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="project-genre">Primary Genre</Label>
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
                      {genreOptions.map((genre) => (
                        <SelectItem key={genre.id} value={genre.id}>
                          {genre.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {formErrors.genre && <p className="text-sm text-destructive">{formErrors.genre}</p>}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="project-writing-mode">Writing Mode</Label>
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
                <div className="space-y-2">
                  <Label htmlFor="project-effort">Effort Level</Label>
                  <Select
                    value={formState.effortLevel}
                    onValueChange={(value: SessionEffortOption["id"]) =>
                      setFormState((previous) => ({ ...previous, effortLevel: value }))
                    }
                  >
                    <SelectTrigger id="project-effort">
                      <SelectValue placeholder="Choose focus window" />
                    </SelectTrigger>
                    <SelectContent>
                      {SESSION_EFFORT_OPTIONS.map((option) => (
                        <SelectItem key={option.id} value={option.id}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">{selectedEffortOption.description}</p>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-3 rounded-md border p-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-semibold">Co-writers</Label>
                    <Badge variant="outline">{formState.coWriters.length} selected</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Invite collaborators to shape the song. We'll preview the royalty split.
                  </p>
                  <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                    {CO_WRITER_OPTIONS.map((option) => (
                      <label
                        key={option.id}
                        className="flex items-start gap-2 rounded-md border border-transparent p-2 hover:border-muted-foreground/40"
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
                          <p className="text-sm font-medium text-foreground">{option.label}</p>
                          {(option.description || option.familiarity) && (
                            <p className="text-xs text-muted-foreground">
                              {option.description ?? option.familiarity}
                            </p>
                          )}
                        </div>
                      </label>
                    ))}
                  </div>
                  {plannedCoWriterSplits.length > 0 && (
                    <div className="rounded-md bg-muted/40 p-2 text-xs">
                      <p className="mb-1 flex items-center gap-1 font-semibold text-foreground">
                        <Users className="h-3.5 w-3.5" /> Royalty preview
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
                <div className="space-y-3">
                  <div className="rounded-md border p-3 space-y-2">
                    <Label className="text-sm font-semibold">Producer leadership</Label>
                    <div className="space-y-2">
                      {PRODUCER_OPTIONS.map((option) => (
                        <label key={option.id} className="flex items-start gap-2 rounded-md border border-transparent p-2 hover:border-muted-foreground/40">
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
                            <p className="text-sm font-medium text-foreground">{option.label}</p>
                            {option.description && (
                              <p className="text-xs text-muted-foreground">{option.description}</p>
                            )}
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-md border p-3 space-y-2">
                    <Label className="text-sm font-semibold">Session musicians</Label>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {SESSION_MUSICIAN_OPTIONS.map((option) => (
                        <label key={option.id} className="flex items-center gap-2 text-sm">
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
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-md border p-3 space-y-2">
                  <Label className="flex items-center gap-2 text-sm font-semibold">
                    <Lightbulb className="h-4 w-4 text-amber-500" /> Inspiration anchors
                  </Label>
                  <div className="flex flex-wrap gap-2">
                    {INSPIRATION_TAGS.map((tag) => {
                      const selected = formState.inspirationModifiers.includes(tag.id);
                      return (
                        <Button
                          type="button"
                          key={tag.id}
                          size="sm"
                          variant={selected ? "default" : "secondary"}
                          className={selected ? "bg-primary text-primary-foreground" : ""}
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
                <div className="rounded-md border p-3 space-y-2">
                  <Label className="flex items-center gap-2 text-sm font-semibold">
                    <Sparkles className="h-4 w-4 text-purple-500" /> Mood palette
                  </Label>
                  <div className="flex flex-wrap gap-2">
                    {MOOD_TAGS.map((tag) => {
                      const selected = formState.moodModifiers.includes(tag.id);
                      return (
                        <Button
                          type="button"
                          key={tag.id}
                          size="sm"
                          variant={selected ? "default" : "secondary"}
                          className={selected ? "bg-primary text-primary-foreground" : ""}
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

              <div className="rounded-md border border-dashed border-muted-foreground/40 bg-muted/30 p-3 text-xs text-muted-foreground">
                Save your project to let the game estimate session counts and progress targets based on your current skills and attributes.
              </div>

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
                
                {/* AI Lyrics Generator */}
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
              </div>

              <div className="flex justify-end gap-2">
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
            const statusMeta = getStatusMeta(project.status);
            const activeSession = findActiveSession(project.songwriting_sessions);
            const lockState = computeLockState(project.locked_until ?? null);
            const linkedSong = project.song_id ? songMap[project.song_id] : undefined;
            const musicPercent = getProgressPercent(project.music_progress);
            const lyricsPercent = getProgressPercent(project.lyrics_progress);
            const canConvert =
              (project.music_progress ?? 0) >= PROGRESS_TARGET &&
              (project.lyrics_progress ?? 0) >= PROGRESS_TARGET &&
              !project.song_id;
            const ratingDescriptor = getSongQualityDescriptor(project.song_rating ?? project.quality_score ?? 0);
            const totalSessions = project.total_sessions ?? 0;
            const sessionTarget = Math.max(
              project.estimated_completion_sessions ??
                project.estimated_sessions ??
                Math.max(totalSessions, 3),
              1
            );
            const linkedSongQuality = linkedSong
              ? getSongQualityDescriptor(linkedSong.song_rating ?? linkedSong.quality_score ?? 0)
              : null;
            const coreAttributes = computeCoreAttributes(project);
            const participantState = sessionParticipants[project.id] ?? {
              coWriters: project.creative_brief?.co_writers?.map((writer) => writer.id) ?? [],
              producers: project.creative_brief?.producers ?? [],
              musicians: project.creative_brief?.session_musicians ?? [],
            };
            const selectedEffort =
              SESSION_EFFORT_OPTIONS.find(
                (option) => option.id === (effortSelections[project.id] ?? DEFAULT_EFFORT_OPTION.id),
              ) ?? DEFAULT_EFFORT_OPTION;
            const ratingRevealed = Boolean(
              rehearsalUnlocks[project.id] ||
                project.creative_brief?.rating_revealed_at ||
                linkedSong?.rating_revealed_at,
            );
            const qualityDescriptor = linkedSongQuality ?? ratingDescriptor;
            const inspirationTags = project.creative_brief?.inspiration_modifiers ?? [];
            const moodTags = project.creative_brief?.mood_modifiers ?? [];
            const inspirationLabels = inspirationTags.map((id) => inspirationTagMap[id]?.label ?? id);
            const moodLabels = moodTags.map((id) => moodTagMap[id]?.label ?? id);
            const coWriterSplits = computeCoWriterSplits(project);

            return (
              <Card key={project.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <CardTitle className="text-lg flex flex-wrap items-center gap-2">
                        {project.title}
                        {project.song_themes?.name && (
                          <Badge variant="outline">{project.song_themes.name}</Badge>
                        )}
                      </CardTitle>
                      <CardDescription className="flex flex-col gap-1 text-xs text-muted-foreground">
                        {project.chord_progressions ? (
                          <span>
                            Progression: <span className="font-medium">{project.chord_progressions.name}</span> · {project.chord_progressions.progression}
                          </span>
                        ) : (
                          <span>No chord progression assigned yet</span>
                        )}
                        {project.theme_id && project.song_themes?.mood && (
                          <span>Mood: {project.song_themes.mood}</span>
                        )}
                      </CardDescription>
                    </div>
                    <Badge variant={statusMeta.badge}>{statusMeta.label}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-5 text-sm">
                  <div className="space-y-3">
                    <div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Music Progress</span>
                        <span>{musicPercent}%</span>
                      </div>
                      <Progress value={musicPercent} className="mt-1 h-2" />
                    </div>
                    <div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Lyrics Progress</span>
                        <span>{lyricsPercent}%</span>
                      </div>
                      <Progress value={lyricsPercent} className="mt-1 h-2" />
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-xs text-muted-foreground">
                      <div>
                        <p>Sessions Logged</p>
                        <p className="text-base font-semibold text-foreground">
                          {totalSessions} / {sessionTarget}
                        </p>
                        <p className="text-[11px] text-muted-foreground">Target adjusts with your growing skills.</p>
                      </div>
                      <div>
                        <p>Rating</p>
                        <p className="text-base font-semibold text-foreground">{ratingDescriptor.label}</p>
                        <p className="text-[11px] text-muted-foreground">{ratingDescriptor.hint}</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
                    {["lyrics", "melody", "rhythm", "arrangement", "production"].map((attribute) => (
                      <div key={attribute} className="rounded-md border bg-muted/40 p-3">
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                          {attribute}
                        </p>
                        <p className="text-lg font-semibold text-foreground">
                          {coreAttributes[attribute as keyof typeof coreAttributes]}/100
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="rounded-md border p-3 space-y-2">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Song rating</p>
                        {ratingRevealed ? (
                          <div>
                            <p className="flex items-center gap-2 text-lg font-semibold text-foreground">
                              <BadgeCheck className="h-4 w-4 text-primary" /> {qualityDescriptor.label}
                            </p>
                            <p className="text-xs text-muted-foreground">{qualityDescriptor.hint}</p>
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground">
                            Run a rehearsal checkpoint to reveal the rating for this concept.
                          </p>
                        )}
                      </div>
                      {!ratingRevealed && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleUnlockRating(project)}
                          disabled={updateProject.isPending}
                          className="self-start"
                        >
                          <LockOpen className="mr-1 h-3 w-3" /> Reveal after rehearsal
                        </Button>
                      )}
                    </div>
                    {ratingRevealed && (
                      <p className="text-xs text-muted-foreground">
                        Revealed {new Date(
                          project.creative_brief?.rating_revealed_at ??
                            linkedSong?.rating_revealed_at ??
                            new Date().toISOString(),
                        ).toLocaleString()}
                      </p>
                    )}
                  </div>

                  <div className="grid gap-4 lg:grid-cols-2">
                  <div className="space-y-3">
                      {project.initial_lyrics && (
                        <div className="rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground space-y-1">
                          <p className="uppercase font-semibold text-[10px] tracking-wider">Lyrics & Notes</p>
                          <ScrollArea className="h-32 w-full">
                            <p className="text-foreground whitespace-pre-wrap">{project.initial_lyrics}</p>
                          </ScrollArea>
                        </div>
                      )}

                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <ClockIcon className="h-4 w-4" />
                        <span className={lockState.locked ? "text-amber-600" : "text-emerald-600"}>{lockState.message}</span>
                      </div>

                      {(inspirationLabels.length > 0 || moodLabels.length > 0) && (
                        <>
                          <div className="rounded-md border p-3 space-y-3">
                            {inspirationLabels.length > 0 && (
                              <div>
                                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Inspiration</p>
                                <div className="flex flex-wrap gap-2">
                                  {inspirationLabels.map((label) => (
                                    <Badge key={label} variant="outline">
                                      {label}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )}
                            {moodLabels.length > 0 && (
                              <div>
                                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Mood</p>
                                <div className="flex flex-wrap gap-2">
                                  {moodLabels.map((label) => (
                                    <Badge key={label} variant="outline">
                                      {label}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                          <div>
                            <p className="text-muted-foreground">Rating</p>
                            <p className="font-semibold text-foreground">
                              {linkedSongQuality ? linkedSongQuality.label : "Unknown"}
                            </p>
                          </div>
                        </>
                      )}
                    </div>

                    <div className="space-y-3">
                      {coWriterSplits.length > 0 && (
                        <div className="rounded-md border p-3 space-y-2">
                          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Co-writer splits</p>
                          <div className="flex flex-wrap gap-2">
                            {coWriterSplits.map((entry) => (
                              <Badge key={entry.id} variant="secondary">
                                {entry.label}: {entry.split}%
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="rounded-md border p-3 space-y-3">
                        <div className="space-y-1">
                          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Sprint roster</p>
                          <Select
                            value={effortSelections[project.id] ?? selectedEffort.id}
                            onValueChange={(value: SessionEffortOption["id"]) =>
                              setEffortSelections((previous) => ({ ...previous, [project.id]: value }))
                            }
                          >
                            <SelectTrigger className="h-9 text-sm">
                              <SelectValue placeholder="Select effort level" />
                            </SelectTrigger>
                            <SelectContent>
                              {SESSION_EFFORT_OPTIONS.map((option) => (
                                <SelectItem key={option.id} value={option.id}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-muted-foreground">Locked sprint length: {selectedEffort.hours}h</p>
                        </div>

                        <div className="space-y-2">
                          <p className="text-xs font-semibold text-foreground">Co-writers in this sprint</p>
                          {project.creative_brief?.co_writers?.length ? (
                            <div className="space-y-2">
                              {project.creative_brief.co_writers.map((writer) => {
                                const selected = participantState.coWriters.includes(writer.id);
                                return (
                                  <label key={writer.id} className="flex items-center gap-2 text-xs">
                                    <Checkbox
                                      checked={selected}
                                      onCheckedChange={(checked) =>
                                        updateSessionParticipant(project.id, "coWriters", writer.id, Boolean(checked))
                                      }
                                    />
                                    <div>
                                      <p className="font-medium text-foreground">{writer.name}</p>
                                      {writer.role && (
                                        <p className="text-[11px] text-muted-foreground">{writer.role}</p>
                                      )}
                                    </div>
                                  </label>
                                );
                              })}
                            </div>
                          ) : (
                            <p className="text-xs text-muted-foreground">
                              Add collaborators in the brief to invite them to sessions.
                            </p>
                          )}
                        </div>

                        <div className="space-y-2">
                          <p className="text-xs font-semibold text-foreground">Producers guiding</p>
                          {project.creative_brief?.producers?.length ? (
                            <div className="space-y-2">
                              {project.creative_brief.producers.map((producerId) => {
                                const selected = participantState.producers.includes(producerId);
                                const producer = producerOptionMap[producerId];
                                return (
                                  <label key={producerId} className="flex items-center gap-2 text-xs">
                                    <Checkbox
                                      checked={selected}
                                      onCheckedChange={(checked) =>
                                        updateSessionParticipant(project.id, "producers", producerId, Boolean(checked))
                                      }
                                    />
                                    <span>{producer?.label ?? producerId}</span>
                                  </label>
                                );
                              })}
                            </div>
                          ) : (
                            <p className="text-xs text-muted-foreground">No producers assigned yet.</p>
                          )}
                        </div>

                        <div className="space-y-2">
                          <p className="text-xs font-semibold text-foreground">Session musicians</p>
                          {project.creative_brief?.session_musicians?.length ? (
                            <div className="space-y-2">
                              {project.creative_brief.session_musicians.map((musicianId) => {
                                const selected = participantState.musicians.includes(musicianId);
                                const musician = sessionMusicianOptionMap[musicianId];
                                return (
                                  <label key={musicianId} className="flex items-center gap-2 text-xs">
                                    <Checkbox
                                      checked={selected}
                                      onCheckedChange={(checked) =>
                                        updateSessionParticipant(project.id, "musicians", musicianId, Boolean(checked))
                                      }
                                    />
                                    <span>{musician?.label ?? musicianId}</span>
                                  </label>
                                );
                              })}
                            </div>
                          ) : (
                            <p className="text-xs text-muted-foreground">No session musicians planned.</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        className="flex-1 min-w-[9rem]"
                        onClick={() => handleStartSession(project)}
                        disabled={
                          lockState.locked ||
                          Boolean(activeSession) ||
                          globalActivityLock.locked ||
                          startSession.isPending
                        }
                      >
                        <Play className="h-3 w-3 mr-1" /> Start Sprint
                      </Button>
                      {activeSession && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="min-w-[8rem]"
                          onClick={() => handlePauseSession(project)}
                          disabled={pauseSession.isPending}
                        >
                          <ClockIcon className="mr-1 h-3 w-3" /> Pause
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 min-w-[9rem]"
                        onClick={() => handleOpenCompletionDialog(project)}
                        disabled={!activeSession || completeSession.isPending}
                      >
                        <CheckCircle2 className="h-3 w-3 mr-1" /> Complete Sprint
                      </Button>
                    </div>
                    {activeSession && (
                      <p className="text-center text-xs text-muted-foreground">
                        Active sprint started {new Date(activeSession.started_at ?? activeSession.session_start).toLocaleTimeString()}.
                      </p>
                    )}
                    {globalActivityLock.locked && (
                      <p className="text-center text-xs text-muted-foreground">
                        Global focus busy
                        {globalActivityCountdown ? ` until ${globalActivityCountdown}` : " with another activity."}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={() => handleEdit(project)}>
                        <Edit className="h-3 w-3" />
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleDelete(project)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setHistoryProject(project);
                          setIsHistoryOpen(true);
                        }}
                        disabled={!project.songwriting_sessions?.length}
                      >
                        <History className="h-3 w-3 mr-1" /> History
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleConvertProject(project)}
                        disabled={!canConvert || convertToSong.isPending}
                      >
                        <Wand2 className="h-3 w-3 mr-1" /> Convert to Song
                      </Button>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Updated {new Date(project.updated_at).toLocaleDateString()}
                    </div>
                  </div>
                </CardContent>
              </Card>
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
                  .sort((a, b) => new Date(b.started_at ?? b.session_start).getTime() - new Date(a.started_at ?? a.session_start).getTime())
                  .map((session) => {
                    const started = session.started_at ?? session.session_start;
                    const ended = session.completed_at ?? session.session_end;
                    return (
                      <div key={session.id} className="rounded-md border p-3 text-sm space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-medium">{new Date(started).toLocaleString()}</p>
                            {session.locked_until && (
                              <p className="text-xs text-muted-foreground">
                                Locked until {new Date(session.locked_until).toLocaleTimeString()}
                              </p>
                            )}
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
