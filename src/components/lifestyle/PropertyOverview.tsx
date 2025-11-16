import { LifestyleProperty } from "@/types/lifestyle";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Star } from "lucide-react";

interface PropertyOverviewProps {
  property: LifestyleProperty | null;
}

export function PropertyOverview({ property }: PropertyOverviewProps) {
  if (!property) {
    return null;
  }

  const lifestyleFit = property.lifestyle_fit && typeof property.lifestyle_fit === "object"
    ? property.lifestyle_fit
    : null;

  return (
    <Card>
      <CardHeader className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div>
            <CardTitle className="text-2xl font-semibold">{property.name}</CardTitle>
            <CardDescription className="flex items-center gap-2 text-sm">
              <MapPin className="h-4 w-4" />
              <span>
                {property.city}
                {property.district ? ` · ${property.district}` : ""}
              </span>
            </CardDescription>
          </div>
          {property.rating && (
            <Badge variant="secondary" className="flex items-center gap-1">
              <Star className="h-4 w-4 text-primary" />
              {property.rating.toFixed(1)}
            </Badge>
          )}
        </div>
        {property.description && (
          <p className="text-sm text-muted-foreground">{property.description}</p>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {property.highlight_features && property.highlight_features.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Lifestyle Highlights</p>
            <div className="flex flex-wrap gap-2">
              {property.highlight_features.map((feature) => (
                <Badge key={feature} variant="outline" className="text-xs">
                  {feature}
                </Badge>
              ))}
            </div>
          </div>
        )}

        <div className="grid gap-2 text-sm md:grid-cols-2">
          <div className="rounded-md bg-muted/40 p-3">
            <p className="text-muted-foreground">Property Type</p>
            <p className="font-semibold">{property.property_type}</p>
          </div>
          {property.energy_rating && (
            <div className="rounded-md bg-muted/40 p-3">
              <p className="text-muted-foreground">Energy Rating</p>
              <p className="font-semibold">{property.energy_rating}</p>
            </div>
          )}
          {property.area_sq_ft && (
            <div className="rounded-md bg-muted/40 p-3">
              <p className="text-muted-foreground">Interior Space</p>
              <p className="font-semibold">{property.area_sq_ft.toLocaleString()} sqft</p>
            </div>
          )}
          {property.lot_size_sq_ft && (
            <div className="rounded-md bg-muted/40 p-3">
              <p className="text-muted-foreground">Lot Size</p>
              <p className="font-semibold">{property.lot_size_sq_ft.toLocaleString()} sqft</p>
            </div>
          )}
        </div>

        {lifestyleFit && (
          <div className="space-y-2 text-sm">
            <p className="font-medium">Lifestyle Fit</p>
            {lifestyleFit.focus && (
              <p className="text-muted-foreground">
                <span className="font-semibold">Ideal for:</span> {lifestyleFit.focus}
              </p>
            )}
            {Array.isArray(lifestyleFit.bonuses) && lifestyleFit.bonuses.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {lifestyleFit.bonuses.map((bonus: string) => (
                  <Badge key={bonus} variant="secondary" className="text-xs">
                    {bonus}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
