import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart, DollarSign, Calendar, Music } from "lucide-react";
import { useMarketplace } from "@/hooks/useMarketplace";
import { format } from "date-fns";

interface MyPurchasesTabProps {
  userId: string;
}

export const MyPurchasesTab = ({ userId }: MyPurchasesTabProps) => {
  const { myPurchases, isLoading } = useMarketplace(userId);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6 text-center">
          <p className="text-muted-foreground">Loading your purchases...</p>
        </CardContent>
      </Card>
    );
  }

  if (myPurchases.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            My Purchases
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            You haven't purchased any songs yet. Browse the marketplace to find your next hit!
          </p>
        </CardContent>
      </Card>
    );
  }

  const totalSpent = myPurchases.reduce((sum: number, purchase: any) => 
    sum + (purchase.final_price || 0), 0
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            My Purchases ({myPurchases.length})
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Total Spent: ${totalSpent.toLocaleString()}
          </p>
        </CardHeader>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {myPurchases.map((purchase: any) => {
          const song = purchase.listing?.song;
          return (
            <Card key={purchase.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg">{song?.title || "Unknown Song"}</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      {song?.genre || "Unknown Genre"}
                    </p>
                  </div>
                  <Badge variant="secondary">
                    <Music className="h-3 w-3 mr-1" />
                    Owned
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">${purchase.final_price?.toLocaleString()}</span>
                </div>

                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span>{format(new Date(purchase.transaction_date), "MMM d, yyyy")}</span>
                </div>

                {purchase.listing?.royalty_percentage && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">Paying Royalties: </span>
                    <span className="font-medium">{purchase.listing.royalty_percentage}%</span>
                  </div>
                )}

                <div className="pt-2 border-t">
                  <p className="text-xs text-muted-foreground">
                    {song?.mood} • {song?.tempo} BPM
                  </p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};
