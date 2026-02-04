import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Swords, Trophy, Star, Flame, Zap, Award } from "lucide-react";
import { cn } from "@/lib/utils";

interface RivalryBand {
  id: string;
  name: string;
  genre?: string;
  fame?: number;
}

interface FestivalRivalry {
  id: string;
  festival_id: string;
  rivalry_type: string;
  band_a: RivalryBand;
  band_b: RivalryBand;
  band_a_score?: number;
  band_b_score?: number;
  winner_band_id?: string;
  winner?: { id: string; name: string };
  fame_stakes: number;
  resolved_at?: string;
}

interface FestivalRivalryCardProps {
  rivalry: FestivalRivalry;
  currentBandId?: string;
  className?: string;
}

const RIVALRY_TYPE_CONFIG: Record<string, { label: string; icon: any; color: string; description: string }> = {
  genre_clash: { 
    label: "Genre Clash", 
    icon: Flame, 
    color: "text-red-500",
    description: "Similar genres compete for the same audience"
  },
  fame_battle: { 
    label: "Fame Battle", 
    icon: Star, 
    color: "text-yellow-500",
    description: "Bands with similar fame levels go head-to-head"
  },
  crowd_favorite: { 
    label: "Crowd Favorite", 
    icon: Zap, 
    color: "text-blue-500",
    description: "Who can get the crowd most hyped?"
  },
  critical_acclaim: { 
    label: "Critical Acclaim", 
    icon: Award, 
    color: "text-purple-500",
    description: "Best critic reviews wins"
  },
};

export function FestivalRivalryCard({ rivalry, currentBandId, className }: FestivalRivalryCardProps) {
  const config = RIVALRY_TYPE_CONFIG[rivalry.rivalry_type] || RIVALRY_TYPE_CONFIG.crowd_favorite;
  const Icon = config.icon;

  const isResolved = !!rivalry.resolved_at;
  const isWinner = rivalry.winner_band_id === currentBandId;
  const isLoser = isResolved && rivalry.winner_band_id !== currentBandId && 
    (rivalry.band_a.id === currentBandId || rivalry.band_b.id === currentBandId);

  const getBandDisplay = (band: RivalryBand, score?: number, isCurrentBand?: boolean) => {
    const isThisWinner = rivalry.winner_band_id === band.id;
    
    return (
      <div className={cn(
        "flex-1 p-3 rounded-lg text-center transition-all",
        isCurrentBand && "ring-2 ring-primary",
        isThisWinner && isResolved && "bg-green-500/10 ring-2 ring-green-500",
        !isThisWinner && isResolved && "opacity-60"
      )}>
        <p className={cn(
          "font-bold truncate",
          isCurrentBand && "text-primary",
          isThisWinner && isResolved && "text-green-500"
        )}>
          {band.name}
        </p>
        {band.genre && (
          <p className="text-xs text-muted-foreground">{band.genre}</p>
        )}
        {band.fame && (
          <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
            <Star className="h-3 w-3" />
            {band.fame.toLocaleString()}
          </p>
        )}
        {score !== undefined && isResolved && (
          <p className={cn(
            "mt-2 text-2xl font-bold",
            isThisWinner ? "text-green-500" : "text-muted-foreground"
          )}>
            {score}
          </p>
        )}
        {isThisWinner && isResolved && (
          <Badge className="mt-2 bg-green-500">
            <Trophy className="h-3 w-3 mr-1" />
            Winner
          </Badge>
        )}
      </div>
    );
  };

  return (
    <Card className={cn(
      "overflow-hidden",
      isWinner && "border-green-500/50",
      isLoser && "border-red-500/50",
      className
    )}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon className={cn("h-5 w-5", config.color)} />
            <span>{config.label}</span>
          </div>
          <Badge variant="outline" className={cn(isResolved ? "bg-green-500/10" : "bg-yellow-500/10")}>
            {isResolved ? "Resolved" : "Pending"}
          </Badge>
        </CardTitle>
        <p className="text-xs text-muted-foreground">{config.description}</p>
      </CardHeader>

      <CardContent>
        <div className="flex items-center gap-2">
          {getBandDisplay(rivalry.band_a, rivalry.band_a_score, rivalry.band_a.id === currentBandId)}
          
          <div className="flex flex-col items-center gap-1 px-2">
            <Swords className={cn("h-6 w-6", isResolved ? "text-muted-foreground" : config.color)} />
            <span className="text-xs font-medium">VS</span>
          </div>

          {getBandDisplay(rivalry.band_b, rivalry.band_b_score, rivalry.band_b.id === currentBandId)}
        </div>

        {/* Stakes */}
        <div className="mt-3 p-2 bg-muted/50 rounded-lg text-center">
          <p className="text-xs text-muted-foreground">Stakes</p>
          <p className="font-bold flex items-center justify-center gap-1">
            <Star className="h-4 w-4 text-yellow-500" />
            {rivalry.fame_stakes.toLocaleString()} Fame
          </p>
          {isResolved && currentBandId && (
            <p className={cn(
              "text-sm font-medium mt-1",
              isWinner ? "text-green-500" : isLoser ? "text-red-500" : "text-muted-foreground"
            )}>
              {isWinner ? `+${rivalry.fame_stakes} Fame Won!` : isLoser ? `-${rivalry.fame_stakes} Fame Lost` : "You weren't involved"}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
