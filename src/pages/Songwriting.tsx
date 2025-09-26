import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth-context";
import { useGameData } from "@/hooks/useGameData";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
  Music,
  Plus,
  Edit,
  Trash2,
  Play,
  CheckCircle2,
  Clock,
  ListMusic,
  BarChart3,
  NotebookPen,
  Trophy,
  Filter,
  History,
} from "lucide-react";
import logger from "@/lib/logger";
import { formatDistanceToNowStrict } from "date-fns";

type SongwritingStatus = "draft" | "writing" | "ready_to_finish" | "completed";

interface SongwritingSession {
  id: string;
  started_at: string;
  locked_until: string;
  completed_at: string | null;
  notes: string | null;
}

interface SongwritingProject {
  id: string;
  title: string;
  lyrics: string | null;
  status: SongwritingStatus;
  sessions_completed: number;
  locked_until: string | null;
  song_id: string | null;
  created_at: string;
  updated_at: string;
  songwriting_sessions?: SongwritingSession[];
}

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

type StatusConfig = {
  value: SongwritingStatus;
  label: string;
  color: "default" | "secondary" | "destructive" | "outline";
};

const STATUSES: StatusConfig[] = [
  { value: "draft", label: "Draft", color: "secondary" },
  { value: "writing", label: "Writing", color: "default" },
  { value: "ready_to_finish", label: "Ready to Finish", color: "outline" },
  { value: "completed", label: "Completed", color: "default" }
];

const SESSION_DURATION_MINUTES = 25;
const STATUS_THRESHOLDS: Record<Exclude<SongwritingStatus, "draft">, number> = {
  writing: 1,
  ready_to_finish: 4,
  completed: 8
};

