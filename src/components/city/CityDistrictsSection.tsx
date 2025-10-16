import { MapPin } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface District {
  id: string;
  city_id: string;
  name: string;
  description: string | null;
  vibe: string | null;
  safety_rating: number;
  music_scene_rating: number;
  rent_cost: number;
}

interface CityDistrictsSectionProps {
  cityId?: string;
  districts: District[];
  onDistrictAdded?: () => void;
}

import { CityDistrictsManagement } from "./CityDistrictsManagement";

export const CityDistrictsSection = ({ cityId, districts, onDistrictAdded }: CityDistrictsSectionProps) => {
  // If cityId and onDistrictAdded are provided, show the admin management view
  if (cityId && onDistrictAdded) {
    return <CityDistrictsManagement cityId={cityId} districts={districts} onDistrictAdded={onDistrictAdded} />;
  }

  // Otherwise show the read-only public view
  if (!districts.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            Districts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground">
            District information is being compiled for this city.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-5 w-5 text-primary" />
          Districts & Neighborhoods
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {districts.map((district) => (
          <div key={district.id} className="space-y-3 rounded-lg border border-border/60 p-4 hover:border-primary/50 transition-colors">
            <div>
              <h3 className="text-lg font-semibold">{district.name}</h3>
              {district.vibe && (
                <Badge variant="secondary" className="mt-1">{district.vibe}</Badge>
              )}
            </div>
            {district.description && (
              <p className="text-sm text-muted-foreground leading-relaxed">{district.description}</p>
            )}
            <div className="flex flex-wrap gap-2 text-xs">
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground">Music Scene:</span>
                <span className="font-semibold">{district.music_scene_rating}%</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground">Safety:</span>
                <span className="font-semibold">{district.safety_rating}%</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground">Rent:</span>
                <span className="font-semibold">${district.rent_cost}</span>
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};
