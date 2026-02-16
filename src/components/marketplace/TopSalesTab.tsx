import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DollarSign, Trophy, Music } from "lucide-react";
import { format } from "date-fns";

export function TopSalesTab() {
  const { data: topSales = [], isLoading } = useQuery({
    queryKey: ["marketplace-top-sales"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("marketplace_transactions")
        .select(`
          id,
          sale_price,
          completed_at,
          created_at,
          song_id,
          buyer_user_id,
          seller_user_id,
          songs!marketplace_transactions_song_id_fkey (
            title,
            band_id,
            bands ( name, artist_name )
          )
        `)
        .eq("transaction_status", "completed")
        .order("sale_price", { ascending: false })
        .limit(100);

      if (error) throw error;
      return data || [];
    },
  });

  if (isLoading) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Music className="h-8 w-8 mx-auto mb-2 animate-pulse" />
        <p>Loading top sales...</p>
      </div>
    );
  }

  if (topSales.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Trophy className="h-10 w-10 mx-auto mb-3 opacity-30" />
        <p className="font-medium">No completed sales yet</p>
        <p className="text-sm">Sales will appear here once transactions are completed.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground mb-4">
        Top 100 song sales ranked by price
      </p>
      {topSales.map((sale: any, index: number) => {
        const song = sale.songs;
        const bandName = song?.bands?.artist_name || song?.bands?.name || "Unknown";
        const isTop3 = index < 3;

        return (
          <Card key={sale.id} className={isTop3 ? "border-primary/30" : ""}>
            <CardContent className="flex items-center gap-3 py-3 px-4">
              <span className={`text-lg font-bold w-8 text-center ${
                index === 0 ? "text-yellow-400" :
                index === 1 ? "text-gray-300" :
                index === 2 ? "text-amber-600" :
                "text-muted-foreground"
              }`}>
                {index + 1}
              </span>

              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{song?.title || "Unknown Song"}</p>
                <p className="text-xs text-muted-foreground truncate">{bandName}</p>
              </div>

              <div className="text-right shrink-0">
                <Badge variant="outline" className="font-mono">
                  <DollarSign className="h-3 w-3 mr-0.5" />
                  {sale.sale_price.toLocaleString()}
                </Badge>
                {sale.completed_at && (
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {format(new Date(sale.completed_at), "MMM d, yyyy")}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
