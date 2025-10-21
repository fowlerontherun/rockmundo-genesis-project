import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Music } from "lucide-react";

interface StreamingStatsCardProps {
  song: any;
  totalStreams: number;
  totalRevenue: number;
  dailyStreams?: number;
}

export const StreamingStatsCard = ({
  song,
  totalStreams,
  totalRevenue,
  dailyStreams
}: StreamingStatsCardProps) => {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="font-semibold text-lg">{song.title}</h3>
            <p className="text-sm text-muted-foreground">{song.genre}</p>
          </div>
          <Badge variant="outline">Quality: {song.quality_score}</Badge>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Music className="h-3 w-3" />
              Total Streams
            </div>
            <div className="text-2xl font-bold text-primary">
              {totalStreams.toLocaleString()}
            </div>
          </div>

          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">Total Revenue</div>
            <div className="text-2xl font-bold text-green-500">
              ${totalRevenue.toLocaleString()}
            </div>
          </div>

          {dailyStreams !== undefined && (
            <div className="col-span-2 pt-2 border-t">
              <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                <TrendingUp className="h-3 w-3" />
                Daily Streams
              </div>
              <div className="text-lg font-semibold">
                {dailyStreams.toLocaleString()} streams today
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
