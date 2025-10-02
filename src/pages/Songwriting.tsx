import { useState, useMemo, useEffect, useCallback } from "react";
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
} from "@/hooks/useSongwritingData";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
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
import {
  Music,
  Plus,
  Edit,
  Trash2,
  Play,
  CheckCircle2,
  Clock,
  NotebookPen,
  Trophy,
  Filter,
  History,
  Sparkles,
  Wand2,
} from "lucide-react";
import logger from "@/lib/logger";

interface Song {
  id: string;
  title: string;
  genre: string;
  status: string;
  quality_score: number;
  streams: number;
  revenue: number;
  release_date: string | null;
}

interface ProjectFormState {
  title: string;
  theme_id: string;
  chord_progression_id: string;
  initial_lyrics: string;
}

const MAX_PROGRESS = 2000;
const SESSION_DURATION_MINUTES = 80;

const DEFAULT_FORM_STATE: ProjectFormState = {
  title: "",
  theme_id: "",
  chord_progression_id: "",
  initial_lyrics: "",
};

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
  return Math.min(100, Math.round((value / MAX_PROGRESS) * 100));
};
const Songwriting = () => {
  const { user } = useAuth();
  const { activityStatus, startActivity, clearActivityStatus, refreshActivityStatus } = useGameData();
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
    completeSession,
    convertToSong,
  } = useSongwritingData(user?.id);

  const [songs, setSongs] = useState<Song[]>([]);
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

  const fetchSongs = useCallback(async () => {
    if (!user?.id) {
      setSongs([]);
      return;
    }

    logger.info("Fetching songs for songwriting", { userId: user.id });

    try {
      const { data, error } = await supabase
        .from("songs")
        .select("id, title, genre, status, quality_score, streams, revenue, release_date")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false });

      if (error) throw error;
      setSongs(Array.isArray(data) ? (data as Song[]) : []);
    } catch (error) {
      logger.error("Error fetching songs for songwriting", {
        userId: user.id,
        error: error instanceof Error ? error.message : String(error),
      });
      toast.error("Failed to load songs for linking");
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

  const songMap = useMemo(() => {
    return songs.reduce<Record<string, Song>>((accumulator, song) => {
      accumulator[song.id] = song;
      return accumulator;
    }, {});
  }, [songs]);
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
  const focusMinutes = totalSessions * SESSION_DURATION_MINUTES;
  const activeProjects = projectsList.filter((project) =>
    ACTIVE_STATUSES.has((project.status || "").toLowerCase())
  ).length;
  const completedProjects = projectsList.filter((project) =>
    RELEASE_READY_STATUSES.has((project.status || "").toLowerCase()) &&
    (project.music_progress ?? 0) >= MAX_PROGRESS &&
    (project.lyrics_progress ?? 0) >= MAX_PROGRESS
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
  }, []);
  const handleOpenCreate = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const handleEdit = (project: SongwritingProject) => {
    setSelectedProject(project);
    setFormState({
      title: project.title,
      theme_id: project.theme_id ?? "",
      chord_progression_id: project.chord_progression_id ?? "",
      initial_lyrics: project.lyrics ?? project.initial_lyrics ?? "",
    });
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

    const payload = {
      title: formState.title.trim(),
      theme_id: formState.theme_id,
      chord_progression_id: formState.chord_progression_id,
      initial_lyrics: formState.initial_lyrics,
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
        });
      } else {
        await createProject.mutateAsync({
          title: payload.title,
          theme_id: payload.theme_id || null,
          chord_progression_id: payload.chord_progression_id || null,
          initial_lyrics: payload.initial_lyrics ?? undefined,
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
    try {
      await startSession.mutateAsync({ projectId: project.id });
      await startActivity({
        status: "songwriting_session",
        durationMinutes: SESSION_DURATION_MINUTES,
        metadata: { projectId: project.id },
      });
      await refreshActivityStatus();
    } catch (error) {
      logger.error("Failed to start songwriting session", {
        projectId: project.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const handleOpenCompletionDialog = (project: SongwritingProject) => {
    setCompletionProject(project);
    setCompletionNotes("");
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

  const handleConvertProject = async (project: SongwritingProject) => {
    try {
      await convertToSong.mutateAsync(project.id);
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
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Music className="h-8 w-8 text-primary" />
            Songwriting Studio
          </h1>
          <p className="text-muted-foreground mt-2">
            Craft deliberate songwriting sprints, track your progress, and convert finished projects into release-ready songs.
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={handleOpenCreate}>
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
                  required
                />
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
      <Card>
        <CardContent className="py-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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
                <Clock className="h-4 w-4" />
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
              (project.music_progress ?? 0) >= MAX_PROGRESS &&
              (project.lyrics_progress ?? 0) >= MAX_PROGRESS &&
              !project.song_id;
            const qualityDescriptor = getSongQualityDescriptor(project.quality_score ?? 0);
            const totalSessions = project.total_sessions ?? 0;
            const sessionTarget = Math.max(
              project.estimated_completion_sessions ??
                project.estimated_sessions ??
                Math.max(totalSessions, 3),
              1
            );
            const linkedSongQuality = linkedSong
              ? getSongQualityDescriptor(linkedSong.quality_score ?? 0)
              : null;

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
                <CardContent className="space-y-4 text-sm">
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
                        <p className="text-[11px] text-muted-foreground">
                          Target adjusts with your growing skills.
                        </p>
                      </div>
                      <div>
                        <p>Quality</p>
                        <p className="text-base font-semibold text-foreground">{qualityDescriptor.label}</p>
                        <p className="text-[11px] text-muted-foreground">{qualityDescriptor.hint}</p>
                      </div>
                    </div>
                  </div>

                  {project.initial_lyrics && (
                    <div className="rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground space-y-1">
                      <p className="uppercase font-semibold text-[10px] tracking-wider">Concept notes</p>
                      <p className="line-clamp-3 text-foreground">{project.initial_lyrics}</p>
                    </div>
                  )}

                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span className={lockState.locked ? "text-amber-600" : "text-emerald-600"}>{lockState.message}</span>
                  </div>

                  {linkedSong && (
                    <div className="rounded-lg border p-3 text-xs space-y-2 bg-muted/30">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-foreground">{linkedSong.title}</span>
                        <Badge variant="outline">{linkedSong.status}</Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <p className="text-muted-foreground">Genre</p>
                          <p className="font-semibold text-foreground">{linkedSong.genre}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Quality</p>
                          <p className="font-semibold text-foreground">
                            {linkedSongQuality ? linkedSongQuality.label : "Unknown"}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Streams</p>
                          <p className="font-semibold text-foreground">{formatNumber.format(linkedSong.streams)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Revenue</p>
                          <p className="font-semibold text-foreground">{formatCurrency.format(linkedSong.revenue)}</p>
                        </div>
                        <div className="col-span-2">
                          <p className="text-muted-foreground">Release</p>
                          <p className="font-semibold text-foreground">
                            {linkedSong.release_date
                              ? new Date(linkedSong.release_date).toLocaleDateString()
                              : "TBD"}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  <Separator />

                  <div className="flex flex-col gap-2">
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="flex-1"
                        onClick={() => handleStartSession(project)}
                        disabled={
                          lockState.locked ||
                          Boolean(activeSession) ||
                          globalActivityLock.locked ||
                          startSession.isPending
                        }
                      >
                        <Play className="h-3 w-3 mr-1" />
                        Start Sprint
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        onClick={() => handleOpenCompletionDialog(project)}
                        disabled={!activeSession || completeSession.isPending}
                      >
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Complete Sprint
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
                        <History className="h-3 w-3 mr-1" />
                        History
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleConvertProject(project)}
                        disabled={!canConvert || convertToSong.isPending}
                      >
                        <Wand2 className="h-3 w-3 mr-1" />
                        Convert to Song
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
