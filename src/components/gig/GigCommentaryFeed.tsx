import { useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Zap, MessageSquare } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface CommentaryEvent {
  id: string;
  timestamp: Date;
  commentary: string;
  type: 'song_start' | 'solo_moment' | 'crowd_surge' | 'technical_moment' | 'encore_buildup' | 'song_end' | 'between_songs' | 'event';
  isImportant?: boolean;
}

interface GigCommentaryFeedProps {
  events: CommentaryEvent[];
  maxEvents?: number;
}

export const GigCommentaryFeed = ({ events, maxEvents = 20 }: GigCommentaryFeedProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Auto-scroll to bottom when new events arrive
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [events]);

  const displayEvents = events.slice(-maxEvents);

  const getEventIcon = (type: CommentaryEvent['type']) => {
    switch (type) {
      case 'crowd_surge':
        return '🔥';
      case 'solo_moment':
        return '🎸';
      case 'song_start':
        return '🎵';
      case 'song_end':
        return '👏';
      case 'technical_moment':
        return '⚙️';
      case 'encore_buildup':
        return '🎉';
      case 'event':
        return '⚡';
      default:
        return '💬';
    }
  };

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <MessageSquare className="h-5 w-5 text-primary" />
          Live Commentary
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px] pr-4" ref={scrollRef}>
          <div className="space-y-3">
            {displayEvents.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-8">
                Waiting for the show to begin...
              </p>
            ) : (
              displayEvents.map((event, idx) => (
                <div
                  key={event.id || idx}
                  className={`rounded-lg border p-3 transition-all ${
                    event.isImportant
                      ? 'border-primary bg-primary/5 animate-in fade-in-50 slide-in-from-bottom-2'
                      : 'border-border bg-card animate-in fade-in-50 slide-in-from-bottom-1'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="text-2xl flex-shrink-0">
                      {getEventIcon(event.type)}
                    </div>
                    <div className="flex-1 space-y-1">
                      <p className="text-sm leading-relaxed">
                        {event.commentary}
                      </p>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {event.timestamp.toLocaleTimeString()}
                        </Badge>
                        {event.isImportant && (
                          <Badge variant="default" className="text-xs">
                            <Zap className="h-3 w-3 mr-1" />
                            Key Moment
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
