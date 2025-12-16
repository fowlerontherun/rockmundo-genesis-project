import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Crown, Guitar, Mic, Piano, Drum } from "lucide-react";

interface Participant {
  id: string;
  display_name?: string;
  username?: string;
  avatar_url?: string;
  instrument?: string;
  isHost?: boolean;
  isReady?: boolean;
}

interface JamParticipantListProps {
  participants: Participant[];
  maxParticipants: number;
}

const getInstrumentIcon = (instrument?: string) => {
  switch (instrument?.toLowerCase()) {
    case "guitar":
    case "bass":
      return <Guitar className="h-3 w-3" />;
    case "vocals":
    case "singer":
      return <Mic className="h-3 w-3" />;
    case "keyboard":
    case "piano":
      return <Piano className="h-3 w-3" />;
    case "drums":
      return <Drum className="h-3 w-3" />;
    default:
      return null;
  }
};

export const JamParticipantList = ({ participants, maxParticipants }: JamParticipantListProps) => {
  const emptySlots = maxParticipants - participants.length;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Participants</span>
        <span className="text-xs text-muted-foreground">
          {participants.length}/{maxParticipants}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {participants.map((participant) => (
          <div
            key={participant.id}
            className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg"
          >
            <Avatar className="h-8 w-8">
              <AvatarImage src={participant.avatar_url} />
              <AvatarFallback>
                {(participant.display_name || participant.username || "?")[0].toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1">
                <span className="text-sm font-medium truncate">
                  {participant.display_name || participant.username || "Unknown"}
                </span>
                {participant.isHost && (
                  <Crown className="h-3 w-3 text-yellow-500 shrink-0" />
                )}
              </div>
              <div className="flex items-center gap-1">
                {participant.instrument && (
                  <Badge variant="outline" className="text-xs h-5 px-1">
                    {getInstrumentIcon(participant.instrument)}
                    <span className="ml-1">{participant.instrument}</span>
                  </Badge>
                )}
                {participant.isReady && (
                  <Badge className="text-xs h-5 px-1 bg-green-500">Ready</Badge>
                )}
              </div>
            </div>
          </div>
        ))}

        {/* Empty slots */}
        {Array.from({ length: emptySlots }).map((_, i) => (
          <div
            key={`empty-${i}`}
            className="flex items-center justify-center p-2 border-2 border-dashed border-muted rounded-lg h-14"
          >
            <span className="text-xs text-muted-foreground">Open Slot</span>
          </div>
        ))}
      </div>
    </div>
  );
};
