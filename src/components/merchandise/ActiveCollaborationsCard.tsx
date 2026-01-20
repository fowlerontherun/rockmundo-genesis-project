import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Crown, TrendingUp, DollarSign, Package } from "lucide-react";
import { useActiveCollaborations, BRAND_TIER_COLORS, BRAND_TIER_LABELS } from "@/hooks/useMerchCollaborations";
import { formatDistanceToNow } from "date-fns";

interface ActiveCollaborationsCardProps {
  bandId: string | null;
}

const formatCurrency = (value: number) => 
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);

export const ActiveCollaborationsCard = ({ bandId }: ActiveCollaborationsCardProps) => {
  const { data: collaborations, isLoading } = useActiveCollaborations(bandId);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Crown className="h-5 w-5" />
            Active Partnerships
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!collaborations || collaborations.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Crown className="h-5 w-5 text-yellow-500" />
          Active Partnerships
        </CardTitle>
        <CardDescription>
          Your current brand collaborations
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="max-h-[300px]">
          <div className="space-y-3">
            {collaborations.map((collab) => (
              <div 
                key={collab.id} 
                className="p-3 rounded-lg bg-muted/30 border border-muted"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded bg-gradient-to-br from-primary/20 to-primary/40 flex items-center justify-center">
                      <Crown className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <h4 className="font-medium text-sm">{collab.brand?.name || 'Brand Partner'}</h4>
                      <Badge 
                        variant="outline" 
                        className={`text-xs ${BRAND_TIER_COLORS[collab.brand?.brand_tier || 'indie']}`}
                      >
                        {BRAND_TIER_LABELS[collab.brand?.brand_tier || 'indie']}
                      </Badge>
                    </div>
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    {formatDistanceToNow(new Date(collab.started_at), { addSuffix: false })}
                  </Badge>
                </div>

                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="flex items-center gap-1">
                    <Package className="h-3 w-3 text-muted-foreground" />
                    <span className="capitalize">{collab.product_type}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <TrendingUp className="h-3 w-3 text-green-500" />
                    <span>+{collab.sales_boost_pct}% boost</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <DollarSign className="h-3 w-3 text-yellow-500" />
                    <span>{formatCurrency(collab.total_royalties_earned)}</span>
                  </div>
                </div>

                {collab.total_units_sold > 0 && (
                  <div className="mt-2 pt-2 border-t border-muted text-xs text-muted-foreground">
                    {collab.total_units_sold.toLocaleString()} co-branded items sold
                  </div>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
