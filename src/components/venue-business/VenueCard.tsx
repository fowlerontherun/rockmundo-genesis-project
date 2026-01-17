import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Building2, Users, Music, Star, DollarSign, Settings } from "lucide-react";

interface VenueCardProps {
  venue: {
    id: string;
    name: string;
    capacity: number;
    daily_operating_cost?: number;
    equipment_quality?: number;
    sound_system_rating?: number;
    lighting_rating?: number;
    reputation_score?: number;
    total_gigs_hosted?: number;
    city?: { name: string; country: string };
  };
  onManage: () => void;
}

export function VenueCard({ venue, onManage }: VenueCardProps) {
  const avgRating = ((venue.sound_system_rating || 3) + (venue.lighting_rating || 3) + (venue.equipment_quality || 3)) / 3;
  
  return (
    <Card className="hover:border-primary/50 transition-colors">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            <div>
              <CardTitle className="text-lg">{venue.name}</CardTitle>
              <p className="text-sm text-muted-foreground">
                {venue.city?.name}, {venue.city?.country}
              </p>
            </div>
          </div>
          <Badge variant="secondary">
            <Users className="h-3 w-3 mr-1" />
            {venue.capacity}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="flex items-center gap-2">
            <Music className="h-4 w-4 text-muted-foreground" />
            <span>{venue.total_gigs_hosted || 0} Gigs Hosted</span>
          </div>
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-muted-foreground" />
            <span>${venue.daily_operating_cost || 500}/day</span>
          </div>
        </div>
        
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Reputation</span>
            <span>{venue.reputation_score || 50}/100</span>
          </div>
          <Progress value={venue.reputation_score || 50} className="h-2" />
        </div>
        
        <div className="flex items-center justify-between pt-2 border-t">
          <div className="text-sm">
            <span className="text-muted-foreground">Quality: </span>
            <span className="font-medium">{"⭐".repeat(Math.round(avgRating))}</span>
          </div>
        </div>
        
        <Button onClick={onManage} className="w-full">
          <Settings className="h-4 w-4 mr-2" />
          Manage Venue
        </Button>
      </CardContent>
    </Card>
  );
}
