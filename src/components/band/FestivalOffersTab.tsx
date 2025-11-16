import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, DollarSign, CheckCircle, XCircle, Music } from "lucide-react";
import { useFestivalSlotOffers } from "@/hooks/useFestivalSlotOffers";

interface FestivalOffersTabProps {
  bandId: string;
}

export const FestivalOffersTab = ({ bandId }: FestivalOffersTabProps) => {
  const { offers, isLoading, respondToOffer, isResponding } = useFestivalSlotOffers(bandId);

  const pendingOffers = offers?.filter(o => o.status === "pending");
  const respondedOffers = offers?.filter(o => o.status !== "pending");

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">Loading offers...</div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Pending Festival Offers</CardTitle>
          <CardDescription>Review and respond to festival slot offers</CardDescription>
        </CardHeader>
        <CardContent>
          {pendingOffers && pendingOffers.length > 0 ? (
            <div className="space-y-4">
              {pendingOffers.map((offer) => (
                <Card key={offer.id} className="border-2 border-primary/20">
                  <CardContent className="pt-6">
                    <div className="space-y-4">
                      <div>
                        <h3 className="text-xl font-bold">{offer.festival?.name}</h3>
                        <p className="text-sm text-muted-foreground">
                          {offer.festival?.city?.name}
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="flex items-center gap-2 text-sm">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span>{new Date(offer.slot_date).toLocaleDateString()}</span>
                        </div>
                        {offer.slot_time && (
                          <div className="flex items-center gap-2 text-sm">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            <span>{offer.slot_time}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-2 text-sm">
                          <DollarSign className="h-4 w-4 text-muted-foreground" />
                          <span className="font-semibold">${offer.guaranteed_payment.toLocaleString()}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge>{offer.slot_type}</Badge>
                        </div>
                      </div>

                      {offer.message && (
                        <div className="p-3 bg-muted rounded-lg">
                          <p className="text-sm">{offer.message}</p>
                        </div>
                      )}

                      {offer.additional_perks && offer.additional_perks.length > 0 && (
                        <div>
                          <p className="text-sm font-semibold mb-2">Additional Perks:</p>
                          <div className="flex flex-wrap gap-2">
                            {offer.additional_perks.map((perk, i) => (
                              <Badge key={i} variant="outline">{perk}</Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      {offer.expires_at && (
                        <p className="text-xs text-muted-foreground">
                          Expires: {new Date(offer.expires_at).toLocaleDateString()}
                        </p>
                      )}

                      <div className="flex gap-2 pt-2">
                        <Button
                          className="flex-1"
                          onClick={() => respondToOffer({ offerId: offer.id, status: "accepted" })}
                          disabled={isResponding}
                        >
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Accept Offer
                        </Button>
                        <Button
                          className="flex-1"
                          variant="outline"
                          onClick={() => respondToOffer({ offerId: offer.id, status: "rejected" })}
                          disabled={isResponding}
                        >
                          <XCircle className="h-4 w-4 mr-2" />
                          Decline
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Music className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No pending festival offers</p>
              <p className="text-sm text-muted-foreground mt-1">
                Keep building your reputation to receive festival invitations
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {respondedOffers && respondedOffers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Past Offers</CardTitle>
            <CardDescription>Previously responded to offers</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {respondedOffers.map((offer) => (
                <div key={offer.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-semibold">{offer.festival?.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(offer.slot_date).toLocaleDateString()}
                    </p>
                  </div>
                  <Badge variant={offer.status === "accepted" ? "default" : offer.status === "rejected" ? "destructive" : "secondary"}>
                    {offer.status}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
