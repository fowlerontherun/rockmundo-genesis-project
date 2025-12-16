import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Building2, Star, Trophy, Crown, Sparkles, TrendingUp } from "lucide-react";
import { VenueRelationshipResult } from "@/utils/venueRelationshipCalculator";

interface VenueRelationshipCardProps {
  relationship: VenueRelationshipResult;
  venueName: string;
}

const tierConfig = {
  newcomer: { icon: Building2, color: 'text-muted-foreground', bgColor: 'bg-muted', label: 'Newcomer' },
  regular: { icon: Star, color: 'text-blue-500', bgColor: 'bg-blue-500/10', label: 'Regular' },
  favorite: { icon: Trophy, color: 'text-yellow-500', bgColor: 'bg-yellow-500/10', label: 'Favorite' },
  legendary: { icon: Crown, color: 'text-purple-500', bgColor: 'bg-purple-500/10', label: 'Legendary' }
};

export function VenueRelationshipCard({ relationship, venueName }: VenueRelationshipCardProps) {
  const config = tierConfig[relationship.tier];
  const TierIcon = config.icon;

  const progressToNextTier = relationship.nextTier 
    ? ((relationship.loyaltyPoints / relationship.nextTier.pointsRequired) * 100)
    : 100;

  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Building2 className="h-5 w-5 text-primary" />
          Venue Relationship
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Venue & Tier */}
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">{venueName}</p>
            <p className="text-sm text-muted-foreground">
              {relationship.gigsAtVenue} gig{relationship.gigsAtVenue !== 1 ? 's' : ''} performed
            </p>
          </div>
          <Badge className={`${config.bgColor} ${config.color} border-0`}>
            <TierIcon className="h-3 w-3 mr-1" />
            {config.label}
          </Badge>
        </div>

        {/* New Venue Badge */}
        {relationship.isNewVenue && (
          <div className="flex items-center gap-2 p-2 rounded-lg bg-green-500/10 border border-green-500/20">
            <Sparkles className="h-4 w-4 text-green-500" />
            <span className="text-sm text-green-500">First time at this venue!</span>
          </div>
        )}

        {/* Progress to Next Tier */}
        {relationship.nextTier && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Progress to {relationship.nextTier.name}</span>
              <span className="font-medium">{relationship.loyaltyPoints}/{relationship.nextTier.pointsRequired}</span>
            </div>
            <Progress value={progressToNextTier} className="h-2" />
            <p className="text-xs text-muted-foreground">
              {relationship.nextTier.pointsToGo} points to go
            </p>
          </div>
        )}

        {/* Tier Bonuses */}
        {relationship.tier !== 'newcomer' && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <TrendingUp className="h-4 w-4 text-green-500" />
              Active Bonuses
            </div>
            <div className="grid grid-cols-2 gap-2">
              {relationship.payoutBonus > 0 && (
                <div className="p-2 rounded-lg bg-green-500/10 text-center">
                  <p className="text-lg font-bold text-green-500">+{Math.round(relationship.payoutBonus * 100)}%</p>
                  <p className="text-xs text-muted-foreground">Payout Bonus</p>
                </div>
              )}
              {relationship.tierBonuses.merchBoostPercent > 0 && (
                <div className="p-2 rounded-lg bg-blue-500/10 text-center">
                  <p className="text-lg font-bold text-blue-500">+{relationship.tierBonuses.merchBoostPercent}%</p>
                  <p className="text-xs text-muted-foreground">Merch Sales</p>
                </div>
              )}
              {relationship.tierBonuses.bookingDiscount > 0 && (
                <div className="p-2 rounded-lg bg-purple-500/10 text-center">
                  <p className="text-lg font-bold text-purple-500">-{Math.round(relationship.tierBonuses.bookingDiscount * 100)}%</p>
                  <p className="text-xs text-muted-foreground">Booking Fee</p>
                </div>
              )}
              {relationship.tierBonuses.capacityBonus > 0 && (
                <div className="p-2 rounded-lg bg-yellow-500/10 text-center">
                  <p className="text-lg font-bold text-yellow-500">+{relationship.tierBonuses.capacityBonus}%</p>
                  <p className="text-xs text-muted-foreground">Draw Bonus</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Loyalty Points */}
        <div className="pt-2 border-t border-border/50">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Total Loyalty Points</span>
            <span className="font-bold text-primary">{relationship.loyaltyPoints}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
