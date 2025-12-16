import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Clock, Music, Users, Zap, Lock, Play, CheckCircle } from "lucide-react";
import type { JamSession } from "@/hooks/useJamSessions";

interface JamSessionCardProps {
  session: JamSession;
  isHost: boolean;
  isParticipant: boolean;
  onJoin: () => void;
  onStart: () => void;
  onComplete: () => void;
  isJoining: boolean;
  isStarting: boolean;
  isCompleting: boolean;
}

export const JamSessionCard = ({
  session,
  isHost,
  isParticipant,
  onJoin,
  onStart,
  onComplete,
  isJoining,
  isStarting,
  isCompleting,
}: JamSessionCardProps) => {
  const hostName = session.host?.display_name || session.host?.username || "Unknown";
  const participantCount = session.current_participants || 0;
  const maxParticipants = session.max_participants;
  const fillPercent = (participantCount / maxParticipants) * 100;

  const statusColors = {
    waiting: "bg-yellow-500/20 text-yellow-600",
    active: "bg-green-500/20 text-green-600",
    completed: "bg-muted text-muted-foreground",
  };

  const statusLabels = {
    waiting: "Waiting",
    active: "In Progress",
    completed: "Completed",
  };

  return (
    <Card className={session.status === "completed" ? "opacity-75" : ""}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1">
            <CardTitle className="text-lg flex items-center gap-2">
              {session.name}
              {session.is_private && <Lock className="h-4 w-4 text-muted-foreground" />}
            </CardTitle>
            <p className="text-sm text-muted-foreground">Hosted by {hostName}</p>
          </div>
          <Badge className={statusColors[session.status as keyof typeof statusColors] || statusColors.waiting}>
            {statusLabels[session.status as keyof typeof statusLabels] || session.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {session.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">{session.description}</p>
        )}

        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary" className="flex items-center gap-1">
            <Music className="h-3 w-3" />
            {session.genre}
          </Badge>
          <Badge variant="outline" className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {session.tempo} BPM
          </Badge>
          {session.skill_requirement > 0 && (
            <Badge variant="outline" className="flex items-center gap-1">
              <Zap className="h-3 w-3" />
              Skill {session.skill_requirement}+
            </Badge>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-1">
              <Users className="h-4 w-4" />
              Participants
            </span>
            <span>{participantCount} / {maxParticipants}</span>
          </div>
          <Progress value={fillPercent} className="h-2" />
        </div>

        {session.status === "completed" && session.total_xp_awarded > 0 && (
          <div className="flex items-center gap-2 text-sm text-green-600 bg-green-500/10 p-2 rounded">
            <CheckCircle className="h-4 w-4" />
            <span>{session.total_xp_awarded} XP awarded</span>
          </div>
        )}

        <div className="flex gap-2">
          {session.status === "waiting" && !isParticipant && participantCount < maxParticipants && (
            <Button onClick={onJoin} disabled={isJoining} className="flex-1">
              {isJoining ? "Joining..." : "Join Session"}
            </Button>
          )}
          
          {session.status === "waiting" && isHost && participantCount >= 2 && (
            <Button onClick={onStart} disabled={isStarting} variant="default" className="flex-1">
              <Play className="h-4 w-4 mr-2" />
              {isStarting ? "Starting..." : "Start Jam"}
            </Button>
          )}

          {session.status === "active" && isHost && (
            <Button onClick={onComplete} disabled={isCompleting} variant="default" className="flex-1">
              <CheckCircle className="h-4 w-4 mr-2" />
              {isCompleting ? "Completing..." : "End Session"}
            </Button>
          )}

          {session.status === "active" && isParticipant && !isHost && (
            <Badge variant="secondary" className="flex-1 justify-center py-2">
              Jamming in progress...
            </Badge>
          )}

          {isParticipant && session.status === "waiting" && (
            <Badge variant="outline" className="flex-1 justify-center py-2">
              You're in!
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