const Songwriting = () => {
  const { user } = useAuth();
  const { activityStatus, startActivity, clearActivityStatus, refreshActivityStatus } = useGameData();
  const [projects, setProjects] = useState<SongwritingProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState<SongwritingProject | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [historyProject, setHistoryProject] = useState<SongwritingProject | null>(null);
  const [completionDialogOpen, setCompletionDialogOpen] = useState(false);
  const [completionProject, setCompletionProject] = useState<SongwritingProject | null>(null);
  const [completionNotes, setCompletionNotes] = useState("");
  const [songs, setSongs] = useState<Song[]>([]);
  const [statusFilter, setStatusFilter] = useState<SongwritingStatus | "all">("all");
  const [showActiveOnly, setShowActiveOnly] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    lyrics: "",
    status: "draft" as SongwritingStatus,
    song_id: ""
  });

  const fetchProjects = useCallback(async () => {
    if (!user?.id) {
      return;
    }

    logger.info("Fetching songwriting projects", {
      userId: user.id
    });

    try {
      const { data, error } = await supabase
        .from("songwriting_projects")
        .select(
          "id, title, lyrics, status, sessions_completed, locked_until, song_id, created_at, updated_at, songwriting_sessions(id, started_at, locked_until, completed_at, notes)"
        )
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false });

      if (error) throw error;
      setProjects(data || []);

      logger.info("Fetched songwriting projects successfully", {
        userId: user.id,
        projectCount: data?.length ?? 0
      });
    } catch (error) {
      logger.error("Error fetching songwriting projects", {
        userId: user.id,
        error: error instanceof Error ? error.message : String(error)
      });
      toast.error("Failed to load songwriting projects");
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  const fetchSongs = useCallback(async () => {
    if (!user?.id) {
      return;
    }

    logger.info("Fetching songs for songwriting linking", {
      userId: user.id,
    });

    try {
      const { data, error } = await supabase
        .from("songs")
        .select("id, title, genre, status, quality_score, streams, revenue, release_date")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false });

      if (error) throw error;
      setSongs(data || []);

      logger.info("Fetched songs for songwriting", {
        userId: user.id,
        songCount: data?.length ?? 0,
      });
    } catch (error) {
      logger.error("Error fetching songs for songwriting", {
        userId: user.id,
        error: error instanceof Error ? error.message : String(error),
      });
      toast.error("Failed to load songs for linking");
    }
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) {
      return;
    }

    setLoading(true);
    fetchProjects();
  }, [fetchProjects, user?.id]);

  useEffect(() => {
    void refreshActivityStatus();
  }, [refreshActivityStatus]);

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
      console.error("Failed to compute activity lock countdown", error);
      return null;
    }
  }, [globalActivityLock]);

  const determineNextStatus = (current: SongwritingStatus, completedSessions: number) => {
    if (current === "completed") {
      return current;
    }

    if (completedSessions >= STATUS_THRESHOLDS.completed) {
      return "completed";
    }

    if (completedSessions >= STATUS_THRESHOLDS.ready_to_finish) {
      return "ready_to_finish";
    }

    if (completedSessions >= STATUS_THRESHOLDS.writing) {
      return "writing";
    }

    return current;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const action = selectedProject ? "update" : "create";
    const payload = {
      title: formData.title,
      status: formData.status,
      song_id: formData.song_id || null,
      lyricsLength: formData.lyrics.length
    };

    logger.info("Submitting songwriting project", {
      userId: user.id,
      action,
      projectId: selectedProject?.id,
      payload
    });

    try {
      if (selectedProject) {
        const { error } = await supabase
          .from("songwriting_projects")
          .update({
            title: formData.title,
            lyrics: formData.lyrics,
            status: formData.status,
            song_id: formData.song_id || null,
            updated_at: new Date().toISOString()
          })
          .eq("id", selectedProject.id)
          .eq("user_id", user.id);

        if (error) throw error;
        toast.success("Project updated successfully!");
        logger.info("Songwriting project updated", {
          userId: user.id,
          projectId: selectedProject.id,
          payload
        });
      } else {
        const { error } = await supabase
          .from("songwriting_projects")
          .insert({
            user_id: user.id,
            title: formData.title,
            lyrics: formData.lyrics,
            status: formData.status,
            song_id: formData.song_id || null
          });

        if (error) throw error;
        toast.success("Project created successfully!");
        logger.info("Songwriting project created", {
          userId: user.id,
          payload
        });
      }

      setIsDialogOpen(false);
      setSelectedProject(null);
      setFormData({ title: "", lyrics: "", status: "draft", song_id: "" });
      fetchProjects();
      fetchSongs();
    } catch (error) {
      logger.error("Error saving songwriting project", {
        userId: user.id,
        action,
        projectId: selectedProject?.id,
        payload,
        error: error instanceof Error ? error.message : String(error)
      });
      toast.error("Failed to save project");
    }
  };

  const handleEdit = (project: SongwritingProject) => {
    setSelectedProject(project);
    setFormData({
      title: project.title,
      lyrics: project.lyrics || "",
      status: project.status,
      song_id: project.song_id || ""
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (projectId: string) => {
    if (!confirm("Are you sure you want to delete this songwriting project?")) return;

    logger.info("Deleting songwriting project", {
      userId: user?.id,
      projectId
    });

    try {
      const { error } = await supabase
        .from("songwriting_projects")
        .delete()
        .eq("id", projectId)
        .eq("user_id", user?.id);

      if (error) throw error;
      toast.success("Project deleted successfully!");
      logger.info("Songwriting project deleted", {
        userId: user?.id,
        projectId
      });
      fetchProjects();
    } catch (error) {
      logger.error("Error deleting songwriting project", {
        userId: user?.id,
        projectId,
        error: error instanceof Error ? error.message : String(error)
      });
      toast.error("Failed to delete project");
    }
  };

  const handleStartSession = async (project: SongwritingProject) => {
    if (!user) return;

    const activeSession = project.songwriting_sessions?.find((session) => !session.completed_at);
    if (activeSession) {
      toast.info("You already have an active session for this project.");
      return;
    }

    if (project.locked_until && new Date(project.locked_until) > new Date()) {
      toast.info("This project is currently locked. Try again soon.");
      return;
    }

    if (globalActivityLock.locked) {
      const statusLabel = globalActivityLock.label ?? "another activity";
      const countdown = globalActivityCountdown
        ? `You'll be free ${globalActivityCountdown}.`
        : "Finish your current activity before starting a new sprint.";
      toast.info(`You're currently busy with ${statusLabel}. ${countdown}`);
      return;
    }

    let statusRegistered = false;

    try {
      await startActivity("songwriting_session", {
        durationMinutes: SESSION_DURATION_MINUTES,
        songId: project.song_id || null,
      });
      statusRegistered = true;
    } catch (statusError) {
      console.error("Error starting songwriting status:", statusError);
      toast.info("Session started, but we couldn't update your availability status.");
    }

    try {
      const lockedUntil = new Date(Date.now() + SESSION_DURATION_MINUTES * 60 * 1000).toISOString();

      const { error: sessionError } = await supabase
        .from("songwriting_sessions")
        .insert({
          project_id: project.id,
          user_id: user.id,
          locked_until: lockedUntil
        });

      if (sessionError) throw sessionError;

      const { error: projectError } = await supabase
        .from("songwriting_projects")
        .update({ locked_until: lockedUntil })
        .eq("id", project.id)
        .eq("user_id", user.id);

      if (projectError) throw projectError;

      toast.success("Songwriting session started! Stay focused.");
      fetchProjects();
      if (statusRegistered) {
        void refreshActivityStatus();
      }
    } catch (error) {
      console.error("Error starting songwriting session:", error);
      toast.error("Failed to start session");

      if (statusRegistered) {
        try {
          await clearActivityStatus();
        } catch (clearError) {
          console.error("Failed to revert activity status after session error", clearError);
        } finally {
          void refreshActivityStatus();
        }
      }
    }
  };

  const handleCompleteSession = async (project: SongwritingProject, notes?: string) => {
    if (!user) return;

    const activeSession = project.songwriting_sessions?.find((session) => !session.completed_at);
    if (!activeSession) {
      toast.info("No active session to complete for this project.");
      return;
    }

    try {
      const completedAt = new Date().toISOString();
      const updatedSessions = project.sessions_completed + 1;
      const nextStatus = determineNextStatus(project.status, updatedSessions);

      const { error: sessionError } = await supabase
        .from("songwriting_sessions")
        .update({ completed_at: completedAt, notes: notes?.trim() ? notes.trim() : null })
        .eq("id", activeSession.id)
        .eq("user_id", user.id);

      if (sessionError) throw sessionError;

      const { error: projectError } = await supabase
        .from("songwriting_projects")
        .update({
          sessions_completed: updatedSessions,
          locked_until: null,
          status: nextStatus
        })
        .eq("id", project.id)
        .eq("user_id", user.id);

      if (projectError) throw projectError;

      toast.success("Great job! Session completed.");
      fetchProjects();
      if (activityStatus?.status === "songwriting_session") {
        try {
          await clearActivityStatus();
        } catch (statusError) {
          console.error("Failed to clear songwriting activity status", statusError);
        } finally {
          void refreshActivityStatus();
        }
      }
    } catch (error) {
      console.error("Error completing songwriting session:", error);
      toast.error("Failed to complete session");
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    const statusConfig = STATUSES.find((s) => s.value === status);
    return statusConfig?.color || "secondary";
  };

  const getLockMessage = (lockedUntil: string | null) => {
    if (!lockedUntil) {
      return { locked: false, message: "Ready for the next focus sprint." };
    }

    const lockedDate = new Date(lockedUntil);
    const now = new Date();

    if (lockedDate <= now) {
      return { locked: false, message: "Ready for the next focus sprint." };
    }

    const diffMs = lockedDate.getTime() - now.getTime();
    const diffMinutes = Math.ceil(diffMs / (60 * 1000));
    return {
      locked: true,
      message: `Locked for ${diffMinutes} more minute${diffMinutes === 1 ? "" : "s"}.`
    };
  };

  const totalProjects = projects.length;
  const totalSessions = projects.reduce((sum, project) => sum + project.sessions_completed, 0);
  const activeSprints = projects.filter((project) =>
    project.songwriting_sessions?.some((session) => !session.completed_at)
  ).length;
  const completedProjects = projects.filter((project) => project.status === "completed").length;
  const completionRate = totalProjects ? Math.round((completedProjects / totalProjects) * 100) : 0;
  const totalFocusMinutes = totalSessions * SESSION_DURATION_MINUTES;

  const filteredProjects = useMemo(() => {
    const byStatus =
      statusFilter === "all"
        ? projects
        : projects.filter((project) => project.status === statusFilter);

    if (!showActiveOnly) {
      return byStatus;
    }

    return byStatus.filter((project) =>
      project.songwriting_sessions?.some((session) => !session.completed_at)
    );
  }, [projects, showActiveOnly, statusFilter]);

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

  const handleOpenCompletionDialog = (project: SongwritingProject) => {
    setCompletionProject(project);
    setCompletionNotes("");
    setCompletionDialogOpen(true);
  };

  const handleOpenHistoryDialog = (project: SongwritingProject) => {
    setHistoryProject(project);
    setIsHistoryOpen(true);
  };

  const handleCompleteSessionWithNotes = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!completionProject) {
      return;
    }

    await handleCompleteSession(completionProject, completionNotes);
    setCompletionDialogOpen(false);
    setCompletionProject(null);
    setCompletionNotes("");
  };

  const handleCompletionDialogChange = (open: boolean) => {
    setCompletionDialogOpen(open);
    if (!open) {
      setCompletionProject(null);
      setCompletionNotes("");
    }
  };

  const handleHistoryDialogChange = (open: boolean) => {
    setIsHistoryOpen(open);
    if (!open) {
      setHistoryProject(null);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">Loading songwriting projects...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Music className="h-8 w-8 text-primary" />
            Songwriting Studio
          </h1>
          <p className="text-muted-foreground mt-2">
            Build focused songwriting projects and track your creative momentum
          </p>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogTrigger asChild>
          <Button
              onClick={() => {
                setSelectedProject(null);
                setFormData({ title: "", lyrics: "", status: "draft", song_id: "" });
              }}
            >
              <Plus className="h-4 w-4 mr-2" />
              New Project
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {selectedProject ? "Edit Project" : "Create New Project"}
              </DialogTitle>
              <DialogDescription>
                {selectedProject ? "Update your songwriting plan" : "Start your next hit"}
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Project Title</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="Enter project title"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="song_id">Link to an existing song</Label>
                  <Select
                    value={formData.song_id || "none"}
                    onValueChange={(value) =>
                      setFormData({ ...formData, song_id: value === "none" ? "" : value })
                    }
                  >
                    <SelectTrigger id="song_id">
                      <SelectValue placeholder="Select a song (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No linked song</SelectItem>
                      {songs.length === 0 ? (
                        <SelectItem value="placeholder" disabled>
                          No songs available yet
                        </SelectItem>
                      ) : (
                        songs.map((song) => (
                          <SelectItem key={song.id} value={song.id}>
                            {song.title} · {song.genre}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) => setFormData({ ...formData, status: value as SongwritingStatus })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((status) => (
                      <SelectItem key={status.value} value={status.value}>
                        {status.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="lyrics">Lyrics</Label>
                <Textarea
                  id="lyrics"
                  value={formData.lyrics}
                  onChange={(e) => setFormData({ ...formData, lyrics: e.target.value })}
                  placeholder="Write your lyrics here..."
                  className="min-h-32"
                />
                <div className="text-xs text-muted-foreground text-right">
                  {formData.lyrics.trim() ? `${formData.lyrics.trim().split(/\s+/).length} words` : "0 words"}
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">
                  {selectedProject ? "Update Project" : "Create Project"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {globalActivityLock.locked && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          You're currently busy with {globalActivityLock.label ?? "another activity"}.{" "}
          {globalActivityCountdown
            ? `You'll be free ${globalActivityCountdown}.`
            : "Wrap up your current activity to start a new sprint."}
        </div>
      )}

      {projects.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Music className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No projects yet</h3>
            <p className="text-muted-foreground text-center mb-4">
              Start your musical journey by creating your first songwriting project
            </p>
            <Button onClick={() => setIsDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Your First Project
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredProjects.map((project) => {
            const activeSession = project.songwriting_sessions?.find((session) => !session.completed_at) || null;
            const { locked, message } = getLockMessage(project.locked_until);
            const progressTarget = STATUS_THRESHOLDS.completed;
            const progressValue = Math.min((project.sessions_completed / progressTarget) * 100, 100);
            const sessionsRemaining = Math.max(progressTarget - project.sessions_completed, 0);
            const linkedSong = project.song_id ? songMap[project.song_id] : undefined;
            const lyricsWordCount = project.lyrics?.trim() ? project.lyrics.trim().split(/\s+/).length : 0;

            return (
              <Card key={project.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <CardTitle className="text-lg">{project.title}</CardTitle>
                      <CardDescription>
                        {linkedSong ? (
                          <span className="flex items-center gap-2">
                            Linked song: <span className="font-medium">{linkedSong.title}</span>
                          </span>
                        ) : project.song_id ? (
                          `Linked song: ${project.song_id}`
                        ) : (
                          "No linked song"
                        )}
                      </CardDescription>
                    </div>
                    <Badge variant={getStatusBadgeVariant(project.status)}>
                      {STATUSES.find((s) => s.value === project.status)?.label || project.status}
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Sessions Completed</span>
                      <span className="font-medium">{project.sessions_completed}</span>
                    </div>
                    <Progress value={progressValue} className="h-2" />
                    <p className="text-xs text-muted-foreground">
                      {project.sessions_completed >= progressTarget
                        ? "This project is sprint-ready for final polish!"
                        : `Complete ${sessionsRemaining} more session${sessionsRemaining === 1 ? "" : "s"} to reach mastery.`}
                    </p>
                  </div>

                  {linkedSong && (
                    <div className="rounded-lg border p-3 text-xs space-y-2 bg-muted/40">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{linkedSong.genre}</span>
                        <Badge variant="outline">{linkedSong.status}</Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <p className="text-muted-foreground">Quality</p>
                          <p className="font-semibold">{linkedSong.quality_score}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Streams</p>
                          <p className="font-semibold">{formatNumber.format(linkedSong.streams)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Revenue</p>
                          <p className="font-semibold">{formatCurrency.format(linkedSong.revenue)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Release</p>
                          <p className="font-semibold">
                            {linkedSong.release_date
                              ? new Date(linkedSong.release_date).toLocaleDateString()
                              : "TBD"}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className={locked ? "text-muted-foreground" : "text-emerald-600"}>{message}</span>
                  </div>

                  {project.lyrics && (
                    <div className="text-sm">
                      <span className="text-muted-foreground">Preview:</span>
                      <p className="text-xs mt-1 line-clamp-2 text-muted-foreground">
                        {project.lyrics.substring(0, 100)}...
                      </p>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Lyrics snapshot · {lyricsWordCount} words</span>
                    <span>Created {new Date(project.created_at).toLocaleDateString()}</span>
                  </div>

                  <Separator className="my-2" />

                  <div className="flex flex-col gap-2">
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="flex-1"
                        onClick={() => handleStartSession(project)}
                        disabled={locked || !!activeSession || globalActivityLock.locked}
                      >
                        <Play className="h-3 w-3 mr-1" />
                        Start Sprint
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        onClick={() => handleOpenCompletionDialog(project)}
                        disabled={!activeSession}
                      >
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Complete Sprint
                      </Button>
                    </div>

                    {activeSession && (
                      <div className="text-xs text-muted-foreground text-center">
                        Active sprint started {new Date(activeSession.started_at).toLocaleTimeString()}.
                      </div>
                    )}
                    {globalActivityLock.locked && (
                      <div className="text-xs text-muted-foreground text-center">
                        Global focus busy
                        {globalActivityCountdown ? ` until ${globalActivityCountdown}` : ' with another activity.'}
                      </div>
                    )}
                  </div>

                  <div className="flex justify-between items-center pt-2">
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => handleEdit(project)}>
                        <Edit className="h-3 w-3" />
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleDelete(project.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleOpenHistoryDialog(project)}
                        disabled={!project.songwriting_sessions?.length}
                      >
                        <History className="h-3 w-3 mr-1" />
                        History
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

      <Dialog open={completionDialogOpen} onOpenChange={handleCompletionDialogChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Log your sprint notes</DialogTitle>
            <DialogDescription>
              Capture the breakthroughs from this focus session before marking it complete.
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleCompleteSessionWithNotes}>
            <div className="space-y-2">
              <Label htmlFor="completion-notes">What did you accomplish?</Label>
              <Textarea
                id="completion-notes"
                value={completionNotes}
                onChange={(event) => setCompletionNotes(event.target.value)}
                placeholder="Captured a new chorus hook, refined verse lyrics..."
              />
              <p className="text-xs text-muted-foreground text-right">
                {completionNotes.trim() ? `${completionNotes.trim().split(/\s+/).length} words` : "0 words"}
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setCompletionDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!completionProject}>
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
              Review every focus sprint, including timestamps and notes captured along the way.
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-72 pr-4">
            <div className="space-y-4">
              {historyProject?.songwriting_sessions && historyProject.songwriting_sessions.length > 0 ? (
                [...historyProject.songwriting_sessions]
                  .sort(
                    (a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime()
                  )
                  .map((session) => (
                    <div key={session.id} className="rounded-md border p-3 text-sm space-y-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium">
                            {new Date(session.started_at).toLocaleString()}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Locked until {new Date(session.locked_until).toLocaleTimeString()}
                          </p>
                        </div>
                        <Badge variant={session.completed_at ? "default" : "secondary"}>
                          {session.completed_at ? "Completed" : "In progress"}
                        </Badge>
                      </div>
                      {session.completed_at && (
                        <p className="text-xs text-muted-foreground">
                          Completed {new Date(session.completed_at).toLocaleString()}
                        </p>
                      )}
                      {session.notes && (
                        <div className="rounded-md bg-muted/40 p-2">
                          <p className="text-xs uppercase text-muted-foreground mb-1">Session notes</p>
                          <p>{session.notes}</p>
                        </div>
                      )}
                    </div>
                  ))
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
