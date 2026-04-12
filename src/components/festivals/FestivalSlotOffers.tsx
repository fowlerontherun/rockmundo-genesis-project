import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useFestivalSlotOffers } from "@/hooks/useFestivalSlotOffers";
import { useFestivalNegotiation } from "@/hooks/useFestivalNegotiation";
import { FestivalContractNegotiationDialog, type NegotiatedTerms } from "./FestivalContractNegotiationDialog";
import { Calendar, Music, Clock, Check, X, Handshake, Star, TrendingUp } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface FestivalSlotOffersProps {
  bandId: string;
}

export const FestivalSlotOffers = ({ bandId }: FestivalSlotOffersProps) => {
  const { offers, isLoading, respondToOffer, isResponding } = useFestivalSlotOffers(bandId);
  const { negotiate, isNegotiating, negotiations } = useFestivalNegotiation(bandId);
  const [negotiatingOffer, setNegotiatingOffer] = useState<any | null>(null);

  if (isLoading) {
    return <div className="text-muted-foreground">Loading offers...</div>;
  }

  const pendingOffers = offers?.filter((o) => o.status === "pending") || [];
  const respondedOffers = offers?.filter((o) => o.status !== "pending") || [];

  const getOfferNegotiations = (offerId: string) =>
    negotiations?.filter((n: any) => n.offer_id === offerId) || [];

  const handleNegotiate = (terms: NegotiatedTerms) => {
    negotiate({ ...terms, bandId });
    setNegotiatingOffer(null);
  };

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
          {pendingOffers.map((offer) => {
            const offerNegotiations = getOfferNegotiations(offer.id);
            const hasNegotiated = offerNegotiations.length > 0;
            const lastNegotiation = offerNegotiations[0];

            return (
              <Card key={offer.id} className="border-primary/50">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{offer.festival?.title}</CardTitle>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                        <Music className="h-4 w-4" />
                        <span>{offer.slot_type} slot</span>
                        {offer.slot_type === "headliner" && (
                          <Badge className="bg-amber-500/20 text-amber-500 border-amber-500/30 text-xs">
                            <Star className="h-3 w-3 mr-1" />
                            Premium
                          </Badge>
                        )}
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
                      <span>{offer.slot_time || "TBD"}</span>
                    </div>
                  </div>

                  {offer.guaranteed_payment > 0 && (
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <span className="text-sm text-muted-foreground">Offered Payment:</span>
                      <span className="ml-2 font-semibold text-primary">
                        ${Number(offer.guaranteed_payment).toLocaleString()}
                      </span>
                    </div>
                  )}

                  {offer.message && (
                    <p className="text-sm text-muted-foreground italic">"{offer.message}"</p>
                  )}

                  {/* Negotiation history */}
                  {hasNegotiated && (
                    <div className="p-3 border rounded-lg space-y-2">
                      <p className="text-xs font-medium flex items-center gap-1">
                        <Handshake className="h-3.5 w-3.5" />
                        Negotiation History
                      </p>
                      {offerNegotiations.map((neg: any) => (
                        <div
                          key={neg.id}
                          className={cn(
                            "p-2 rounded text-xs",
                            neg.status === "accepted" && "bg-green-500/10 text-green-600",
                            neg.status === "rejected" && "bg-red-500/10 text-red-500",
                            neg.status === "pending" && "bg-yellow-500/10 text-yellow-600"
                          )}
                        >
                          <div className="flex justify-between items-center">
                            <span>Counter: ${Number(neg.counter_payment).toLocaleString()}</span>
                            <Badge
                              variant="secondary"
                              className={cn(
                                "text-xs",
                                neg.status === "accepted" && "bg-green-500/20",
                                neg.status === "rejected" && "bg-red-500/20"
                              )}
                            >
                              {neg.status}
                            </Badge>
                          </div>
                          {neg.admin_response_note && (
                            <p className="mt-1 italic">{neg.admin_response_note}</p>
                          )}
                        </div>
                      ))}
                    </div>
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
                      variant="secondary"
                      onClick={() => setNegotiatingOffer(offer)}
                      disabled={isNegotiating}
                      className="flex-1"
                    >
                      <Handshake className="h-4 w-4 mr-2" />
                      Negotiate
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => respondToOffer({ offerId: offer.id, status: "rejected" })}
                      disabled={isResponding}
                      size="icon"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
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
                    <p className="font-medium">{offer.festival?.title}</p>
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

      {/* Negotiation Dialog */}
      {negotiatingOffer && (
        <FestivalContractNegotiationDialog
          open={!!negotiatingOffer}
          onOpenChange={(open) => !open && setNegotiatingOffer(null)}
          offerId={negotiatingOffer.id}
          festivalName={negotiatingOffer.festival?.title || "Festival"}
          slotType={negotiatingOffer.slot_type}
          basePayment={Number(negotiatingOffer.guaranteed_payment) || 1000}
          onNegotiate={handleNegotiate}
          isSubmitting={isNegotiating}
        />
      )}
    </div>
  );
};
