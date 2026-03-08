import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Heart, Megaphone, TrendingUp, TrendingDown, Minus, Clock } from "lucide-react";
import { useSentimentEvents } from "@/hooks/useSentimentEvents";
import { formatDistanceToNow } from "date-fns";

const EVENT_ICONS: Record<string, string> = {
  amazing_gig: "🎤",
  bad_gig: "🎤",
  album_release: "💿",
  single_release: "🎵",
  chart_hit: "📊",
  music_video_release: "🎬",
  social_media_engagement: "📱",
  scandal: "💥",
  cancelled_show: "❌",
  pr_appearance: "📺",
  fan_interaction: "🤝",
  award_win: "🏆",
  daily_drift: "🌊",
  gig_cancellation: "❌",
  twaater_post: "🐦",
  controversy: "⚠️",
};

interface SentimentEventLogProps {
  bandId: string | null;
}

export const SentimentEventLog = ({ bandId }: SentimentEventLogProps) => {
  const { data: events, isLoading } = useSentimentEvents(bandId, 30);

  if (isLoading) {
    return (
      <Card className="border-border/50 bg-card/80">
        <CardHeader className="pb-2 pt-3 px-3">
          <CardTitle className="text-xs font-oswald flex items-center gap-2">
            <Clock className="h-3.5 w-3.5 text-muted-foreground animate-spin" />
            Loading sentiment history...
          </CardTitle>
        </CardHeader>
      </Card>
    );
  }

  if (!events?.length) {
    return (
      <Card className="border-border/50 bg-card/80">
        <CardHeader className="pb-2 pt-3 px-3">
          <CardTitle className="text-xs font-oswald flex items-center gap-2">
            <Heart className="h-3.5 w-3.5 text-muted-foreground" />
            Sentiment History
          </CardTitle>
        </CardHeader>
        <CardContent className="px-3 pb-3">
          <p className="text-[10px] text-muted-foreground italic">No sentiment events recorded yet. Play gigs, release music, and engage with fans to see changes here.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/50 bg-card/80">
      <CardHeader className="pb-2 pt-3 px-3">
        <CardTitle className="text-xs font-oswald flex items-center gap-2">
          <Heart className="h-3.5 w-3.5 text-destructive" />
          Sentiment History
          <Badge variant="outline" className="text-[9px] px-1 py-0">{events.length} events</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-3 pb-3">
        <ScrollArea className="h-[200px]">
          <div className="space-y-1.5">
            {events.map((event) => {
              const icon = EVENT_ICONS[event.event_type] || "📌";
              const isPositive = event.sentiment_change > 0;
              const isNeutral = event.sentiment_change === 0;

              return (
                <div
                  key={event.id}
                  className="flex items-start gap-2 p-1.5 rounded-sm hover:bg-muted/30 transition-colors"
                >
                  <span className="text-sm mt-0.5 shrink-0">{icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-medium truncate">
                        {event.description || event.event_type.replace(/_/g, " ")}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      {event.sentiment_change !== 0 && (
                        <span className={`text-[9px] font-mono flex items-center gap-0.5 ${isPositive ? "text-emerald-400" : "text-destructive"}`}>
                          {isPositive ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
                          {isPositive ? "+" : ""}{event.sentiment_change} sentiment
                        </span>
                      )}
                      {(event.media_intensity_change ?? 0) !== 0 && (
                        <span className={`text-[9px] font-mono flex items-center gap-0.5 ${(event.media_intensity_change ?? 0) > 0 ? "text-primary" : "text-muted-foreground"}`}>
                          <Megaphone className="h-2.5 w-2.5" />
                          {(event.media_intensity_change ?? 0) > 0 ? "+" : ""}{event.media_intensity_change} media
                        </span>
                      )}
                      {isNeutral && (event.media_intensity_change ?? 0) === 0 && (
                        <span className="text-[9px] font-mono text-muted-foreground flex items-center gap-0.5">
                          <Minus className="h-2.5 w-2.5" /> no change
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="text-[9px] text-muted-foreground/60 shrink-0 mt-0.5">
                    {formatDistanceToNow(new Date(event.created_at), { addSuffix: true })}
                  </span>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
