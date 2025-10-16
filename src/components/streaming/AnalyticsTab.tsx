import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3 } from "lucide-react";

interface AnalyticsTabProps {
  userId: string;
}

export const AnalyticsTab = ({ userId }: AnalyticsTabProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          Analytics Dashboard
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">
          Analytics features coming soon. Release songs to start tracking performance.
        </p>
      </CardContent>
    </Card>
  );
};
