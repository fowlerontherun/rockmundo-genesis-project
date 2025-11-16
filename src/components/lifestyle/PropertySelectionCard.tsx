import { LifestyleProperty } from "@/types/lifestyle";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, BedDouble, Bath, Ruler } from "lucide-react";
import { cn } from "@/lib/utils";

interface PropertySelectionCardProps {
  property: LifestyleProperty;
  selected: boolean;
  onSelect: () => void;
}

const currencyFormatter = new Intl.NumberFormat(undefined, {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export function PropertySelectionCard({ property, selected, onSelect }: PropertySelectionCardProps) {
  return (
    <Card
      onClick={onSelect}
      className={cn(
        "overflow-hidden transition hover:border-primary/60 hover:shadow-lg cursor-pointer",
        selected && "border-primary border-2 shadow-lg"
      )}
    >
      <div className="relative h-40 w-full overflow-hidden">
        {property.image_url ? (
          <img
            src={property.image_url}
            alt={property.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/10 via-primary/5 to-background">
            <span className="text-sm font-medium text-primary">Lifestyle Showcase</span>
          </div>
        )}
        {property.rating && (
          <div className="absolute right-4 top-4 rounded-full bg-background/90 px-3 py-1 text-sm font-semibold text-primary shadow">
            {property.rating.toFixed(1)} ★
          </div>
        )}
      </div>
      <CardHeader className="space-y-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl font-semibold">{property.name}</CardTitle>
          <Badge variant="secondary">{property.property_type}</Badge>
        </div>
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <MapPin className="h-4 w-4" />
          <span>
            {property.city}
            {property.district ? ` · ${property.district}` : ""}
          </span>
        </p>
        <p className="text-lg font-semibold text-primary">
          {currencyFormatter.format(property.base_price)}
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-2">
            <BedDouble className="h-4 w-4" />
            {property.bedrooms} bd
          </span>
          <span className="inline-flex items-center gap-2">
            <Bath className="h-4 w-4" />
            {property.bathrooms} ba
          </span>
          {property.area_sq_ft && (
            <span className="inline-flex items-center gap-2">
              <Ruler className="h-4 w-4" />
              {property.area_sq_ft.toLocaleString()} sqft
            </span>
          )}
        </div>
        {property.highlight_features && property.highlight_features.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {property.highlight_features.slice(0, 3).map((feature) => (
              <Badge key={feature} variant="outline" className="text-xs">
                {feature}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
