import "./songwriting-notebook.css";
import { useState } from "react";
import { formatDistanceToNowStrict } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { SongwritingSessionType } from "@/utils/songwritingOutcomeCalculator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Play, Edit, Trash2, History, CheckCircle2, Clock, Users, UserPlus, Sparkles, Music2, PenLine } from "lucide-react";
import type { SongwritingProject } from "@/hooks/useSongwritingData";
import { CompleteSongDialog } from "./CompleteSongDialog";
import { songwritingProgressPercent } from "./songwritingProgress";
import { CollaboratorInviteDialog } from "./CollaboratorInviteDialog";
import { ActiveSongwritingDialog } from "./ActiveSongwritingDialog";
import { useCollaborationInvites } from "@/hooks/useCollaborationInvites";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

interface SimplifiedProjectCardProps {
  project: SongwritingProject;
  onStartSession: (focus: SongwritingSessionType) => void;
  onEdit: () => void;
  onDelete: () => void;
  onViewHistory: () => void;
  onComplete?: () => void;
  onSchedule?: () => void;
  isLocked: boolean;
  userBandId?: string;
}

export const SimplifiedProjectCard = ({
  project,
  onStartSession,
  onEdit,
  onDelete,
  onViewHistory,
  onComplete,
  onSchedule,
  isLocked,
  userBandId,
}: SimplifiedProjectCardProps) => {
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [activeWritingOpen, setActiveWritingOpen] = useState(false);
  const [sessionFocus, setSessionFocus] = useState<SongwritingSessionType>("balanced");
  const { collaborators } = useCollaborationInvites(project.id);
  const { profileId } = useActiveProfile();
  const queryClient = useQueryClient();

  const refreshCompletionState = async () => {
    await queryClient.invalidateQueries({ queryKey: ["songwriting-projects"] });
    await queryClient.invalidateQueries({ queryKey: ["scheduled-activities"] });
    await queryClient.invalidateQueries({ queryKey: ["activity-status"] });
    onComplete?.();
  };

  const startFinalPolish = async () => {
    if (!profileId) throw new Error("Select an active character first.");
    // Generated Supabase RPC types lag this migration; keep the escape hatch local.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc(
      "start_songwriting_polish_session",
      { p_profile_id: profileId, p_project_id: project.id },
    );
    if (error) {
      toast.error("Could not start final polish", { description: error.message });
      throw error;
    }
    toast.success("Final polish started", {
      description:
        "One final 1-hour writing session is underway. Success chance: " +
        (data?.success_chance ?? project.polish_success_chance ?? "?") +
        "%.",
    });
    await refreshCompletionState();
  };

  const finishSong = async () => {
    if (!profileId) throw new Error("Select an active character first.");
    // Generated Supabase RPC types lag this migration; keep the escape hatch local.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).rpc(
      "complete_songwriting_project_with_instruments",
      {
        p_profile_id: profileId,
        p_project_id: project.id,
        p_catalog_status: "private",
        p_band_id: null,
      },
    );
    if (error) {
      toast.error("Could not finish song", { description: error.message });
      throw error;
    }
    toast.success("Song created!", {
      description: '"' + project.title + '" is now in your private catalog.',
    });
    await refreshCompletionState();
  };

  const keepSongAsIs = async () => {
    if (!profileId) throw new Error("Select an active character first.");
    // Generated Supabase RPC types lag this migration; keep the escape hatch local.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).rpc(
      "skip_and_complete_songwriting_project_with_instruments",
      { p_profile_id: profileId, p_project_id: project.id,
        p_catalog_status: "private", p_band_id: null },
    );
    if (error) {
      toast.error("Could not keep song as-is", { description: error.message });
      throw error;
    }
    toast.success("Song created!", { description: `"${project.title}" is now in your private catalog.` });
    await refreshCompletionState();
  };
  
  const acceptedCollaborators = collaborators?.filter(c => c.status === "accepted") || [];
  const hasCollaborators = acceptedCollaborators.length > 0;

  const musicPercent = songwritingProgressPercent(project.music_progress);
  const lyricsPercent = songwritingProgressPercent(project.lyrics_progress);
  const avgProgressPerSession = 600;
  const musicRemaining = Math.max(0, 2000 - project.music_progress);
  const lyricsRemaining = Math.max(0, 2000 - project.lyrics_progress);
  const totalRemaining = Math.max(musicRemaining, lyricsRemaining);
  const estimatedSessionsLeft = Math.ceil(totalRemaining / avgProgressPerSession);
  const totalSessions = (project.sessions_completed || 0) + estimatedSessionsLeft;
  const breakdown = project.songwriting_breakdown || {};
  const latestFactorSession = project.songwriting_sessions?.find((s) => s.completed_at && s.polish_gained != null && s.consistency_gained != null);
  const progressBreakdown = project.songwriting_sessions?.find((session) => session.progress_breakdown)?.progress_breakdown || breakdown;
  
  const getStatusText = () => {
    if (project.status === "converted" || project.song_id) return "Song finished";
    if (project.status === "completed") return "Writing complete";
    if (!project.locked_until) return "Ready to start";
    const lockedUntil = new Date(project.locked_until);
    const now = new Date();
    if (lockedUntil <= now && isLocked) return "Auto-completing...";
    if (lockedUntil <= now) return "Session completed";
    const timeLeft = formatDistanceToNowStrict(lockedUntil);
    return `Completes in ${timeLeft}`;
  };
  
  const isCompleted =
    (musicPercent >= 100 && lyricsPercent >= 100) ||
    project.status === "completed" ||
    project.status === "converted" ||
    Boolean(project.song_id);
  const canReviewCompletion =
    isCompleted &&
    project.status !== "converted" &&
    !project.song_id;
  const isExpired = project.locked_until && new Date(project.locked_until) <= new Date();
  
  return (
    <>
      <Card className="songwriting-notebook hover:shadow-md transition-shadow">
        <CardHeader className="songwriting-notebook__header">
          <div className="songwriting-notebook__binding" aria-hidden="true">{Array.from({ length: 5 }, (_, i) => <span key={i} />)}</div>
          <div className="relative flex flex-wrap items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <CardTitle className="text-lg break-words [overflow-wrap:anywhere]">{project.title}</CardTitle>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {project.genres?.[0] && <Badge variant="secondary" className="text-xs">{project.genres[0]}</Badge>}
                {project.song_themes?.name && <Badge variant="outline" className="text-xs">{project.song_themes.name}</Badge>}
                {hasCollaborators && <Badge variant="secondary" className="text-xs"><Users className="h-3 w-3 mr-1" />Co-write</Badge>}
              </div>
            </div>
            <Badge variant={isLocked ? "default" : isCompleted ? "default" : "secondary"} className="shrink-0">
              {isCompleted ? <><CheckCircle2 className="w-3 h-3 mr-1" />Complete</> : isLocked ? <><Clock className="w-3 h-3 mr-1" />Writing</> : "Draft"}
            </Badge>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="songwriting-notebook__track songwriting-notebook__track--music">
              <div className="flex items-center justify-between gap-2 text-sm"><span className="flex items-center gap-2 font-medium"><Music2 aria-hidden="true" className="h-4 w-4" />Music</span><span className="font-semibold tabular-nums">{musicPercent}%</span></div>
              <Progress aria-label="Music progress" value={musicPercent} className="mt-3 h-2" />
            </div>
            <div className="songwriting-notebook__track songwriting-notebook__track--lyrics">
              <div className="flex items-center justify-between gap-2 text-sm"><span className="flex items-center gap-2 font-medium"><PenLine aria-hidden="true" className="h-4 w-4" />Lyrics</span><span className="font-semibold tabular-nums">{lyricsPercent}%</span></div>
              <Progress aria-label="Lyrics progress" value={lyricsPercent} className="mt-3 h-2" />
            </div>
          </div>

          <div className="rounded-md border bg-muted/30 p-3 text-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-medium">Songwriting factors</span>
              <span className="text-muted-foreground">{project.calculation_version || progressBreakdown.balanceVersion || "pending"}</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-muted-foreground">
              <span>Craft: {progressBreakdown.craft ?? "estimated after session"}</span>
              <span>Attributes: {progressBreakdown.attributes ?? "estimated after session"}</span>
              <span>Genre: {progressBreakdown.genreKnowledge ?? progressBreakdown.genre ?? "pending"}</span>
              <div title="Refinement earned through writing. Adds up to 35 points to a newly completed song.">Polish: {project.polish_progress ?? 0}/500<Progress aria-label="Polish progress" value={songwritingProgressPercent(project.polish_progress, 500)} className="mt-1.5 h-1.5" /></div>
              <div title="Song cohesion and structure. Adds up to 35 points to a newly completed song.">Consistency: {project.consistency_score ?? 0}/500<Progress aria-label="Consistency progress" value={songwritingProgressPercent(project.consistency_score, 500)} className="mt-1.5 h-1.5" /></div>
              <span>Duration: {progressBreakdown.durationModifier ? `${progressBreakdown.durationModifier}×` : "choose 1/2/4h"}</span>
            </div>
            {latestFactorSession && <p className="text-foreground">Last session: +{latestFactorSession.polish_gained} Polish · +{latestFactorSession.consistency_gained} Consistency</p>}
            {project.song_rating != null && <p className="text-foreground">Final songwriting score: {project.song_rating}/1000</p>}
          </div>

          {canReviewCompletion && (
            <div className="rounded-md border border-primary/30 bg-primary/5 p-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold">Writing complete</span>
                {project.writing_quality_score != null && (
                  <Badge variant="secondary">
                    {project.writing_quality_score}/1000
                  </Badge>
                )}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {project.polish_resolved_at
                  ? "Final polish choice resolved — finish the song when ready."
                  : project.polish_attempted
                    ? "Your one final polish session is in progress."
                    : "One final polish session is available with a " +
                      (project.polish_success_chance ?? "?") +
                      "% chance of improving quality."}
              </p>
            </div>
          )}

          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Sessions</span>
            <span className="font-medium">{project.sessions_completed || 0} of ~{totalSessions}</span>
          </div>

          {hasCollaborators && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Collaborators</span>
              <div className="flex -space-x-2">
                {acceptedCollaborators.slice(0, 3).map((collab) => (
                  <Avatar key={collab.id} className="h-6 w-6 border-2 border-background">
                    <AvatarImage src={collab.invitee_profile?.avatar_url || undefined} />
                    <AvatarFallback className="text-xs">{collab.invitee_profile?.username?.[0]?.toUpperCase() || "?"}</AvatarFallback>
                  </Avatar>
                ))}
                {acceptedCollaborators.length > 3 && <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-xs border-2 border-background">+{acceptedCollaborators.length - 3}</div>}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Status</span>
            <span className={`font-medium ${isExpired ? 'text-primary' : ''}`}>{getStatusText()}</span>
          </div>

          {!isCompleted && (
            <Button
              onClick={() => setActiveWritingOpen(true)}
              variant="secondary"
              size="sm"
              className="w-full"
              disabled={isLocked}
              title={isLocked ? "Finish the current songwriting session first" : "Play an optional active songwriting session"}
            >
              <Sparkles className="w-3 h-3 mr-1" />
              Active Writing (Optional)
            </Button>
          )}
          
          {!isCompleted && !isLocked && (
            <div className="space-y-1">
              <label htmlFor={`songwriting-focus-${project.id}`} className="text-xs font-medium">Writing focus</label>
              <Select value={sessionFocus} onValueChange={(value) => setSessionFocus(value as SongwritingSessionType)}>
                <SelectTrigger id={`songwriting-focus-${project.id}`} aria-label="Writing focus"><SelectValue placeholder="Choose a focus" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="balanced">Balanced — improve everything</SelectItem>
                  <SelectItem value="music">Music — composition focus</SelectItem>
                  <SelectItem value="lyrics">Lyrics — writing focus</SelectItem>
                  <SelectItem value="arrangement">Arrangement — more Consistency</SelectItem>
                  <SelectItem value="polish">Polish — more refinement</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Each completed session improves both factors; focus boosts one faster. Rewards diminish near 500.</p>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2 pt-2">
            {canReviewCompletion ? (
              <Button
                onClick={() => setCompleteDialogOpen(true)}
                size="sm"
                className="flex-1 min-w-[180px]"
              >
                <CheckCircle2 className="w-3 h-3 mr-1" />
                Review completion
              </Button>
            ) : (
              <>
                <Button onClick={() => onStartSession(sessionFocus)} disabled={isLocked || isCompleted} size="sm" className="flex-1 min-w-[180px]">
                  <Play className="w-3 h-3 mr-1" />Start Session
                </Button>
                {onSchedule && !isCompleted && (
                  <Button onClick={onSchedule} variant="outline" size="sm" disabled={isLocked}>
                    <Clock className="w-3 h-3 mr-1" />Plan
                  </Button>
                )}
              </>
            )}
            <Button onClick={onViewHistory} aria-label="View writing history" title="View writing history" variant="outline" size="sm"><History className="w-3 h-3" /></Button>
            <Button onClick={() => setInviteDialogOpen(true)} variant="outline" size="sm" disabled={isLocked || isCompleted} title="Invite Collaborator">
              <UserPlus className="w-3 h-3 mr-1" />Invite
            </Button>
            <Button onClick={onEdit} aria-label="Edit songwriting project" title="Edit songwriting project" variant="outline" size="sm" disabled={isLocked}><Edit className="w-3 h-3" /></Button>
            <Button onClick={onDelete} aria-label="Delete songwriting project" title="Delete songwriting project" variant="outline" size="sm" disabled={isLocked}><Trash2 className="w-3 h-3" /></Button>
          </div>
        </CardContent>
      </Card>

      <CompleteSongDialog
        open={completeDialogOpen}
        onOpenChange={setCompleteDialogOpen}
        project={project}
        onStartPolish={startFinalPolish}
        onKeepAsIs={keepSongAsIs}
        onFinish={finishSong}
      />

      <CollaboratorInviteDialog
        open={inviteDialogOpen}
        onOpenChange={setInviteDialogOpen}
        projectId={project.id}
        userBandId={userBandId}
      />

      <ActiveSongwritingDialog
        open={activeWritingOpen}
        onOpenChange={setActiveWritingOpen}
        project={project}
      />
    </>
  );
};
