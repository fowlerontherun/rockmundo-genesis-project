import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  FileText, Star, DollarSign, TrendingUp, Users, 
  CheckCircle, AlertTriangle, XCircle, Plus 
} from 'lucide-react';
import { useBandRiders, useVenueRiderCompatibility, RIDER_TIERS, BandRider } from '@/hooks/useBandRiders';
import { cn } from '@/lib/utils';

interface RiderSelectorProps {
  bandId: string;
  venueId: string | null;
  selectedRiderId: string | null;
  onSelect: (riderId: string | null) => void;
  onCreateNew?: () => void;
}

const TIER_COLORS: Record<string, string> = {
  basic: 'bg-muted-foreground',
  standard: 'bg-primary',
  professional: 'bg-accent',
  star: 'bg-warning',
  legendary: 'bg-gradient-to-r from-warning to-destructive',
};

export function RiderSelector({ 
  bandId, 
  venueId, 
  selectedRiderId, 
  onSelect, 
  onCreateNew 
}: RiderSelectorProps) {
  const { riders, ridersLoading } = useBandRiders(bandId);

  if (ridersLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  if (!riders || riders.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-8 text-center">
          <FileText className="h-10 w-10 text-muted-foreground mb-3" />
          <h4 className="font-medium mb-1">No Riders Created</h4>
          <p className="text-sm text-muted-foreground mb-4">
            Create a rider to specify your technical and hospitality requirements
          </p>
          {onCreateNew && (
            <Button onClick={onCreateNew} size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Create First Rider
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <RadioGroup value={selectedRiderId || ''} onValueChange={onSelect}>
        {/* No rider option */}
        <div
          className={cn(
            "flex items-center space-x-3 rounded-lg border p-4 transition-colors cursor-pointer",
            !selectedRiderId && "border-primary bg-primary/5"
          )}
          onClick={() => onSelect(null)}
        >
          <RadioGroupItem value="" id="no-rider" />
          <Label htmlFor="no-rider" className="flex-1 cursor-pointer">
            <div className="font-medium">No Rider</div>
            <p className="text-sm text-muted-foreground">
              Perform without specific requirements (venue provides basics)
            </p>
          </Label>
        </div>

        {riders.map((rider) => (
          <RiderOption
            key={rider.id}
            rider={rider}
            venueId={venueId}
            isSelected={selectedRiderId === rider.id}
            onSelect={() => onSelect(rider.id)}
          />
        ))}
      </RadioGroup>

      {onCreateNew && (
        <Button variant="outline" className="w-full" onClick={onCreateNew}>
          <Plus className="mr-2 h-4 w-4" />
          Create New Rider
        </Button>
      )}
    </div>
  );
}

interface RiderOptionProps {
  rider: BandRider;
  venueId: string | null;
  isSelected: boolean;
  onSelect: () => void;
}

function RiderOption({ rider, venueId, isSelected, onSelect }: RiderOptionProps) {
  const { data: compatibility, isLoading } = useVenueRiderCompatibility(venueId, rider.id);
  const tierConfig = RIDER_TIERS.find(t => t.id === rider.tier);

  const getFulfillmentIcon = (pct: number) => {
    if (pct >= 80) return <CheckCircle className="h-4 w-4 text-success" />;
    if (pct >= 50) return <AlertTriangle className="h-4 w-4 text-warning" />;
    return <XCircle className="h-4 w-4 text-destructive" />;
  };

  const getFulfillmentLabel = (pct: number) => {
    if (pct >= 90) return 'Excellent Match';
    if (pct >= 70) return 'Good Match';
    if (pct >= 50) return 'Partial Match';
    return 'Poor Match';
  };

  return (
    <div
      className={cn(
        "rounded-lg border p-4 transition-colors cursor-pointer",
        isSelected && "border-primary bg-primary/5"
      )}
      onClick={onSelect}
    >
      <div className="flex items-start gap-3">
        <RadioGroupItem value={rider.id} id={rider.id} className="mt-1" />
        
        <div className="flex-1 space-y-3">
          <div className="flex items-center justify-between">
            <Label htmlFor={rider.id} className="cursor-pointer">
              <div className="flex items-center gap-2">
                <span className="font-medium">{rider.name}</span>
                {rider.is_default && (
                  <Badge variant="secondary" className="text-xs">
                    <Star className="mr-1 h-3 w-3" />
                    Default
                  </Badge>
                )}
              </div>
            </Label>
            <Badge className={cn("text-xs text-white", TIER_COLORS[rider.tier])}>
              {tierConfig?.name || rider.tier}
            </Badge>
          </div>

          {rider.description && (
            <p className="text-sm text-muted-foreground">{rider.description}</p>
          )}

          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1 text-muted-foreground">
              <DollarSign className="h-4 w-4" />
              <span>${rider.total_cost_estimate?.toLocaleString() || 0}</span>
            </div>
          </div>

          {/* Venue Compatibility */}
          {venueId && (
            <div className="pt-2 border-t">
              {isLoading ? (
                <Skeleton className="h-6 w-full" />
              ) : compatibility ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      {getFulfillmentIcon(compatibility.fulfillmentPercentage)}
                      <span>{getFulfillmentLabel(compatibility.fulfillmentPercentage)}</span>
                    </div>
                    <span className="font-medium">{compatibility.fulfillmentPercentage}%</span>
                  </div>
                  <Progress value={compatibility.fulfillmentPercentage} className="h-2" />
                  
                  <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <span>Technical:</span>
                      <span className="font-medium">{compatibility.technicalFulfillment}%</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span>Hospitality:</span>
                      <span className="font-medium">{compatibility.hospitalityFulfillment}%</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span>Backstage:</span>
                      <span className="font-medium">{compatibility.backstageFulfillment}%</span>
                    </div>
                  </div>

                  {isSelected && (
                    <div className="flex gap-4 pt-2 text-xs">
                      <div className="flex items-center gap-1 text-success">
                        <TrendingUp className="h-3 w-3" />
                        <span>+{Math.round((compatibility.performanceModifier - 1) * 100)}% performance</span>
                      </div>
                      <div className="flex items-center gap-1 text-primary">
                        <Users className="h-3 w-3" />
                        <span>+{Math.round((compatibility.moraleModifier - 1) * 100)}% morale</span>
                      </div>
                    </div>
                  )}

                  {compatibility.missing.length > 0 && isSelected && (
                    <div className="text-xs text-warning pt-1">
                      {compatibility.missing.length} item(s) unavailable at this venue
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Select a venue to see compatibility
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
