import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DollarSign, Calendar, TrendingUp } from "lucide-react";
import { useMarketplace } from "@/hooks/useMarketplace";
import { format } from "date-fns";

interface RoyaltiesTabProps {
  userId: string;
}

export const RoyaltiesTab = ({ userId }: RoyaltiesTabProps) => {
  const { royalties, isLoading } = useMarketplace(userId);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6 text-center">
          <p className="text-muted-foreground">Loading your royalties...</p>
        </CardContent>
      </Card>
    );
  }

  if (royalties.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Royalty Earnings
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            You haven't earned any royalties yet. Sell songs with royalty agreements to start earning!
          </p>
        </CardContent>
      </Card>
    );
  }

  const totalEarned = royalties.reduce((sum: number, payment: any) => 
    sum + (payment.amount || 0), 0
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Royalty Earnings
          </CardTitle>
          <div className="flex items-center gap-2 mt-2">
            <TrendingUp className="h-5 w-5 text-success" />
            <span className="text-2xl font-bold">${totalEarned.toLocaleString()}</span>
            <span className="text-sm text-muted-foreground">Total Earned</span>
          </div>
        </CardHeader>
      </Card>

      <div className="space-y-2">
        {royalties.map((payment: any) => {
          const songTitle = payment.transaction?.listing?.song?.title || "Unknown Song";
          return (
            <Card key={payment.id}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="font-medium">{songTitle}</div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(payment.payment_date), "MMM d, yyyy")}
                      </span>
                      <Badge variant="secondary" className="text-xs">
                        {payment.royalty_type || "streaming"}
                      </Badge>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-success">
                      +${payment.amount?.toLocaleString()}
                    </div>
                    {payment.streams_count && (
                      <div className="text-xs text-muted-foreground">
                        {payment.streams_count.toLocaleString()} streams
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};
