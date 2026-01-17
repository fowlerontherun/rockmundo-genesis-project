import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { 
  Mic2, 
  MapPin, 
  DollarSign, 
  Star, 
  Disc,
  Settings,
  Music
} from "lucide-react";
import type { RecordingStudioBusiness } from "@/types/recording-studio-business";

interface RecordingStudioCardProps {
  studio: RecordingStudioBusiness;
  onManage?: () => void;
}

export function RecordingStudioCard({ studio, onManage }: RecordingStudioCardProps) {
  const getReputationLevel = (reputation: number) => {
    if (reputation >= 80) return { label: 'Legendary', color: 'bg-yellow-500' };
    if (reputation >= 60) return { label: 'Premium', color: 'bg-purple-500' };
    if (reputation >= 40) return { label: 'Professional', color: 'bg-blue-500' };
    return { label: 'Indie', color: 'bg-muted' };
  };

  const repLevel = getReputationLevel(studio.reputation);

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-red-500/10">
              <Mic2 className="h-5 w-5 text-red-500" />
            </div>
            <div>
              <CardTitle className="text-lg">{studio.name}</CardTitle>
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <MapPin className="h-3 w-3" />
                {studio.cities?.name || 'Unknown'}, {studio.cities?.country || ''}
              </div>
            </div>
          </div>
          <Badge className={repLevel.color}>{repLevel.label}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-green-500" />
            <span>${studio.hourly_rate}/hr</span>
          </div>
          <div className="flex items-center gap-2">
            <Music className="h-4 w-4 text-blue-500" />
            <span>{studio.max_tracks} tracks</span>
          </div>
          <div className="flex items-center gap-2">
            <Star className="h-4 w-4 text-yellow-500" />
            <span>Quality: {studio.quality_rating}%</span>
          </div>
          {studio.mastering_capable && (
            <div className="flex items-center gap-2">
              <Disc className="h-4 w-4 text-purple-500" />
              <span>Mastering</span>
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-1">
          {studio.has_live_room && (
            <Badge variant="outline" className="text-xs">Live Room</Badge>
          )}
          {studio.has_isolation_booths > 0 && (
            <Badge variant="outline" className="text-xs">
              {studio.has_isolation_booths} Iso Booth{studio.has_isolation_booths > 1 ? 's' : ''}
            </Badge>
          )}
          <Badge variant="outline" className="text-xs capitalize">
            {studio.console_type} Console
          </Badge>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Equipment Rating</span>
            <span>{studio.equipment_rating}%</span>
          </div>
          <Progress value={studio.equipment_rating} className="h-2" />
        </div>

        <div className="pt-2 border-t grid grid-cols-2 gap-4">
          <div className="text-sm">
            <div className="text-muted-foreground">Albums Recorded</div>
            <div className="font-semibold">{studio.albums_recorded}</div>
          </div>
          <div className="text-sm">
            <div className="text-muted-foreground">Hit Songs</div>
            <div className="font-semibold text-yellow-500">{studio.hit_songs_recorded}</div>
          </div>
          <div className="text-sm">
            <div className="text-muted-foreground">Total Sessions</div>
            <div className="font-semibold">{studio.total_sessions.toLocaleString()}</div>
          </div>
          <div className="text-sm">
            <div className="text-muted-foreground">Revenue</div>
            <div className="font-semibold text-green-500">
              ${studio.total_revenue.toLocaleString()}
            </div>
          </div>
        </div>

        {onManage && (
          <Button onClick={onManage} className="w-full" variant="outline">
            <Settings className="h-4 w-4 mr-2" />
            Manage Studio
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
