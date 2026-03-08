import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Star, TrendingUp, Award, User, Music2 } from "lucide-react";
import type { RecordingProducer } from "@/hooks/useRecordingData";

interface PlayerProducerCardProps {
  producer: RecordingProducer;
  playerName?: string;
  playerLevel?: number;
  sessionCount?: number;
  avgRating?: number;
  onSelect: (producer: RecordingProducer) => void;
  isSelected?: boolean;
}

export const PlayerProducerCard = ({
  producer,
  playerName,
  playerLevel,
  sessionCount = 0,
  avgRating = 0,
  onSelect,
  isSelected,
}: PlayerProducerCardProps) => {
  return (
    <Card className={`transition-all hover:shadow-md ${isSelected ? 'ring-2 ring-primary' : ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              {producer.name}
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {playerName && <span>{playerName} · </span>}
              {producer.specialty_genre}
            </p>
          </div>
          <Badge className="bg-accent text-accent-foreground">
            🎮 Player Producer
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {producer.bio && (
          <p className="text-sm text-muted-foreground line-clamp-2">{producer.bio}</p>
        )}

        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="flex items-center gap-2">
            <Star className="h-4 w-4 text-yellow-500" />
            <span className="text-muted-foreground">Quality:</span>
            <span className="font-semibold">+{producer.quality_bonus}%</span>
          </div>

          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-blue-500" />
            <span className="text-muted-foreground">Mixing:</span>
            <span className="font-semibold">{producer.mixing_skill}/100</span>
          </div>

          <div className="flex items-center gap-2">
            <Award className="h-4 w-4 text-purple-500" />
            <span className="text-muted-foreground">Arrange:</span>
            <span className="font-semibold">{producer.arrangement_skill}/100</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Rate:</span>
            <span className="font-semibold text-primary">${producer.cost_per_hour.toLocaleString()}/hr</span>
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          {playerLevel != null && (
            <span>Level {playerLevel}</span>
          )}
          <span>{sessionCount} session{sessionCount !== 1 ? 's' : ''}</span>
          {avgRating > 0 && (
            <span className="flex items-center gap-1">
              <Star className="h-3 w-3 fill-yellow-500 text-yellow-500" />
              {avgRating.toFixed(1)}
            </span>
          )}
        </div>

        <Button
          onClick={() => onSelect(producer)}
          variant={isSelected ? 'default' : 'outline'}
          className="w-full"
          size="sm"
        >
          {isSelected ? 'Selected' : 'Hire Producer'}
        </Button>
      </CardContent>
    </Card>
  );
};
