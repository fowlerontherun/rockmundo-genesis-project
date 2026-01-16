import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, Music, Users } from "lucide-react";
import { OwnershipBreakdown } from "./OwnershipBreakdown";

interface SongOwnership {
  user_id: string;
  ownership_percentage: number;
  role: string;
  is_active_member: boolean;
}

interface RepertoireSongCardProps {
  song: {
    id: string;
    title: string;
    genre: string | null;
    quality_score: number;
    status: string;
    created_at: string;
    audio_url: string | null;
    streams: number;
    revenue: number;
    ownership?: SongOwnership[];
  };
  bandId: string;
}

const getQualityColor = (score: number) => {
  if (score >= 80) return "text-green-500";
  if (score >= 60) return "text-yellow-500";
  if (score >= 40) return "text-orange-500";
  return "text-red-500";
};

const getStatusVariant = (status: string): "default" | "secondary" | "outline" => {
  switch (status) {
    case "released":
      return "default";
    case "recorded":
      return "secondary";
    default:
      return "outline";
  }
};

export const RepertoireSongCard = ({ song, bandId }: RepertoireSongCardProps) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card>
      <CardContent className="py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 flex-1">
            <div className="p-2 bg-muted rounded-lg">
              <Music className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold">{song.title}</h3>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                {song.genre && <span>{song.genre}</span>}
                <span>•</span>
                <span>{new Date(song.created_at).toLocaleDateString()}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right hidden md:block">
              <p className="text-sm font-medium">
                {(song.streams || 0).toLocaleString()} streams
              </p>
              <p className="text-sm text-green-600">
                ${(song.revenue || 0).toLocaleString()}
              </p>
            </div>

            <Badge variant={getStatusVariant(song.status)}>{song.status}</Badge>

            <span className={`font-bold ${getQualityColor(song.quality_score)}`}>
              {song.quality_score}
            </span>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        {expanded && (
          <div className="mt-4 pt-4 border-t space-y-4">
            {/* Mobile stats */}
            <div className="md:hidden grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Streams</p>
                <p className="font-medium">{(song.streams || 0).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Revenue</p>
                <p className="font-medium text-green-600">
                  ${(song.revenue || 0).toLocaleString()}
                </p>
              </div>
            </div>

            {/* Ownership Breakdown */}
            {song.ownership && song.ownership.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <h4 className="font-medium">Ownership Breakdown</h4>
                </div>
                <OwnershipBreakdown ownership={song.ownership} />
              </div>
            )}

            {/* Audio player placeholder */}
            {song.audio_url && (
              <div className="p-3 bg-muted rounded-lg">
                <audio controls className="w-full" src={song.audio_url}>
                  Your browser does not support the audio element.
                </audio>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
