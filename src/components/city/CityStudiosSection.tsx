import { Music, Star } from "lucide-react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface Studio {
  id: string;
  name: string;
  hourly_rate: number;
  quality_rating: number;
  specialties: string[] | null;
  equipment_rating: number;
  available_slots: number;
  district?: {
    name: string;
  } | null;
}

interface CityStudiosSectionProps {
  studios: Studio[];
}

export const CityStudiosSection = ({ studios }: CityStudiosSectionProps) => {
  if (!studios.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Music className="h-5 w-5 text-primary" />
            Recording Studios
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground">
            No recording studios available in this city yet.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Music className="h-5 w-5 text-primary" />
          Recording Studios
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {studios.map((studio) => (
          <div key={studio.id} className="space-y-3 rounded-lg border border-border/60 p-4 hover:border-primary/50 transition-colors">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <h3 className="text-base font-semibold">{studio.name}</h3>
                {studio.district && (
                  <p className="text-sm text-muted-foreground">{studio.district.name}</p>
                )}
              </div>
              <div className="text-right">
                <div className="text-lg font-bold">${studio.hourly_rate}/hr</div>
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Star className="h-3 w-3 fill-yellow-500 text-yellow-500" />
                  <span>{studio.quality_rating}/100</span>
                </div>
              </div>
            </div>
            {studio.specialties && studio.specialties.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {studio.specialties.map((specialty) => (
                  <Badge key={`${studio.id}-${specialty}`} variant="secondary">
                    {specialty}
                  </Badge>
                ))}
              </div>
            )}
            <div className="flex items-center justify-between pt-2">
              <div className="flex gap-4 text-xs text-muted-foreground">
                <span>Equipment: {studio.equipment_rating}/100</span>
                <span>Available slots: {studio.available_slots}</span>
              </div>
              <Button size="sm" variant="outline" asChild>
                <Link to="/music-studio">Book Session</Link>
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};
