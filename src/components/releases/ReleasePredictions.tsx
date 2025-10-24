import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, DollarSign, Headphones, ShoppingCart } from "lucide-react";
import { predictReleaseSales } from "@/utils/releasePredictions";
import { Separator } from "@/components/ui/separator";

interface ReleasePredictionsProps {
  artistFame: number;
  artistPopularity: number;
  songQuality: number;
  bandChemistry?: number;
  releaseType: 'single' | 'ep' | 'album';
  formatTypes: string[];
  trackCount: number;
}

export function ReleasePredictions({
  artistFame,
  artistPopularity,
  songQuality,
  bandChemistry,
  releaseType,
  formatTypes,
  trackCount,
}: ReleasePredictionsProps) {
  const predictions = predictReleaseSales({
    artistFame,
    artistPopularity,
    songQuality,
    bandChemistry,
    releaseType,
    formatTypes,
    trackCount,
  });

  return (
    <Card className="bg-muted/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <TrendingUp className="h-5 w-5" />
          Conservative Projections
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground flex items-center gap-2">
              <Headphones className="h-4 w-4" />
              Weekly Streams
            </span>
            <Badge variant="outline">
              {predictions.predictedStreams.weekly.toLocaleString()}
            </Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground flex items-center gap-2">
              <Headphones className="h-4 w-4" />
              First Year Streams
            </span>
            <Badge variant="secondary">
              {predictions.predictedStreams.firstYear.toLocaleString()}
            </Badge>
          </div>
        </div>

        <Separator />

        {(predictions.predictedSales.digital > 0 || predictions.predictedSales.physical > 0) && (
          <>
            <div className="space-y-3">
              {predictions.predictedSales.digital > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground flex items-center gap-2">
                    <ShoppingCart className="h-4 w-4" />
                    Digital Sales
                  </span>
                  <Badge variant="outline">
                    {predictions.predictedSales.digital.toLocaleString()} units
                  </Badge>
                </div>
              )}
              {predictions.predictedSales.physical > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground flex items-center gap-2">
                    <ShoppingCart className="h-4 w-4" />
                    Physical Sales
                  </span>
                  <Badge variant="outline">
                    {predictions.predictedSales.physical.toLocaleString()} units
                  </Badge>
                </div>
              )}
            </div>
            <Separator />
          </>
        )}

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Streaming Revenue (1yr)
            </span>
            <span className="font-semibold">
              ${predictions.predictedRevenue.streaming.toLocaleString()}
            </span>
          </div>
          {predictions.predictedRevenue.sales > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Sales Revenue (1yr)
              </span>
              <span className="font-semibold">
                ${predictions.predictedRevenue.sales.toLocaleString()}
              </span>
            </div>
          )}
          <Separator />
          <div className="flex items-center justify-between text-lg">
            <span className="font-semibold">Total Projected (1yr)</span>
            <span className="font-bold text-primary">
              ${predictions.predictedRevenue.total.toLocaleString()}
            </span>
          </div>
        </div>

        <p className="text-xs text-muted-foreground italic">
          * These are conservative estimates based on your current stats. Actual results may vary significantly.
        </p>
      </CardContent>
    </Card>
  );
}
