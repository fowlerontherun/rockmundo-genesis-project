import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Mic2, Music, Sparkles, Users, Flame } from "lucide-react";
import type { FestivalStageSlot } from "@/hooks/useFestivalStages";

interface CommentaryEntry {
  id: string;
  timestamp: Date;
  type: "arrival" | "song" | "crowd" | "special" | "dj";
  message: string;
  variant?: "default" | "success" | "warning";
}

const BAND_COMMENTARY = [
  "The crowd roars as the band launches into the next track! 🔥",
  "Incredible energy — the whole field is jumping!",
  "What a performance! This is why people come to festivals!",
  "The lead singer whips the crowd into a frenzy!",
  "Arms in the air as the chorus hits — MASSIVE singalong!",
  "The guitar solo echoes across the festival grounds!",
  "Crowd surfers spotted near the front! Security is busy!",
  "The bass is so heavy you can feel it in your chest!",
  "Goosebumps! What an incredible moment!",
  "The band is feeding off the crowd's energy — it's electric!",
  "Lighters and phone torches light up the crowd like stars ✨",
  "Beach balls bouncing through the audience!",
  "The drummer is absolutely destroying it right now!",
  "This set is going to be talked about for years!",
];

const DJ_COMMENTARY = [
  "The DJ drops a filthy bass line — the crowd goes wild! 🎧",
  "Smooth transition into the next track, keeping the vibe alive",
  "The beat drops and the field erupts!",
  "Hands in the air! The DJ knows exactly what the crowd wants",
  "A classic remix gets everyone singing along",
  "The light show syncs perfectly with the beat 💡",
  "The DJ teases a build-up... HERE IT COMES!",
  "The crowd is bouncing in perfect rhythm",
];

const CROWD_REACTIONS = [
  "The audience erupts in cheers! 🎉",
  "You can hear the crowd from stages away!",
  "People are flooding in from other stages to catch this!",
  "Amazing response — the crowd is completely captivated",
  "Chants echo across the festival grounds",
  "Standing ovation from the packed field!",
];

const getRandomItem = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

interface FestivalStageCommentaryProps {
  slot: FestivalStageSlot | undefined;
  stageName: string;
}

export const FestivalStageCommentary = ({ slot, stageName }: FestivalStageCommentaryProps) => {
  const [entries, setEntries] = useState<CommentaryEntry[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  const addEntry = useCallback((entry: Omit<CommentaryEntry, "id" | "timestamp">) => {
    setEntries((prev) => [
      ...prev.slice(-30),
      { ...entry, id: crypto.randomUUID(), timestamp: new Date() },
    ]);
  }, []);

  // Generate commentary when slot changes
  useEffect(() => {
    setEntries([]);
    if (!slot) return;

    const performerName = slot.is_npc_dj
      ? slot.npc_dj_name || "The DJ"
      : slot.band?.name || "The band";

    // Opening line
    addEntry({
      type: "arrival",
      message: `${performerName} takes the ${stageName}! The crowd surges forward!`,
      variant: "success",
    });

    // Periodic commentary
    intervalRef.current = setInterval(() => {
      const roll = Math.random();
      if (roll < 0.6) {
        const pool = slot.is_npc_dj ? DJ_COMMENTARY : BAND_COMMENTARY;
        addEntry({ type: slot.is_npc_dj ? "dj" : "song", message: getRandomItem(pool) });
      } else if (roll < 0.85) {
        addEntry({ type: "crowd", message: getRandomItem(CROWD_REACTIONS), variant: "success" });
      } else {
        addEntry({
          type: "special",
          message: `${performerName} is putting on a show that ${stageName} won't forget!`,
          variant: "success",
        });
      }
    }, 4000 + Math.random() * 3000);

    return () => clearInterval(intervalRef.current);
  }, [slot?.id, stageName, addEntry]);

  // Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [entries.length]);

  const iconMap: Record<string, React.ReactNode> = {
    arrival: <Music className="h-4 w-4 text-primary" />,
    song: <Mic2 className="h-4 w-4 text-primary" />,
    crowd: <Users className="h-4 w-4 text-primary" />,
    special: <Sparkles className="h-4 w-4 text-accent-foreground" />,
    dj: <Flame className="h-4 w-4 text-destructive" />,
  };

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Mic2 className="h-4 w-4" /> Live Commentary
          </CardTitle>
          <Badge variant="default" className="text-xs animate-pulse">🔴 LIVE</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[250px]">
          <div className="space-y-2 pr-2">
            {entries.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">
                Waiting for the next performance...
              </p>
            )}
            {entries.map((entry) => (
              <div
                key={entry.id}
                className={`flex items-start gap-2 p-2 rounded-lg text-sm ${
                  entry.variant === "success"
                    ? "bg-green-500/10"
                    : entry.variant === "warning"
                    ? "bg-yellow-500/10"
                    : "bg-muted/30"
                }`}
              >
                {iconMap[entry.type]}
                <p className="flex-1">{entry.message}</p>
                <span className="text-xs text-muted-foreground shrink-0">
                  {entry.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            ))}
            <div ref={scrollRef} />
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
