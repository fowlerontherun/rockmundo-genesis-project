import { Construction, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Props {
  area?: string;
}

export function FestivalRebuildingScreen({ area }: Props) {
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <Card className="max-w-lg w-full">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 h-12 w-12 rounded-full bg-orange-500/10 text-orange-500 flex items-center justify-center">
            <Construction className="h-6 w-6" />
          </div>
          <CardTitle>Festivals are being rebuilt</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground text-center">
          <p>
            The festival system{area ? ` (${area})` : ""} is being replaced
            with a new VIP-owned festival-company experience. Existing routes
            are temporarily unavailable while the new implementation lands
            behind a safe boundary.
          </p>
          <p>
            Ordinary gigs, band management, companies and world navigation
            continue to work as normal.
          </p>
          <div className="flex justify-center pt-2">
            <Button asChild variant="secondary">
              <Link to="/">
                <ArrowLeft className="h-4 w-4 mr-1" /> Back to dashboard
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default FestivalRebuildingScreen;
