import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Sparkles, Mic, Users } from "lucide-react";
import { cn } from "@/lib/utils";

interface NarrativeEvent {
  id: string;
  type: "song_start" | "crowd_reaction" | "special_moment" | "performance_item" | "technical" | "milestone";
  message: string;
  timestamp: Date;
  intensity: "low" | "medium" | "high" | "extreme";
}

interface PerformanceNarrativeProps {
  events: NarrativeEvent[];
  className?: string;
}

const getEventIcon = (type: NarrativeEvent["type"]) => {
  switch (type) {
    case "song_start": return Mic;
    case "crowd_reaction": return Users;
    case "special_moment": return Sparkles;
    case "performance_item": return Sparkles;
    case "technical": return MessageSquare;
    case "milestone": return Sparkles;
    default: return MessageSquare;
  }
};

const getEventColor = (intensity: NarrativeEvent["intensity"]) => {
  switch (intensity) {
    case "extreme": return "from-orange-500 to-red-500";
    case "high": return "from-yellow-400 to-orange-400";
    case "medium": return "from-blue-400 to-cyan-400";
    case "low": return "from-gray-400 to-slate-400";
  }
};

const getEventBadgeVariant = (intensity: NarrativeEvent["intensity"]) => {
  switch (intensity) {
    case "extreme": return "destructive" as const;
    case "high": return "default" as const;
    case "medium": return "secondary" as const;
    case "low": return "outline" as const;
  }
};

export const PerformanceNarrative = ({ events, className }: PerformanceNarrativeProps) => {
  const [visibleEvents, setVisibleEvents] = useState<NarrativeEvent[]>([]);

  useEffect(() => {
    // Show events one by one
    events.forEach((event, index) => {
      setTimeout(() => {
        setVisibleEvents(prev => [...prev, event]);
      }, index * 100);
    });
  }, [events]);

  // Keep only last 10 events visible
  const displayEvents = visibleEvents.slice(-10);

  return (
    <Card className={cn("p-4", className)}>
      <div className="flex items-center gap-2 mb-4">
        <MessageSquare className="h-5 w-5 text-primary" />
        <h3 className="font-semibold">Live Commentary</h3>
        <Badge variant="outline" className="ml-auto">
          Live
        </Badge>
      </div>

      <div className="space-y-3 max-h-[400px] overflow-y-auto">
        <AnimatePresence mode="popLayout">
          {displayEvents.map((event, index) => {
            const Icon = getEventIcon(event.type);
            
            return (
              <motion.div
                key={event.id}
                initial={{ opacity: 0, x: -20, scale: 0.95 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 20, scale: 0.95 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
                className={cn(
                  "relative p-3 rounded-lg border overflow-hidden",
                  event.intensity === "extreme" && "border-orange-500",
                  event.intensity === "high" && "border-yellow-500"
                )}
              >
                {/* Background gradient for high-intensity events */}
                {(event.intensity === "extreme" || event.intensity === "high") && (
                  <div 
                    className={cn(
                      "absolute inset-0 opacity-10 bg-gradient-to-r",
                      getEventColor(event.intensity)
                    )}
                  />
                )}

                <div className="relative flex items-start gap-3">
                  <div 
                    className={cn(
                      "p-2 rounded-full bg-gradient-to-br shrink-0",
                      getEventColor(event.intensity)
                    )}
                  >
                    <Icon className="h-4 w-4 text-white" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm leading-relaxed">
                      {event.message}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-xs text-muted-foreground">
                        {event.timestamp.toLocaleTimeString()}
                      </span>
                      <Badge 
                        variant={getEventBadgeVariant(event.intensity)} 
                        className="text-xs"
                      >
                        {event.type.replace("_", " ")}
                      </Badge>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {displayEvents.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Waiting for the show to start...</p>
          </div>
        )}
      </div>
    </Card>
  );
};

// Helper function to generate narrative events
export const generateNarrativeEvent = (
  type: NarrativeEvent["type"],
  data: {
    songTitle?: string;
    crowdResponse?: string;
    performanceScore?: number;
    specialMoment?: string;
    performanceItemName?: string;
  }
): NarrativeEvent => {
  let message = "";
  let intensity: NarrativeEvent["intensity"] = "medium";

  switch (type) {
    case "song_start":
      message = `🎵 Now playing: "${data.songTitle}"`;
      intensity = "medium";
      break;

    case "crowd_reaction":
      if (data.crowdResponse === "ecstatic") {
        message = `🔥 The crowd erupts! This is absolutely electric!`;
        intensity = "extreme";
      } else if (data.crowdResponse === "enthusiastic") {
        message = `🎉 Great response from the crowd! They're loving this!`;
        intensity = "high";
      } else if (data.crowdResponse === "engaged") {
        message = `👍 The crowd is engaged and enjoying the performance`;
        intensity = "medium";
      } else if (data.crowdResponse === "mixed") {
        message = `😐 Mixed reactions from the audience...`;
        intensity = "low";
      } else {
        message = `😞 The crowd seems disappointed with that one`;
        intensity = "low";
      }
      break;

    case "special_moment":
      message = `✨ ${data.specialMoment}`;
      intensity = "high";
      break;

    case "performance_item":
      message = `🌟 Special performance: ${data.performanceItemName}!`;
      intensity = "high";
      break;

    case "technical":
      if (data.performanceScore && data.performanceScore >= 80) {
        message = `⚡ Flawless execution! Technical mastery on display!`;
        intensity = "extreme";
      } else if (data.performanceScore && data.performanceScore >= 60) {
        message = `🎸 Solid technical performance from the band`;
        intensity = "medium";
      } else {
        message = `🔧 Some technical hiccups, but the band recovers`;
        intensity = "low";
      }
      break;

    case "milestone":
      message = `🏆 ${data.specialMoment}`;
      intensity = "extreme";
      break;
  }

  return {
    id: `${Date.now()}-${Math.random()}`,
    type,
    message,
    timestamp: new Date(),
    intensity
  };
};
