import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth-context";
import { useGameData } from "@/hooks/useGameData";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  CheckCircle2,
  History,
  Loader2,
  Lock,
  PenSquare,
  Sparkles,
  TimerReset,
} from "lucide-react";

interface SongwritingProject {
  id: string;
  user_id: string;
  title: string | null;
  lyrics: string | null;
  sessions_completed: number;
  locked_until: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  song_id: string | null;
}

interface SongwritingSession {
  id: string;
  project_id: string;
  user_id: string;
  started_at: string;
  locked_until: string;
  completed_at: string | null;
  notes: string | null;
  created_at: string;
}

const SESSION_DURATION_MINUTES = 15;
const SESSION_TARGET = 4;

const formatRemaining = (milliseconds: number | null) => {
  if (milliseconds === null) {
    return "--:--";
  }

  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");

  return `${minutes}:${seconds}`;
};

const Songwriting = () => {
  const { user } = useAuth();
  const { profile } = useGameData();
  const { toast } = useToast();

  const [project, setProject] = useState<SongwritingProject | null>(null);
  const [sessionHistory, setSessionHistory] = useState<SongwritingSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [sessionLoading, setSessionLoading] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [lyricsDraft, setLyricsDraft] = useState("");
  const [lockRemaining, setLockRemaining] = useState<number | null>(null);

  const completionInFlight = useRef<string | null>(null);

  const displayName = useMemo(() => {
    return profile?.stage_name?.trim() || profile?.artist_name?.trim() || profile?.first_name?.trim() || user?.email || "Your";
  }, [profile?.artist_name, profile?.first_name, profile?.stage_name, user?.email]);

  const loadSessionHistory = useCallback(
    async (projectId: string) => {
      const { data, error } = await supabase
        .from("songwriting_sessions")
        .select("*")
        .eq("project_id", projectId)
        .order("started_at", { ascending: false })
        .limit(10);

      if (error) {
        toast({
          variant: "destructive",
          title: "Unable to load writing sessions",
          description: error.message,
        });
        return;
      }

      setSessionHistory(data ?? []);
    },
    [toast]
  );

  const loadProject = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    setLoading(true);

    const { data, error } = await supabase
      .from("songwriting_projects")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error && error.code !== "PGRST116") {
      toast({
        variant: "destructive",
        title: "Unable to load songwriting project",
        description: error.message,
      });
      setLoading(false);
      return;
    }

    if (!data) {
      const suggestedTitle = profile?.stage_name?.trim()
        ? `${profile.stage_name.trim()}'s Anthem`
        : "Untitled Song";

      const { data: created, error: createError } = await supabase
        .from("songwriting_projects")
        .insert({
          user_id: user.id,
          title: suggestedTitle,
          status: "draft",
          sessions_completed: 0,
        })
        .select()
        .single();

      if (createError) {
        toast({
          variant: "destructive",
          title: "Unable to create songwriting project",
          description: createError.message,
        });
        setLoading(false);
        return;
      }

      setProject(created);
      setTitleDraft(created.title ?? "");
      setLyricsDraft(created.lyrics ?? "");
      await loadSessionHistory(created.id);
      setLoading(false);
      return;
    }

    setProject(data);
    setTitleDraft(data.title ?? "");
    setLyricsDraft(data.lyrics ?? "");
    await loadSessionHistory(data.id);
    setLoading(false);
  }, [loadSessionHistory, profile?.stage_name, toast, user]);

  const projectLockedUntil = project?.locked_until ? new Date(project.locked_until) : null;
  const isLockActive = projectLockedUntil ? projectLockedUntil.getTime() > Date.now() : false;
  const sessionsCompleted = project?.sessions_completed ?? 0;
  const progressPercentage = Math.min(100, Math.round((sessionsCompleted / SESSION_TARGET) * 100));
  const progressLabel = sessionsCompleted >= SESSION_TARGET
    ? "All sessions complete"
    : `Session ${sessionsCompleted + 1} of ${SESSION_TARGET}`;

  const handleSaveDraft = useCallback(async () => {
    if (!project) {
      return;
    }

    setSavingDraft(true);

    const { data, error } = await supabase
      .from("songwriting_projects")
      .update({
        title: titleDraft.trim() || "Untitled Song",
        lyrics: lyricsDraft,
      })
      .eq("id", project.id)
      .select()
      .single();

    if (error) {
      toast({
        variant: "destructive",
        title: "Unable to save lyrics",
        description: error.message,
      });
      setSavingDraft(false);
      return;
    }

    setProject(data);
    setTitleDraft(data.title ?? "");
    setLyricsDraft(data.lyrics ?? "");
    toast({
      title: "Song draft saved",
      description: "Your latest lyrics are safe in the cloud.",
    });
    setSavingDraft(false);
  }, [lyricsDraft, project, titleDraft, toast]);

  const completeSession = useCallback(
    async (lockValue?: string) => {
      if (!project || !lockValue) {
        return;
      }

      if (completionInFlight.current === lockValue) {
        return;
      }

      if (project.sessions_completed >= SESSION_TARGET) {
        const { data: unlocked, error: unlockError } = await supabase
          .from("songwriting_projects")
          .update({ locked_until: null })
          .eq("id", project.id)
          .select()
          .single();

        if (unlockError) {
          toast({
            variant: "destructive",
            title: "Unable to clear writing lock",
            description: unlockError.message,
          });
          return;
        }

        setProject(unlocked);
        setLockRemaining(null);
        completionInFlight.current = null;
        return;
      }

      completionInFlight.current = lockValue;
      const nextCount = Math.min(project.sessions_completed + 1, SESSION_TARGET);
      const nextStatus = nextCount >= SESSION_TARGET ? "ready_to_finish" : "draft";

      const { data: updated, error } = await supabase
        .from("songwriting_projects")
        .update({
          sessions_completed: nextCount,
          locked_until: null,
          status: nextStatus,
        })
        .eq("id", project.id)
        .select()
        .single();

      if (error) {
        toast({
          variant: "destructive",
          title: "Unable to complete writing session",
          description: error.message,
        });
        completionInFlight.current = null;
        return;
      }

      setProject(updated);
      setLockRemaining(null);
      completionInFlight.current = null;

      await supabase
        .from("songwriting_sessions")
        .update({ completed_at: new Date().toISOString() })
        .eq("project_id", project.id)
        .is("completed_at", null);

      await loadSessionHistory(project.id);

      toast({
        title: `Session ${nextCount} recorded`,
        description:
          nextCount >= SESSION_TARGET
            ? "You've unlocked the ability to finish this song."
            : "Take a breather before diving into the next session.",
      });
    },
    [loadSessionHistory, project, toast]
  );

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    void loadProject();
  }, [loadProject, user]);

  useEffect(() => {
    if (!project?.locked_until) {
      setLockRemaining(null);
      completionInFlight.current = null;
      return;
    }

    const lockedUntil = new Date(project.locked_until);
    if (Number.isNaN(lockedUntil.getTime())) {
      setLockRemaining(null);
      return;
    }

    const updateRemaining = () => {
      setLockRemaining(Math.max(0, lockedUntil.getTime() - Date.now()));
    };

    if (lockedUntil.getTime() <= Date.now()) {
      updateRemaining();
      void completeSession(project.locked_until);
      return;
    }

    updateRemaining();
    const intervalId = window.setInterval(updateRemaining, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [completeSession, project?.locked_until]);

  const handleBeginSession = useCallback(async () => {
    if (!project || !user) {
      return;
    }

    if (project.sessions_completed >= SESSION_TARGET) {
      toast({
        title: "All sessions complete",
        description: "Use Finish Song to wrap things up.",
      });
      return;
    }

    if (project.locked_until && new Date(project.locked_until).getTime() > Date.now()) {
      toast({
        variant: "destructive",
        title: "Writing window already active",
        description: "Wait for the countdown to finish before starting again.",
      });
      return;
    }

    setSessionLoading(true);

    const lockUntil = new Date(Date.now() + SESSION_DURATION_MINUTES * 60 * 1000).toISOString();

    const { data: updated, error } = await supabase
      .from("songwriting_projects")
      .update({
        locked_until: lockUntil,
        status: "writing",
      })
      .eq("id", project.id)
      .select()
      .single();

    if (error) {
      toast({
        variant: "destructive",
        title: "Unable to start writing session",
        description: error.message,
      });
      setSessionLoading(false);
      return;
    }

    setProject(updated);

    const { error: sessionError } = await supabase.from("songwriting_sessions").insert({
      project_id: project.id,
      user_id: user.id,
      locked_until: lockUntil,
    });

    if (sessionError) {
      toast({
        variant: "destructive",
        title: "Unable to log session",
        description: sessionError.message,
      });
      setSessionLoading(false);
      return;
    }

    setSessionLoading(false);
    toast({
      title: "Writing session started",
      description: "You have 15 minutes before the notebook locks again.",
    });
    await loadSessionHistory(project.id);
  }, [loadSessionHistory, project, toast, user]);

  const handleFinishSong = useCallback(async () => {
    if (!project) {
      return;
    }

    if (project.sessions_completed < SESSION_TARGET) {
      toast({
        variant: "destructive",
        title: "Keep writing",
        description: "Complete four sessions before wrapping the song.",
      });
      return;
    }

    setFinishing(true);

    const { data, error } = await supabase
      .from("songwriting_projects")
      .update({
        status: "completed",
        locked_until: null,
      })
      .eq("id", project.id)
      .select()
      .single();

    if (error) {
      toast({
        variant: "destructive",
        title: "Unable to finish song",
        description: error.message,
      });
      setFinishing(false);
      return;
    }

    await supabase
      .from("songwriting_sessions")
      .update({ completed_at: new Date().toISOString() })
      .eq("project_id", project.id)
      .is("completed_at", null);

    await loadSessionHistory(project.id);

    setProject(data);
    setFinishing(false);
    toast({
      title: "Song completed",
      description: "Head to the Song Manager to plan the release!",
    });
  }, [loadSessionHistory, project, toast]);

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-stage">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Sign in to write</CardTitle>
            <CardDescription>You need an account to manage songwriting sessions.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link to="/auth">Return to sign in</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-stage">
        <div className="flex items-center gap-3 rounded-lg bg-background/80 px-6 py-4 shadow-lg">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <span className="text-sm font-medium text-muted-foreground">Loading your songwriting studio...</span>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-stage">
        <Alert className="w-full max-w-lg">
          <AlertTitle>Songwriting project unavailable</AlertTitle>
          <AlertDescription>
            We couldn't create your songwriting workspace. Please refresh the page or try again later.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-stage p-6">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <header className="space-y-3 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <Sparkles className="h-7 w-7 text-primary" />
          </div>
          <div className="space-y-1">
            <h1 className="text-4xl font-bold text-foreground">Songwriting Studio</h1>
            <p className="text-muted-foreground">
              Track every focused session as you guide {displayName}'s next hit from idea to release.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Badge variant="outline" className="border-primary/40 text-primary">
              Status: {project.status.replace(/_/g, " ")}
            </Badge>
            <Badge variant="secondary" className="gap-1">
              <PenSquare className="h-3.5 w-3.5" />
              {progressLabel}
            </Badge>
            {project.locked_until && (
              <Badge variant="destructive" className="gap-1">
                <Lock className="h-3.5 w-3.5" /> Locked until {new Date(project.locked_until).toLocaleTimeString()}
              </Badge>
            )}
          </div>
        </header>

        {project.status === "completed" && (
          <Alert className="border-primary/40 bg-primary/5">
            <AlertTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-primary" />
              Song ready for production
            </AlertTitle>
            <AlertDescription>
              Great work! Visit the Song Manager to coordinate studio time, budgets, and release plans.
            </AlertDescription>
          </Alert>
        )}

        <section className="grid gap-4 md:grid-cols-[2fr,1fr]">
          <Card>
            <CardHeader className="space-y-1">
              <CardTitle>Lyric Notebook</CardTitle>
              <CardDescription>
                Capture ideas while your session is active. Drafts save to Supabase so you never lose momentum.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground" htmlFor="song-title">
                  Working title
                </label>
                <Input
                  id="song-title"
                  value={titleDraft}
                  onChange={(event) => setTitleDraft(event.target.value)}
                  placeholder="Anthem for the next big stage"
                  disabled={isLockActive}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground" htmlFor="song-lyrics">
                  Lyrics
                </label>
                <Textarea
                  id="song-lyrics"
                  value={lyricsDraft}
                  onChange={(event) => setLyricsDraft(event.target.value)}
                  placeholder="Verse 1\nPaint the scene with details, emotions, and movement..."
                  className="min-h-[260px] resize-y"
                  disabled={isLockActive}
                />
                {isLockActive ? (
                  <p className="text-xs text-muted-foreground">
                    The notebook is locked while the focus timer runs. Review your ideas and get ready for the next burst.
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Draft without fear—your updates only save when you choose.
                  </p>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Button onClick={handleSaveDraft} disabled={savingDraft || isLockActive}>
                  {savingDraft ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PenSquare className="mr-2 h-4 w-4" />}Save draft
                </Button>
                <Button
                  variant="outline"
                  onClick={handleBeginSession}
                  disabled={sessionLoading || isLockActive || project.sessions_completed >= SESSION_TARGET || project.status === "completed"}
                >
                  {sessionLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <TimerReset className="mr-2 h-4 w-4" />
                  )}
                  Begin writing
                </Button>
                <Button
                  variant="secondary"
                  onClick={handleFinishSong}
                  disabled={finishing || project.sessions_completed < SESSION_TARGET || project.status === "completed"}
                >
                  {finishing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}Finish Song
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="flex flex-col gap-4">
            <Card>
              <CardHeader className="space-y-1">
                <CardTitle>Progress overview</CardTitle>
                <CardDescription>Complete four focused sessions to unlock the finish action.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="mb-2 flex items-center justify-between text-sm text-muted-foreground">
                    <span>{progressLabel}</span>
                    <span>{sessionsCompleted}/{SESSION_TARGET}</span>
                  </div>
                  <Progress value={progressPercentage} className="h-2" />
                </div>
                <div className="rounded-lg border border-primary/20 bg-background/60 p-4 text-sm">
                  <p className="font-medium text-foreground">Focus timer</p>
                  <p className="text-2xl font-semibold text-primary">{formatRemaining(lockRemaining)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Each session grants {SESSION_DURATION_MINUTES} minutes of exclusive focus. When the timer hits zero, your progress is logged automatically.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="space-y-1">
                <CardTitle>Session history</CardTitle>
                <CardDescription>Recent writing bursts and cool-downs.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {sessionHistory.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No sessions recorded yet. Start your first writing sprint to build momentum.
                  </p>
                ) : (
                  <ul className="space-y-3 text-sm">
                    {sessionHistory.map((session) => {
                      const started = new Date(session.started_at);
                      const completed = session.completed_at ? new Date(session.completed_at) : null;
                      return (
                        <li
                          key={session.id}
                          className="flex items-start gap-3 rounded-lg border border-primary/10 bg-background/70 p-3"
                        >
                          <History className="mt-0.5 h-4 w-4 text-primary" />
                          <div className="flex-1">
                            <p className="font-medium text-foreground">
                              {completed ? "Completed session" : "Active session"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Started {started.toLocaleString()} {completed && `• Finished ${completed.toLocaleTimeString()}`}
                            </p>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        </section>
      </div>
    </div>
  );
};

export default Songwriting;
