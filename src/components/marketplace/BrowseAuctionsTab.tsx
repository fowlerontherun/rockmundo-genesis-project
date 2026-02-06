import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Music, DollarSign, Clock, Gavel, ShoppingCart, Users } from "lucide-react";
import { useSongAuctions } from "@/hooks/useSongAuctions";
import { formatTimeRemaining, calculateMinimumBid } from "@/utils/songMarketplace";
import { cn } from "@/lib/utils";

interface BrowseAuctionsTabProps {
  userId: string;
}

export const BrowseAuctionsTab = ({ userId }: BrowseAuctionsTabProps) => {
  const { activeListings, listingsLoading, placeBid, completeSale } = useSongAuctions(userId);
  const [bidDialogListing, setBidDialogListing] = useState<any>(null);
  const [bidAmount, setBidAmount] = useState(0);

  const handleOpenBid = (listing: any) => {
    const minBid = calculateMinimumBid(listing.current_bid, listing.asking_price);
    setBidAmount(minBid);
    setBidDialogListing(listing);
  };

  const handlePlaceBid = () => {
    if (!bidDialogListing) return;
    placeBid.mutate(
      { listingId: bidDialogListing.id, bidAmount },
      { onSuccess: () => setBidDialogListing(null) }
    );
  };

  const handleBuyNow = (listing: any) => {
    const price = listing.buyout_price || listing.asking_price;
    if (!confirm(`Buy "${listing.songs?.title}" for $${price.toLocaleString()}?`)) return;
    completeSale.mutate({ listingId: listing.id, salePrice: price });
  };

  if (listingsLoading) {
    return <div className="text-center py-8 text-muted-foreground">Loading marketplace...</div>;
  }

  if (activeListings.length === 0) {
    return (
      <Card>
        <CardContent className="pt-12 pb-12 text-center space-y-4">
          <Music className="h-16 w-16 mx-auto text-muted-foreground" />
          <div>
            <h3 className="font-semibold text-lg">No Songs for Sale</h3>
            <p className="text-sm text-muted-foreground mt-2">
              Check back later — artists list songs for auction regularly.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {activeListings.map((listing) => {
          const isAuction = listing.listing_type === "auction";
          const timeRemaining = listing.expires_at ? formatTimeRemaining(listing.expires_at) : null;
          const isExpired = timeRemaining === "Ended";
          const currentPrice = listing.current_bid || listing.asking_price;

          return (
            <Card key={listing.id} className="flex flex-col">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg truncate">
                      {listing.songs?.title || "Unknown Song"}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      {listing.songs?.genre}
                    </p>
                  </div>
                  <Badge variant={isAuction ? "default" : "secondary"}>
                    {isAuction ? <><Gavel className="h-3 w-3 mr-1" />Auction</> : <><ShoppingCart className="h-3 w-3 mr-1" />Buy Now</>}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="flex-1 space-y-3">
                {/* Quality */}
                <Badge variant="outline" className="text-xs">
                  Quality: {listing.songs?.quality_score || 0}
                </Badge>

                {/* Price Display */}
                <div className="rounded-lg bg-primary/5 border border-primary/10 p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      {isAuction ? (listing.current_bid ? "Current Bid" : "Starting Bid") : "Price"}
                    </span>
                    <span className="text-2xl font-bold text-primary flex items-center">
                      <DollarSign className="h-5 w-5" />
                      {currentPrice.toLocaleString()}
                    </span>
                  </div>
                  {isAuction && listing.current_bidder_user_id && (
                    <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      Bidder active
                    </div>
                  )}
                </div>

                {/* Time Remaining */}
                {timeRemaining && (
                  <div className={cn(
                    "text-sm flex items-center gap-1.5",
                    isExpired ? "text-destructive" : "text-muted-foreground"
                  )}>
                    <Clock className="h-3.5 w-3.5" />
                    {isExpired ? "Auction ended" : `${timeRemaining} remaining`}
                  </div>
                )}

                {/* Description */}
                {listing.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">{listing.description}</p>
                )}

                {/* Actions */}
                <div className="flex gap-2 pt-2">
                  {isAuction && !isExpired && (
                    <Button className="flex-1" size="sm" onClick={() => handleOpenBid(listing)}>
                      <Gavel className="h-4 w-4 mr-1" />
                      Place Bid
                    </Button>
                  )}
                  {(!isAuction || (isAuction && listing.buyout_price && listing.buyout_price > 0)) && !isExpired && (
                    <Button
                      variant={isAuction ? "outline" : "default"}
                      className="flex-1"
                      size="sm"
                      onClick={() => handleBuyNow(listing)}
                      disabled={completeSale.isPending}
                    >
                      <ShoppingCart className="h-4 w-4 mr-1" />
                      Buy ${(listing.buyout_price || listing.asking_price).toLocaleString()}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Bid Dialog */}
      <Dialog open={!!bidDialogListing} onOpenChange={(open) => !open && setBidDialogListing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Place Bid on "{bidDialogListing?.songs?.title}"</DialogTitle>
            <DialogDescription>
              Current bid: ${(bidDialogListing?.current_bid || bidDialogListing?.asking_price || 0).toLocaleString()}.
              Minimum increment: 5% or $100.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Your Bid</label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="number"
                  value={bidAmount}
                  onChange={(e) => setBidAmount(Math.max(0, parseInt(e.target.value) || 0))}
                  className="pl-9"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Minimum bid: ${calculateMinimumBid(bidDialogListing?.current_bid, bidDialogListing?.asking_price || 0).toLocaleString()}
              </p>
            </div>

            <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3 text-sm">
              <p className="font-medium text-amber-700">⚠ Bidding is a commitment</p>
              <p className="text-xs text-muted-foreground mt-1">
                If you win, the amount will be deducted from your cash balance. Anti-sniping: bids in the last 5 minutes extend the auction.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setBidDialogListing(null)}>Cancel</Button>
            <Button onClick={handlePlaceBid} disabled={placeBid.isPending}>
              {placeBid.isPending ? "Placing..." : `Bid $${bidAmount.toLocaleString()}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
