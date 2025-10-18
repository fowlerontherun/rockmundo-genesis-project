import { useState } from "react";
import { formatDistanceToNowStrict } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Play, Edit, Trash2, History, CheckCircle2, Clock } from "lucide-react";
import type { SongwritingProject } from "@/hooks/useSongwritingData";
import { CompleteSongDialog } from "./CompleteSongDialog";

interface SimplifiedProjectCardProps {
  project: SongwritingProject;
  onStartSession: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onViewHistory: () => void;
  onComplete?: () => void;
  isLocked: boolean;
}

export const SimplifiedProjectCard = ({
  project,
  onStartSession,
  onEdit,
  onDelete,
  onViewHistory,
  onComplete,
  isLocked,
}: SimplifiedProjectCardProps) => {
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false);

  // Convert 0-2000 progress to 0-100%
  const musicPercent = Math.round((project.music_progress / 2000) * 100);
  const lyricsPercent = Math.round((project.lyrics_progress / 2000) * 100);
  
  // Calculate estimated sessions remaining
  const avgProgressPerSession = 600; // Average of 500-700
  const musicRemaining = Math.max(0, 2000 - project.music_progress);
  const lyricsRemaining = Math.max(0, 2000 - project.lyrics_progress);
  const totalRemaining = Math.max(musicRemaining, lyricsRemaining);
  const estimatedSessionsLeft = Math.ceil(totalRemaining / avgProgressPerSession);
  
  const totalSessions = (project.sessions_completed || 0) + estimatedSessionsLeft;
  
  // Get status text
  const getStatusText = () => {
    if (!project.locked_until) return "Ready to start";
    
    const lockedUntil = new Date(project.locked_until);
    const now = new Date();
    
    // Session expired and waiting for auto-complete
    if (lockedUntil <= now && isLocked) {
      return "Auto-completing...";
    }
    
    // Session expired, no longer locked
    if (lockedUntil <= now) {
      return "Session completed";
    }
    
    // Session in progress
    const timeLeft = formatDistanceToNowStrict(lockedUntil);
    return `Completes in ${timeLeft}`;
  };
  
  const isCompleted = musicPercent >= 100 && lyricsPercent >= 100;
  const canComplete = isCompleted && project.status !== 'completed' && project.status !== 'complete';
  const isExpired = project.locked_until && new Date(project.locked_until) <= new Date();
  
  return (
    <>
      <Card className="hover:shadow-md transition-shadow">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <CardTitle className="text-lg truncate">{project.title}</CardTitle>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {project.genres?.[0] && (
                  <Badge variant="secondary" className="text-xs">
                    {project.genres[0]}
                  </Badge>
                )}
                {project.song_themes?.name && (
                  <Badge variant="outline" className="text-xs">
                    {project.song_themes.name}
                  </Badge>
                )}
              </div>
            </div>
            <Badge
              variant={isLocked ? "default" : isCompleted ? "default" : "secondary"}
              className="shrink-0"
            >
              {isCompleted ? (
                <>
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  Complete
                </>
              ) : isLocked ? (
                <>
                  <Clock className="w-3 h-3 mr-1" />
                  Writing
                </>
              ) : (
                "Draft"
              )}
            </Badge>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {/* Progress Bars */}
          <div className="space-y-3">
            <div className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Music</span>
                <span className="font-medium">{musicPercent}%</span>
              </div>
              <Progress value={musicPercent} className="h-2" />
            </div>
            
            <div className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Lyrics</span>
                <span className="font-medium">{lyricsPercent}%</span>
              </div>
              <Progress value={lyricsPercent} className="h-2" />
            </div>
          </div>
          
          {/* Sessions Info */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Sessions</span>
            <span className="font-medium">
              {project.sessions_completed || 0} of ~{totalSessions}
            </span>
          </div>
          
          {/* Status */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Status</span>
            <span className={`font-medium ${isExpired ? 'text-primary' : ''}`}>
              {getStatusText()}
            </span>
          </div>
          
          {/* Action Buttons */}
          <div className="flex items-center gap-2 pt-2">
            {canComplete && (
              <Button
                onClick={() => setCompleteDialogOpen(true)}
                size="sm"
                className="flex-1"
              >
                <CheckCircle2 className="w-3 h-3 mr-1" />
                Complete
              </Button>
            )}
            
            {!canComplete && (
              <Button
                onClick={onStartSession}
                disabled={isLocked || isCompleted}
                size="sm"
                className="flex-1"
              >
                <Play className="w-3 h-3 mr-1" />
                Start Session
              </Button>
            )}
            
            <Button
              onClick={onViewHistory}
              variant="outline"
              size="sm"
            >
              <History className="w-3 h-3" />
            </Button>
            
            <Button
              onClick={onEdit}
              variant="outline"
              size="sm"
              disabled={isLocked}
            >
              <Edit className="w-3 h-3" />
            </Button>
            
            <Button
              onClick={onDelete}
              variant="outline"
              size="sm"
              disabled={isLocked}
            >
              <Trash2 className="w-3 h-3" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <CompleteSongDialog
        open={completeDialogOpen}
        onOpenChange={setCompleteDialogOpen}
        projectId={project.id}
        projectTitle={project.title}
        onComplete={() => {
          onComplete?.();
        }}
      />
    </>
  );
};
