import { useEffect, useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Radio, Zap, Music, Star, Heart, Flame, Sparkles, 
  Volume2, Users, Trophy, Loader2 
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

interface CommentaryEvent {
  id: string;
  session_id: string;
  event_type: string;
  commentary: string;
  participant_id: string | null;
  is_important: boolean;
  created_at: string;
}

interface JamCommentaryFeedProps {
  sessionId: string;
  isActive: boolean;
}

const EVENT_ICONS: Record<string, React.ReactNode> = {
  jam_start: <Radio className="h-4 w-4" />,
  groove_found: <Music className="h-4 w-4" />,
  solo_moment: <Star className="h-4 w-4" />,
  energy_peak: <Flame className="h-4 w-4" />,
  tempo_shift: <Zap className="h-4 w-4" />,
  mood_change: <Heart className="h-4 w-4" />,
  chemistry_moment: <Users className="h-4 w-4" />,
  near_end: <Volume2 className="h-4 w-4" />,
  session_end: <Trophy className="h-4 w-4" />,
  default: <Sparkles className="h-4 w-4" />,
};

const EVENT_COLORS: Record<string, string> = {
  jam_start: "bg-blue-500/10 text-blue-600 border-blue-500/30",
  groove_found: "bg-green-500/10 text-green-600 border-green-500/30",
  solo_moment: "bg-yellow-500/10 text-yellow-600 border-yellow-500/30",
  energy_peak: "bg-orange-500/10 text-orange-600 border-orange-500/30",
  tempo_shift: "bg-purple-500/10 text-purple-600 border-purple-500/30",
  mood_change: "bg-pink-500/10 text-pink-600 border-pink-500/30",
  chemistry_moment: "bg-cyan-500/10 text-cyan-600 border-cyan-500/30",
  near_end: "bg-amber-500/10 text-amber-600 border-amber-500/30",
  session_end: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
  default: "bg-muted text-muted-foreground border-muted-foreground/30",
};

export const JamCommentaryFeed = ({ sessionId, isActive }: JamCommentaryFeedProps) => {
  const queryClient = useQueryClient();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [newEventId, setNewEventId] = useState<string | null>(null);

  const { data: events = [], isLoading } = useQuery({
    queryKey: ["jam-commentary", sessionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("jam_session_commentary")
        .select("*")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return (data || []) as CommentaryEvent[];
    },
    enabled: !!sessionId,
  });

  // Subscribe to real-time commentary updates
  useEffect(() => {
    if (!sessionId || !isActive) return;

    const channel = supabase
      .channel(`jam-commentary-${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "jam_session_commentary",
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          setNewEventId(payload.new.id);
          queryClient.invalidateQueries({ queryKey: ["jam-commentary", sessionId] });
          setTimeout(() => setNewEventId(null), 2000);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId, isActive, queryClient]);

  // Auto-scroll to bottom on new events
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [events]);

  const getIcon = (eventType: string) => EVENT_ICONS[eventType] || EVENT_ICONS.default;
  const getColor = (eventType: string) => EVENT_COLORS[eventType] || EVENT_COLORS.default;

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3 border-b">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Radio className="h-4 w-4" />
            Live Commentary
          </CardTitle>
          {isActive && (
            <Badge variant="default" className="animate-pulse bg-red-500">
              <span className="w-2 h-2 bg-white rounded-full mr-1.5 animate-pulse" />
              LIVE
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="flex-1 p-0 overflow-hidden">
        <ScrollArea className="h-full p-4" ref={scrollRef}>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : events.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Radio className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Waiting for the jam to begin...</p>
              <p className="text-xs">Commentary will appear here during the session</p>
            </div>
          ) : (
            <div className="space-y-3">
              <AnimatePresence>
                {events.map((event) => (
                  <motion.div
                    key={event.id}
                    initial={event.id === newEventId ? { opacity: 0, y: 20 } : false}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className={cn(
                      "flex gap-3 p-3 rounded-lg border",
                      getColor(event.event_type),
                      event.is_important && "ring-2 ring-offset-1",
                      event.id === newEventId && "ring-2 ring-primary"
                    )}
                  >
                    <div className="flex-shrink-0 mt-0.5">
                      {getIcon(event.event_type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm leading-relaxed">{event.commentary}</p>
                      <p className="text-xs mt-1 opacity-70">
                        {formatTime(event.created_at)}
                      </p>
                    </div>
                    {event.is_important && (
                      <Star className="h-4 w-4 text-yellow-500 flex-shrink-0" />
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
