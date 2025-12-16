import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useFestivalSlotOffers } from "@/hooks/useFestivalSlotOffers";
import { Calendar, MapPin, Music, Clock, Check, X } from "lucide-react";
import { format } from "date-fns";

interface FestivalSlotOffersProps {
  bandId: string;
}

export const FestivalSlotOffers = ({ bandId }: FestivalSlotOffersProps) => {
  const { offers, isLoading, respondToOffer, isResponding } = useFestivalSlotOffers(bandId);

  if (isLoading) {
    return <div className="text-muted-foreground">Loading offers...</div>;
  }

  const pendingOffers = offers?.filter((o) => o.status === "pending") || [];
  const respondedOffers = offers?.filter((o) => o.status !== "pending") || [];

  if (!offers?.length) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <Music className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No festival slot offers yet</p>
          <p className="text-sm mt-2">Keep building your fame to attract festival invitations!</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {pendingOffers.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Pending Offers</h3>
          {pendingOffers.map((offer) => (
            <Card key={offer.id} className="border-primary/50">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{offer.festival?.name}</CardTitle>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                      <MapPin className="h-4 w-4" />
                      <span>{offer.festival?.city?.name}</span>
                    </div>
                  </div>
                  <Badge variant="outline" className="bg-primary/10">
                    {offer.slot_type}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span>
                      {offer.festival?.start_date && format(new Date(offer.festival.start_date), "MMM d, yyyy")}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span>{offer.performance_time || "TBD"}</span>
                  </div>
                </div>
                
                {offer.offered_payment && (
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <span className="text-sm text-muted-foreground">Offered Payment:</span>
                    <span className="ml-2 font-semibold text-primary">${offer.offered_payment.toLocaleString()}</span>
                  </div>
                )}

                {offer.message && (
                  <p className="text-sm text-muted-foreground italic">"{offer.message}"</p>
                )}

                <div className="flex gap-2">
                  <Button
                    onClick={() => respondToOffer({ offerId: offer.id, status: "accepted" })}
                    disabled={isResponding}
                    className="flex-1"
                  >
                    <Check className="h-4 w-4 mr-2" />
                    Accept
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => respondToOffer({ offerId: offer.id, status: "rejected" })}
                    disabled={isResponding}
                    className="flex-1"
                  >
                    <X className="h-4 w-4 mr-2" />
                    Decline
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {respondedOffers.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Past Offers</h3>
          {respondedOffers.map((offer) => (
            <Card key={offer.id} className="opacity-75">
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{offer.festival?.name}</p>
                    <p className="text-sm text-muted-foreground">{offer.slot_type} slot</p>
                  </div>
                  <Badge variant={offer.status === "accepted" ? "default" : "secondary"}>
                    {offer.status}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
