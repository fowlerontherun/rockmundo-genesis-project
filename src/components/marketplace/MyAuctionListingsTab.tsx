import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, DollarSign, Clock, X, CheckCircle, Gavel } from "lucide-react";
import { useSongAuctions } from "@/hooks/useSongAuctions";
import { formatTimeRemaining } from "@/utils/songMarketplace";
import { cn } from "@/lib/utils";

interface MyAuctionListingsTabProps {
  userId: string;
}

export const MyAuctionListingsTab = ({ userId }: MyAuctionListingsTabProps) => {
  const { myListings, myListingsLoading, cancelListing, acceptBid } = useSongAuctions(userId);

  if (myListingsLoading) {
    return (
      <Card>
        <CardContent className="pt-6 text-center">
          <p className="text-muted-foreground">Loading your listings...</p>
        </CardContent>
      </Card>
    );
  }

  if (myListings.length === 0) {
    return (
      <Card>
        <CardContent className="pt-12 pb-12 text-center space-y-3">
          <FileText className="h-12 w-12 mx-auto text-muted-foreground" />
          <h3 className="font-semibold">No Listings Yet</h3>
          <p className="text-sm text-muted-foreground">
            List a song to start selling on the marketplace!
          </p>
        </CardContent>
      </Card>
    );
  }

  const active = myListings.filter(l => l.listing_status === "active");
  const completed = myListings.filter(l => l.listing_status !== "active");

  return (
    <div className="space-y-6">
      {/* Active Listings */}
      {active.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Gavel className="h-5 w-5" />
            Active Listings ({active.length})
          </h3>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {active.map((listing) => {
              const isAuction = listing.listing_type === "auction";
              const timeRemaining = listing.expires_at ? formatTimeRemaining(listing.expires_at) : null;
              const isExpired = timeRemaining === "Ended";
              const hasBids = listing.current_bid && listing.current_bid > 0;

              return (
                <Card key={listing.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg">{listing.songs?.title || "Untitled"}</CardTitle>
                        <p className="text-sm text-muted-foreground mt-1">{listing.songs?.genre}</p>
                      </div>
                      <Badge variant={isAuction ? "default" : "secondary"}>
                        {isAuction ? "Auction" : "Fixed"}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-2 text-sm">
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                      {isAuction ? (
                        <span>
                          {hasBids ? (
                            <>Current bid: <span className="font-semibold text-success">${listing.current_bid!.toLocaleString()}</span></>
                          ) : (
                            <>Starting: ${listing.asking_price.toLocaleString()} (no bids yet)</>
                          )}
                        </span>
                      ) : (
                        <span className="font-semibold">${listing.asking_price.toLocaleString()}</span>
                      )}
                    </div>

                    {timeRemaining && (
                      <div className={cn(
                        "flex items-center gap-2 text-sm",
                        isExpired ? "text-destructive" : "text-muted-foreground"
                      )}>
                        <Clock className="h-4 w-4" />
                        <span>{isExpired ? "Ended" : `${timeRemaining} remaining`}</span>
                      </div>
                    )}

                    <div className="flex gap-2">
                      {/* Accept highest bid button (auction with bids, ended) */}
                      {isAuction && hasBids && isExpired && (
                        <Button
                          size="sm"
                          className="flex-1"
                          onClick={() => acceptBid.mutate({ listingId: listing.id })}
                          disabled={acceptBid.isPending}
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Accept ${listing.current_bid!.toLocaleString()}
                        </Button>
                      )}

                      {/* Accept bid even while active */}
                      {isAuction && hasBids && !isExpired && (
                        <Button
                          variant="secondary"
                          size="sm"
                          className="flex-1"
                          onClick={() => {
                            if (!confirm(`Accept current bid of $${listing.current_bid!.toLocaleString()} and end the auction?`)) return;
                            acceptBid.mutate({ listingId: listing.id });
                          }}
                          disabled={acceptBid.isPending}
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Accept Bid
                        </Button>
                      )}

                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => {
                          if (!confirm("Cancel this listing?")) return;
                          cancelListing.mutate(listing.id);
                        }}
                        disabled={cancelListing.isPending}
                      >
                        <X className="h-4 w-4 mr-1" />
                        Cancel
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Past Listings */}
      {completed.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-muted-foreground">Past Listings ({completed.length})</h3>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {completed.map((listing) => (
              <Card key={listing.id} className="opacity-70">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{listing.songs?.title || "Untitled"}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <Badge variant={listing.listing_status === "sold" ? "default" : "outline"}>
                      {listing.listing_status === "sold" ? "Sold" : "Cancelled"}
                    </Badge>
                    {listing.listing_status === "sold" && listing.current_bid && (
                      <span className="text-sm font-medium text-success">${listing.current_bid.toLocaleString()}</span>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
