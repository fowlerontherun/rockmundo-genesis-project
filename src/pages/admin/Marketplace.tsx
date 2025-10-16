import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp } from "lucide-react";

const AdminMarketplace = () => {
  const { data: listings, isLoading } = useQuery({
    queryKey: ["admin-marketplace-listings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("marketplace_listings")
        .select(`
          *,
          songs (
            title,
            genre,
            quality_score
          )
        `)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center gap-3">
        <TrendingUp className="h-10 w-10 text-primary" />
        <div>
          <h1 className="text-4xl font-bold">Marketplace Administration</h1>
          <p className="text-muted-foreground">
            Moderate listings and manage marketplace settings
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-8">Loading listings...</div>
      ) : listings && listings.length > 0 ? (
        <div className="grid gap-4">
          {listings.map((listing: any) => (
            <Card key={listing.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">
                    {listing.songs?.title || "Unknown Song"}
                  </CardTitle>
                  <Badge
                    variant={
                      listing.listing_status === "active"
                        ? "default"
                        : "secondary"
                    }
                  >
                    {listing.listing_status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Type:</span>
                    <div className="font-medium">{listing.listing_type}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Price:</span>
                    <div className="font-medium">${listing.asking_price}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Royalty:</span>
                    <div className="font-medium">{listing.royalty_percentage}%</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Created:</span>
                    <div className="font-medium">
                      {new Date(listing.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">
            No marketplace listings yet
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AdminMarketplace;
