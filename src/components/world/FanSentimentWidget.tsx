import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Heart, ShoppingBag, Ticket, Music, Sparkles, Radio, Video, Users } from "lucide-react";
import { getFanSentiment, type FanSentiment } from "@/utils/fanSentiment";

interface FanSentimentWidgetProps {
  score: number;
  compact?: boolean;
}

const MOOD_EMOJI: Record<FanSentiment["mood"], string> = {
  hostile: "😡",
  frustrated: "😤",
  indifferent: "😐",
  pleased: "😊",
  devoted: "🤩",
  fanatical: "🔥",
};

const MOOD_COLORS: Record<FanSentiment["mood"], string> = {
  hostile: "bg-destructive/20 border-destructive/30 text-destructive",
  frustrated: "bg-orange-500/20 border-orange-500/30 text-orange-400",
  indifferent: "bg-muted/40 border-border text-muted-foreground",
  pleased: "bg-primary/20 border-primary/30 text-primary",
  devoted: "bg-accent/20 border-accent/30 text-accent-foreground",
  fanatical: "bg-warning/20 border-warning/30 text-warning",
};

export const FanSentimentBadge = ({ score }: { score: number }) => {
  const sentiment = getFanSentiment(score);
  return (
    <Badge variant="outline" className={`text-[10px] ${MOOD_COLORS[sentiment.mood]}`}>
      {MOOD_EMOJI[sentiment.mood]} {sentiment.mood.charAt(0).toUpperCase() + sentiment.mood.slice(1)}
    </Badge>
  );
};

export const FanSentimentWidget = ({ score, compact = false }: FanSentimentWidgetProps) => {
  const sentiment = getFanSentiment(score);
  const normalizedScore = ((sentiment.score + 100) / 200) * 100; // 0-100 for progress bar

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm">{MOOD_EMOJI[sentiment.mood]}</span>
        <Progress value={normalizedScore} className="h-1.5 flex-1" />
        <span className="text-[10px] font-mono text-muted-foreground">{sentiment.score}</span>
      </div>
    );
  }

  return (
    <Card className="border-border/50 bg-card/80">
      <CardHeader className="pb-2 pt-3 px-3">
        <CardTitle className="text-xs font-oswald flex items-center gap-2">
          <Heart className="h-3.5 w-3.5 text-destructive" />
          Fan Sentiment
          <FanSentimentBadge score={score} />
        </CardTitle>
      </CardHeader>
      <CardContent className="px-3 pb-3 space-y-2">
        <div className="space-y-1">
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>Sentiment Score</span>
            <span className="font-mono">{sentiment.score}</span>
          </div>
          <Progress value={normalizedScore} className="h-1.5" />
          <div className="flex justify-between text-[9px] text-muted-foreground/60">
            <span>Hostile</span>
            <span>Fanatical</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px]">
          <div className="flex items-center gap-1">
            <ShoppingBag className="h-3 w-3 text-primary" />
            <span className="text-muted-foreground">Merch:</span>
            <span className="font-mono">{sentiment.merchDemandMod}x</span>
          </div>
          <div className="flex items-center gap-1">
            <Ticket className="h-3 w-3 text-warning" />
            <span className="text-muted-foreground">Tickets:</span>
            <span className="font-mono">{sentiment.ticketDemandMod}x</span>
          </div>
          <div className="flex items-center gap-1">
            <Music className="h-3 w-3 text-accent-foreground" />
            <span className="text-muted-foreground">Streams:</span>
            <span className="font-mono">{sentiment.streamLoyaltyMod}x</span>
          </div>
          <div className="flex items-center gap-1">
            <Radio className="h-3 w-3 text-emerald-400" />
            <span className="text-muted-foreground">Radio:</span>
            <span className="font-mono">{sentiment.radioEngagementMod}x</span>
          </div>
          <div className="flex items-center gap-1">
            <Video className="h-3 w-3 text-blue-400" />
            <span className="text-muted-foreground">Video:</span>
            <span className="font-mono">{sentiment.videoViewsMod}x</span>
          </div>
          <div className="flex items-center gap-1">
            <Users className="h-3 w-3 text-violet-400" />
            <span className="text-muted-foreground">Followers:</span>
            <span className="font-mono">{sentiment.followerGrowthMod}x</span>
          </div>
          <div className="flex items-center gap-1 col-span-2">
            <Sparkles className="h-3 w-3 text-yellow-400" />
            <span className="text-muted-foreground">Viral chance:</span>
            <span className="font-mono">{(sentiment.viralChance * 100).toFixed(1)}%</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
