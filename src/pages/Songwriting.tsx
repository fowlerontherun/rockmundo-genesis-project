import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Music, Plus, Edit, Trash2, Play, CheckCircle2, Clock } from "lucide-react";

type SongwritingStatus = "draft" | "writing" | "ready_to_finish" | "completed";

interface SongwritingSession {
  id: string;
  started_at: string;
  locked_until: string;
  completed_at: string | null;
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
  const [projects, setProjects] = useState<SongwritingProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState<SongwritingProject | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
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

    try {
      const { data, error } = await supabase
        .from("songwriting_projects")
        .select(
          "id, title, lyrics, status, sessions_completed, locked_until, song_id, created_at, updated_at, songwriting_sessions(id, started_at, locked_until, completed_at)"
        )
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false });

      if (error) throw error;
      setProjects(data || []);
    } catch (error) {
      console.error("Error fetching songwriting projects:", error);
      toast.error("Failed to load songwriting projects");
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) {
      return;
    }

    setLoading(true);
    fetchProjects();
  }, [fetchProjects, user?.id]);

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
      }

      setIsDialogOpen(false);
      setSelectedProject(null);
      setFormData({ title: "", lyrics: "", status: "draft", song_id: "" });
      fetchProjects();
    } catch (error) {
      console.error("Error saving songwriting project:", error);
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

    try {
      const { error } = await supabase
        .from("songwriting_projects")
        .delete()
        .eq("id", projectId)
        .eq("user_id", user?.id);

      if (error) throw error;
      toast.success("Project deleted successfully!");
      fetchProjects();
    } catch (error) {
      console.error("Error deleting project:", error);
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
    } catch (error) {
      console.error("Error starting songwriting session:", error);
      toast.error("Failed to start session");
    }
  };

  const handleCompleteSession = async (project: SongwritingProject) => {
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
        .update({ completed_at: completedAt })
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
                  <Label htmlFor="song_id">Linked Song ID (optional)</Label>
                  <Input
                    id="song_id"
                    value={formData.song_id}
                    onChange={(e) => setFormData({ ...formData, song_id: e.target.value })}
                    placeholder="Attach an existing song"
                  />
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
          {projects.map((project) => {
            const activeSession = project.songwriting_sessions?.find((session) => !session.completed_at) || null;
            const { locked, message } = getLockMessage(project.locked_until);
            const progressTarget = STATUS_THRESHOLDS.completed;
            const progressValue = Math.min((project.sessions_completed / progressTarget) * 100, 100);
            const sessionsRemaining = Math.max(progressTarget - project.sessions_completed, 0);

            return (
              <Card key={project.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <CardTitle className="text-lg">{project.title}</CardTitle>
                      <CardDescription>
                        {project.song_id ? `Linked song: ${project.song_id}` : "No linked song"}
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

                  <div className="flex flex-col gap-2">
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="flex-1"
                        onClick={() => handleStartSession(project)}
                        disabled={locked || !!activeSession}
                      >
                        <Play className="h-3 w-3 mr-1" />
                        Start Sprint
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        onClick={() => handleCompleteSession(project)}
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
                  </div>

                  <div className="flex justify-between items-center pt-2">
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => handleEdit(project)}>
                        <Edit className="h-3 w-3" />
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleDelete(project.id)}>
                        <Trash2 className="h-3 w-3" />
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
    </div>
  );
};

export default Songwriting;
