import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Star, Sparkles, Palette } from "lucide-react";

export interface TattooArtist {
  id: string;
  parlour_id: string;
  name: string;
  nickname: string | null;
  fame_level: number;
  specialty: string | null;
  quality_bonus: number;
  price_premium: number;
  accepts_custom: boolean;
  bio: string | null;
  total_tattoos_done: number;
}

function getFameTier(fame: number): { title: string; color: string } {
  if (fame >= 91) return { title: 'Legendary', color: 'text-yellow-400' };
  if (fame >= 71) return { title: 'Master', color: 'text-purple-400' };
  if (fame >= 46) return { title: 'Skilled', color: 'text-blue-400' };
  if (fame >= 21) return { title: 'Journeyman', color: 'text-green-400' };
  return { title: 'Apprentice', color: 'text-muted-foreground' };
}

interface TattooArtistCardProps {
  artist: TattooArtist;
  selected?: boolean;
  onSelect?: (artist: TattooArtist) => void;
  onBookCustom?: (artist: TattooArtist) => void;
}

export const TattooArtistCard = ({ artist, selected, onSelect, onBookCustom }: TattooArtistCardProps) => {
  const tier = getFameTier(artist.fame_level);

  return (
    <Card
      className={`cursor-pointer transition-all hover:scale-[1.02] ${selected ? 'ring-2 ring-primary' : ''}`}
      onClick={() => onSelect?.(artist)}
    >
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-semibold text-sm">{artist.name}</h4>
            {artist.nickname && (
              <p className="text-xs text-muted-foreground italic">"{artist.nickname}"</p>
            )}
          </div>
          <Badge variant="outline" className={`text-[10px] ${tier.color}`}>
            {tier.title}
          </Badge>
        </div>

        {/* Fame bar */}
        <div className="space-y-1">
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>Fame</span>
            <span>{artist.fame_level}/100</span>
          </div>
          <Progress value={artist.fame_level} className="h-1.5" />
        </div>

        {artist.bio && (
          <p className="text-xs text-muted-foreground line-clamp-2">{artist.bio}</p>
        )}

        <div className="flex flex-wrap gap-1.5">
          {artist.specialty && (
            <Badge variant="secondary" className="text-[10px]">
              <Palette className="h-2.5 w-2.5 mr-1" />
              {artist.specialty}
            </Badge>
          )}
          <Badge variant="outline" className="text-[10px] text-green-400 border-green-400/30">
            +{artist.quality_bonus} Quality
          </Badge>
          <Badge variant="outline" className="text-[10px]">
            x{artist.price_premium} Price
          </Badge>
        </div>

        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
          <span>{artist.total_tattoos_done.toLocaleString()} tattoos done</span>
          {artist.accepts_custom && (
            <Button
              size="sm"
              variant="outline"
              className="h-6 text-[10px] px-2"
              onClick={(e) => {
                e.stopPropagation();
                onBookCustom?.(artist);
              }}
            >
              <Sparkles className="h-3 w-3 mr-1" />
              Custom Design
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
