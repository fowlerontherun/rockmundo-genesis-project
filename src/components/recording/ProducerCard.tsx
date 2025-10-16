import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Music2, Star, TrendingUp, Award } from "lucide-react";
import type { RecordingProducer } from "@/hooks/useRecordingData";

interface ProducerCardProps {
  producer: RecordingProducer;
  onSelect: (producer: RecordingProducer) => void;
  isSelected?: boolean;
}

const TIER_COLORS = {
  budget: 'default',
  mid: 'secondary',
  premium: 'outline',
  legendary: 'default',
} as const;

const TIER_LABELS = {
  budget: 'Budget',
  mid: 'Mid-Tier',
  premium: 'Premium',
  legendary: 'Legendary',
} as const;

export const ProducerCard = ({ producer, onSelect, isSelected }: ProducerCardProps) => {
  return (
    <Card className={`transition-all hover:shadow-md ${isSelected ? 'ring-2 ring-primary' : ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg flex items-center gap-2">
              <Music2 className="h-5 w-5 text-primary" />
              {producer.name}
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">{producer.specialty_genre}</p>
          </div>
          <Badge variant={TIER_COLORS[producer.tier]}>
            {TIER_LABELS[producer.tier]}
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

        {producer.past_works.length > 0 && (
          <div className="text-xs text-muted-foreground">
            <span className="font-medium">Past Works:</span> {producer.past_works.slice(0, 2).join(', ')}
            {producer.past_works.length > 2 && ` +${producer.past_works.length - 2} more`}
          </div>
        )}

        <Button
          onClick={() => onSelect(producer)}
          variant={isSelected ? 'default' : 'outline'}
          className="w-full"
          size="sm"
        >
          {isSelected ? 'Selected' : 'Select Producer'}
        </Button>
      </CardContent>
    </Card>
  );
};
