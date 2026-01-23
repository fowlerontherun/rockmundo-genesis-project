import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { TrendingDown, DollarSign, Users, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface TicketPriceAdjusterProps {
  gigId: string;
  currentPrice: number;
  ticketsSold: number;
  predictedSales: number;
  onPriceAdjusted?: () => void;
}

export function TicketPriceAdjuster({
  gigId,
  currentPrice,
  ticketsSold,
  predictedSales,
  onPriceAdjusted,
}: TicketPriceAdjusterProps) {
  const { toast } = useToast();
  const [reductionPercent, setReductionPercent] = useState(10);
  const [isUpdating, setIsUpdating] = useState(false);

  const maxReduction = 30; // Maximum 30% reduction
  const newPrice = Math.round(currentPrice * (1 - reductionPercent / 100));
  const priceReduction = currentPrice - newPrice;

  // Estimate impact of price reduction
  const salesBoostMultiplier = 1 + (reductionPercent / 100) * 1.5; // Up to 45% more sales at 30% reduction
  const estimatedNewSales = Math.round((predictedSales - ticketsSold) * salesBoostMultiplier);
  const estimatedTotalAttendance = ticketsSold + estimatedNewSales;

  // Revenue comparison
  const currentProjectedRevenue = predictedSales * currentPrice;
  const newProjectedRevenue = ticketsSold * currentPrice + estimatedNewSales * newPrice;
  const revenueDifference = newProjectedRevenue - (ticketsSold * currentPrice + (predictedSales - ticketsSold) * currentPrice);

  const handleApplyReduction = async () => {
    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from('gigs')
        .update({
          original_ticket_price: currentPrice,
          ticket_price: newPrice,
          price_adjusted_at: new Date().toISOString(),
        })
        .eq('id', gigId);

      if (error) throw error;

      toast({
        title: "Price Reduced",
        description: `Ticket price reduced from $${currentPrice} to $${newPrice}`,
      });

      onPriceAdjusted?.();
    } catch (e) {
      console.error('Error adjusting price:', e);
      toast({
        title: "Error",
        description: "Failed to adjust ticket price",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <Card className="border-warning/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <TrendingDown className="h-4 w-4 text-warning" />
          Adjust Ticket Price
        </CardTitle>
        <CardDescription>
          Sales are below 50% of predicted. Consider reducing prices to boost attendance.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert variant="default" className="bg-warning/10 border-warning/30">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Only {ticketsSold} of {predictedSales} predicted tickets sold. A price reduction may help fill seats.
          </AlertDescription>
        </Alert>

        <div className="space-y-2">
          <div className="flex justify-between items-center text-sm">
            <span>Reduction: {reductionPercent}%</span>
            <Badge variant="outline">
              ${currentPrice} → ${newPrice}
            </Badge>
          </div>
          <Slider
            value={[reductionPercent]}
            onValueChange={([val]) => setReductionPercent(val)}
            min={5}
            max={maxReduction}
            step={5}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>5% off</span>
            <span>30% off</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="p-2 rounded-md bg-muted/50">
            <div className="flex items-center gap-1 text-muted-foreground mb-1">
              <Users className="h-3 w-3" />
              <span className="text-xs">Est. Attendance</span>
            </div>
            <span className="font-semibold text-green-600">
              +{estimatedNewSales} more
            </span>
          </div>
          <div className="p-2 rounded-md bg-muted/50">
            <div className="flex items-center gap-1 text-muted-foreground mb-1">
              <DollarSign className="h-3 w-3" />
              <span className="text-xs">Revenue Impact</span>
            </div>
            <span className={`font-semibold ${revenueDifference >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {revenueDifference >= 0 ? '+' : ''}{revenueDifference}
            </span>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          Note: More attendees means more potential fans and merchandise sales, even if ticket revenue decreases.
        </p>

        <Button 
          onClick={handleApplyReduction} 
          disabled={isUpdating}
          className="w-full"
          variant="default"
        >
          {isUpdating ? "Updating..." : `Reduce to $${newPrice}`}
        </Button>
      </CardContent>
    </Card>
  );
}
