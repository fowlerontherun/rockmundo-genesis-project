import { MapPin, Loader2, Music } from "lucide-react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CountryFlag } from "@/components/location/CountryFlag";
import { getCountryColors } from "@/data/countryData";

interface CurrentLocationWidgetProps {
  city: {
    id: string;
    name: string;
    country: string;
    music_scene: number;
  } | null;
  loading?: boolean;
}

export const CurrentLocationWidget = ({ city, loading }: CurrentLocationWidgetProps) => {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            Your Location
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Loading location...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!city) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            Your Location
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">Location not set</p>
          <Button variant="outline" size="sm" asChild>
            <Link to="/cities">Explore Cities</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const colors = getCountryColors(city.country);

  return (
    <Card 
      className="overflow-hidden"
      style={{
        borderColor: `hsl(${colors.primary} / 0.3)`
      }}
    >
      {/* Country color accent bar */}
      <div 
        className="h-1"
        style={{
          background: `linear-gradient(90deg, hsl(${colors.primary}), hsl(${colors.secondary}))`
        }}
      />
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2">
          <CountryFlag country={city.country} size="md" showTooltip={false} />
          <span>Your Location</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <h3 className="text-2xl font-bold">{city.name}</h3>
          <p className="text-sm text-muted-foreground flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            {city.country}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge 
            variant="secondary"
            className="flex items-center gap-1"
            style={{
              borderColor: `hsl(${colors.primary} / 0.4)`,
              background: `hsl(${colors.primary} / 0.1)`
            }}
          >
            <Music className="h-3 w-3" />
            Music Scene: {city.music_scene}%
          </Badge>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild className="flex-1">
            <Link to={`/cities/${city.id}`}>Explore City</Link>
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            asChild 
            className="flex-1"
            style={{
              borderColor: `hsl(${colors.primary} / 0.5)`,
              color: `hsl(${colors.primary})`
            }}
          >
            <Link to="/travel">Travel</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
