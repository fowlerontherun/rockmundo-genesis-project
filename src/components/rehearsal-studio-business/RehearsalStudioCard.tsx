import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { 
  Music, 
  MapPin, 
  DollarSign, 
  Star, 
  Users,
  Mic2,
  Settings 
} from "lucide-react";
import type { RehearsalStudioBusiness } from "@/types/rehearsal-studio-business";

interface RehearsalStudioCardProps {
  studio: RehearsalStudioBusiness;
  onManage?: () => void;
}

export function RehearsalStudioCard({ studio, onManage }: RehearsalStudioCardProps) {
  const getReputationLevel = (reputation: number) => {
    if (reputation >= 80) return { label: 'Legendary', color: 'bg-yellow-500' };
    if (reputation >= 60) return { label: 'Premium', color: 'bg-purple-500' };
    if (reputation >= 40) return { label: 'Standard', color: 'bg-blue-500' };
    return { label: 'Basic', color: 'bg-muted' };
  };

  const repLevel = getReputationLevel(studio.reputation);

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <Music className="h-5 w-5 text-primary" />
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
            <Users className="h-4 w-4 text-blue-500" />
            <span>Cap: {studio.capacity}</span>
          </div>
          <div className="flex items-center gap-2">
            <Star className="h-4 w-4 text-yellow-500" />
            <span>Quality: {studio.quality_rating}%</span>
          </div>
          {studio.recording_capable && (
            <div className="flex items-center gap-2">
              <Mic2 className="h-4 w-4 text-red-500" />
              <span>Recording</span>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Soundproofing</span>
            <span>{studio.soundproofing_level}%</span>
          </div>
          <Progress value={studio.soundproofing_level} className="h-2" />
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Equipment Quality</span>
            <span>{studio.equipment_quality}%</span>
          </div>
          <Progress value={studio.equipment_quality} className="h-2" />
        </div>

        <div className="pt-2 border-t flex justify-between items-center">
          <div className="text-sm">
            <div className="text-muted-foreground">Total Bookings</div>
            <div className="font-semibold">{studio.total_bookings.toLocaleString()}</div>
          </div>
          <div className="text-sm text-right">
            <div className="text-muted-foreground">Total Revenue</div>
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
