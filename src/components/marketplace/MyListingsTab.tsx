import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, DollarSign, Calendar, X } from "lucide-react";
import { useMarketplace } from "@/hooks/useMarketplace";
import { formatTimeRemaining } from "@/utils/songMarketplace";

interface MyListingsTabProps {
  userId: string;
}

export const MyListingsTab = ({ userId }: MyListingsTabProps) => {
  const { myListings, isLoading, cancelListing, isCancellingListing } = useMarketplace(userId);

  if (isLoading) {
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
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            My Listings
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            You haven't listed any songs yet. Create a song in the Songwriting page to get started!
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            My Listings ({myListings.length})
          </CardTitle>
        </CardHeader>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {myListings.map((listing: any) => (
          <Card key={listing.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-lg">{listing.song?.title || "Untitled"}</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    {listing.song?.genre || "Unknown Genre"}
                  </p>
                </div>
                <Badge variant={listing.status === "active" ? "default" : "secondary"}>
                  {listing.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <span>
                  {listing.listing_type === "fixed_price" 
                    ? `$${listing.price?.toLocaleString()}` 
                    : `Starting: $${listing.starting_bid?.toLocaleString()}`}
                </span>
              </div>

              {listing.listing_type === "auction" && listing.auction_end_date && (
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span>{formatTimeRemaining(listing.auction_end_date)} remaining</span>
                </div>
              )}

              {listing.royalty_percentage && (
                <div className="text-sm">
                  <span className="text-muted-foreground">Royalties: </span>
                  <span className="font-medium">{listing.royalty_percentage}%</span>
                </div>
              )}

              {listing.status === "active" && (
                <Button
                  variant="destructive"
                  size="sm"
                  className="w-full"
                  onClick={() => cancelListing(listing.id)}
                  disabled={isCancellingListing}
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancel Listing
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};
