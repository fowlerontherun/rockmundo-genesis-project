import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Music, DollarSign, TrendingUp, Clock } from "lucide-react";

interface BrowseListingsTabProps {
  userId: string;
}

export const BrowseListingsTab = ({ userId }: BrowseListingsTabProps) => {
  const { data: listings, isLoading } = useQuery({
    queryKey: ["marketplace-listings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("marketplace_listings")
        .select(`
          *,
          songs (
            title,
            genre,
            quality_score,
            duration_display
          )
        `)
        .eq("listing_status", "active")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  if (isLoading) {
    return <div className="text-center py-8">Loading listings...</div>;
  }

  if (!listings || listings.length === 0) {
    return (
      <Card>
        <CardContent className="pt-12 pb-12 text-center space-y-4">
          <Music className="h-16 w-16 mx-auto text-muted-foreground" />
          <div>
            <h3 className="font-semibold text-lg">No Listings Available</h3>
            <p className="text-sm text-muted-foreground mt-2">
              Check back later for songs to purchase
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
      {listings.map((listing: any) => (
        <Card key={listing.id}>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <CardTitle className="text-lg truncate">
                  {listing.songs?.title || "Unknown Song"}
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  {listing.songs?.genre}
                </p>
              </div>
              <Music className="h-5 w-5 text-muted-foreground flex-shrink-0" />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Badge className="mr-2">
                Quality: {listing.songs?.quality_score || 0}
              </Badge>
              <Badge variant="outline">
                {listing.listing_type === "fixed_price" ? "Fixed Price" :
                 listing.listing_type === "auction" ? "Auction" : "Negotiable"}
              </Badge>
            </div>

            <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">
                  {listing.listing_type === "auction" ? "Current Bid" : "Price"}
                </span>
                <span className="text-2xl font-bold text-primary flex items-center">
                  <DollarSign className="h-5 w-5" />
                  {(listing.current_bid || listing.asking_price).toLocaleString()}
                </span>
              </div>
              {listing.royalty_percentage > 0 && (
                <div className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" />
                  Seller keeps {listing.royalty_percentage}% royalties
                </div>
              )}
            </div>

            {listing.expires_at && (
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Ends {new Date(listing.expires_at).toLocaleDateString()}
              </div>
            )}

            {listing.description && (
              <p className="text-sm text-muted-foreground line-clamp-2">
                {listing.description}
              </p>
            )}

            <div className="flex gap-2">
              <Button className="flex-1" size="sm">
                {listing.listing_type === "auction" ? "Place Bid" : "Buy Now"}
              </Button>
              <Button variant="outline" size="sm">
                Details
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
