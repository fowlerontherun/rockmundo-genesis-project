import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Handshake, Clock, DollarSign, Percent, Package, Crown, Check, X } from "lucide-react";
import { useCollaborationOffers, useRespondToOffer, BRAND_TIER_COLORS, BRAND_TIER_LABELS } from "@/hooks/useMerchCollaborations";
import { formatDistanceToNow } from "date-fns";

interface CollaborationOffersCardProps {
  bandId: string | null;
}

const formatCurrency = (value: number) => 
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);

export const CollaborationOffersCard = ({ bandId }: CollaborationOffersCardProps) => {
  const { data: offers, isLoading } = useCollaborationOffers(bandId);
  const respondMutation = useRespondToOffer();

  const handleAccept = (offer: any) => {
    respondMutation.mutate({
      offerId: offer.id,
      bandId: bandId!,
      accept: true,
      brand: offer.brand,
      productType: offer.product_type,
      qualityTier: offer.brand?.quality_boost,
      salesBoost: offer.brand?.sales_boost_pct,
    });
  };

  const handleReject = (offerId: string) => {
    respondMutation.mutate({
      offerId,
      bandId: bandId!,
      accept: false,
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Handshake className="h-5 w-5" />
            Brand Collaborations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!offers || offers.length === 0) {
    return (
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Handshake className="h-5 w-5" />
            Brand Collaborations
          </CardTitle>
          <CardDescription>
            No collaboration offers at the moment. Build your fame to attract brand partners!
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6 text-muted-foreground">
            <Crown className="h-12 w-12 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Brands will reach out as your band grows</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-yellow-500/30 bg-gradient-to-br from-yellow-500/5 to-orange-500/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-yellow-600">
          <Handshake className="h-5 w-5" />
          Brand Collaboration Offers
        </CardTitle>
        <CardDescription>
          {offers.length} pending offer{offers.length !== 1 ? 's' : ''} from brands wanting to partner with you
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="max-h-[400px]">
          <div className="space-y-4">
            {offers.map((offer) => (
              <Card key={offer.id} className="overflow-hidden">
                <div className="p-4">
                  {/* Brand Header */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-3">
                      {offer.brand?.logo_url ? (
                        <img 
                          src={offer.brand.logo_url} 
                          alt={offer.brand.name}
                          className="w-10 h-10 rounded-lg object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary/20 to-primary/40 flex items-center justify-center">
                          <Crown className="h-5 w-5 text-primary" />
                        </div>
                      )}
                      <div>
                        <h4 className="font-semibold">{offer.brand?.name || 'Unknown Brand'}</h4>
                        <Badge 
                          variant="outline" 
                          className={`text-xs ${BRAND_TIER_COLORS[offer.brand?.brand_tier || 'indie']}`}
                        >
                          {BRAND_TIER_LABELS[offer.brand?.brand_tier || 'indie']}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span>Expires {formatDistanceToNow(new Date(offer.expires_at), { addSuffix: true })}</span>
                    </div>
                  </div>

                  {/* Offer Details */}
                  <div className="grid grid-cols-3 gap-2 mb-3 text-sm">
                    <div className="p-2 rounded bg-muted/50 text-center">
                      <DollarSign className="h-4 w-4 mx-auto mb-1 text-green-500" />
                      <p className="font-semibold">{formatCurrency(offer.upfront_payment)}</p>
                      <p className="text-xs text-muted-foreground">Upfront</p>
                    </div>
                    <div className="p-2 rounded bg-muted/50 text-center">
                      <Percent className="h-4 w-4 mx-auto mb-1 text-blue-500" />
                      <p className="font-semibold">{offer.royalty_per_sale}%</p>
                      <p className="text-xs text-muted-foreground">Royalty</p>
                    </div>
                    <div className="p-2 rounded bg-muted/50 text-center">
                      <Package className="h-4 w-4 mx-auto mb-1 text-purple-500" />
                      <p className="font-semibold capitalize">{offer.product_type}</p>
                      <p className="text-xs text-muted-foreground">Product</p>
                    </div>
                  </div>

                  {/* Benefits */}
                  {offer.brand && (
                    <div className="flex flex-wrap gap-2 mb-3">
                      <Badge variant="secondary" className="text-xs">
                        +{offer.brand.sales_boost_pct}% sales boost
                      </Badge>
                      <Badge variant="secondary" className="text-xs capitalize">
                        {offer.brand.quality_boost} quality
                      </Badge>
                    </div>
                  )}

                  {/* Message */}
                  {offer.offer_message && (
                    <p className="text-sm text-muted-foreground mb-3 italic">
                      "{offer.offer_message}"
                    </p>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2">
                    <Button 
                      className="flex-1" 
                      onClick={() => handleAccept(offer)}
                      disabled={respondMutation.isPending}
                    >
                      <Check className="h-4 w-4 mr-1" />
                      Accept
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={() => handleReject(offer.id)}
                      disabled={respondMutation.isPending}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
