import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Truck, MapPin, Star, Clock, Package } from "lucide-react";
import type { LogisticsCompany } from "@/types/logistics-business";
import { LICENSE_TIER_NAMES, LICENSE_TIER_FLEET_LIMITS } from "@/types/logistics-business";

interface LogisticsCompanyCardProps {
  company: LogisticsCompany;
  onClick?: () => void;
}

export function LogisticsCompanyCard({ company, onClick }: LogisticsCompanyCardProps) {
  const fleetLimit = LICENSE_TIER_FLEET_LIMITS[company.license_tier] || 3;
  const fleetUsage = (company.current_fleet_size / fleetLimit) * 100;
  const onTimePercent = (company.on_time_delivery_rate || 0.95) * 100;

  return (
    <Card 
      className="hover:border-primary/50 transition-colors cursor-pointer"
      onClick={onClick}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <Truck className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">{company.name}</CardTitle>
              <CardDescription>
                {LICENSE_TIER_NAMES[company.license_tier] || 'Local Courier'}
              </CardDescription>
            </div>
          </div>
          <Badge variant="outline">Tier {company.license_tier}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Fleet Capacity */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground flex items-center gap-1">
              <Truck className="h-3 w-3" /> Fleet
            </span>
            <span>{company.current_fleet_size} / {fleetLimit} vehicles</span>
          </div>
          <Progress value={fleetUsage} className="h-2" />
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="flex items-center gap-2">
            <Star className="h-4 w-4 text-warning" />
            <div>
              <p className="text-muted-foreground">Quality</p>
              <p className="font-medium">{company.service_quality_rating}%</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-success" />
            <div>
              <p className="text-muted-foreground">On-Time</p>
              <p className="font-medium">{onTimePercent.toFixed(0)}%</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-info" />
            <div>
              <p className="text-muted-foreground">Contracts</p>
              <p className="font-medium">{company.total_contracts_completed}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-accent" />
            <div>
              <p className="text-muted-foreground">Distance</p>
              <p className="font-medium">{(company.total_distance_covered / 1000).toFixed(0)}k km</p>
            </div>
          </div>
        </div>

        {/* Specializations */}
        {company.specializations && company.specializations.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {company.specializations.slice(0, 3).map((spec) => (
              <Badge key={spec} variant="secondary" className="text-xs">
                {spec}
              </Badge>
            ))}
            {company.specializations.length > 3 && (
              <Badge variant="secondary" className="text-xs">
                +{company.specializations.length - 3}
              </Badge>
            )}
          </div>
        )}

        {/* Operating Regions */}
        <div className="text-xs text-muted-foreground">
          Operating in: {company.operating_regions?.join(", ") || "Local"}
        </div>
      </CardContent>
    </Card>
  );
}
