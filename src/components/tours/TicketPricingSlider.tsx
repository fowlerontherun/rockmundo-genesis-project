import { useMemo } from 'react';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DollarSign, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TicketPricingSliderProps {
  value: number | null;
  onChange: (price: number) => void;
  recommendedPrice: number;
  bandFame: number;
  averageCapacity: number;
}

export function TicketPricingSlider({
  value,
  onChange,
  recommendedPrice,
  bandFame,
  averageCapacity,
}: TicketPricingSliderProps) {
  const currentPrice = value || recommendedPrice;
  
  // Calculate min/max based on fame
  const minPrice = Math.max(5, Math.floor(recommendedPrice * 0.5));
  const maxPrice = Math.ceil(recommendedPrice * 2.5);
  
  // Calculate estimated sales modifier based on price
  const priceRatio = currentPrice / recommendedPrice;
  const salesModifier = useMemo(() => {
    if (priceRatio <= 0.7) return 1.2; // 20% more sales at lower price
    if (priceRatio <= 0.9) return 1.1;
    if (priceRatio <= 1.1) return 1.0;
    if (priceRatio <= 1.3) return 0.9;
    if (priceRatio <= 1.5) return 0.75;
    return 0.5; // 50% fewer sales at very high prices
  }, [priceRatio]);
  
  const estimatedAttendance = Math.round(averageCapacity * 0.7 * salesModifier);
  const estimatedRevenue = estimatedAttendance * currentPrice;
  
  const getPriceWarning = () => {
    if (priceRatio < 0.7) return { type: 'low', message: 'Price is low - leaving money on the table!' };
    if (priceRatio > 1.5) return { type: 'high', message: 'Price is very high - expect lower attendance' };
    if (priceRatio > 1.3) return { type: 'warn', message: 'Above market rate - may reduce ticket sales' };
    return null;
  };
  
  const warning = getPriceWarning();

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Ticket Price
          </Label>
          <Badge variant="outline" className="text-lg font-bold">
            ${currentPrice}
          </Badge>
        </div>
        
        <Slider
          value={[currentPrice]}
          onValueChange={([v]) => onChange(v)}
          min={minPrice}
          max={maxPrice}
          step={1}
          className="mt-4"
        />
        
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>${minPrice}</span>
          <span className="text-primary">Recommended: ${recommendedPrice}</span>
          <span>${maxPrice}</span>
        </div>
      </div>
      
      {warning && (
        <div className={cn(
          "flex items-center gap-2 p-3 rounded-lg text-sm",
          warning.type === 'low' && "bg-amber-500/10 text-amber-600",
          warning.type === 'warn' && "bg-orange-500/10 text-orange-600",
          warning.type === 'high' && "bg-destructive/10 text-destructive"
        )}>
          <AlertTriangle className="h-4 w-4" />
          {warning.message}
        </div>
      )}
      
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              {salesModifier >= 1 ? (
                <TrendingUp className="h-4 w-4 text-green-500" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-500" />
              )}
              <span className="text-sm text-muted-foreground">Est. Attendance</span>
            </div>
            <p className="text-2xl font-bold">{estimatedAttendance.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">
              {Math.round(salesModifier * 100)}% of baseline
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="h-4 w-4 text-green-500" />
              <span className="text-sm text-muted-foreground">Est. Revenue/Show</span>
            </div>
            <p className="text-2xl font-bold text-green-600">
              ${estimatedRevenue.toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground">
              Before fees & splits
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
