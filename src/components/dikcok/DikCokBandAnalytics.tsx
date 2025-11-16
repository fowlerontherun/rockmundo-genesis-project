import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, Users, Eye, Award } from "lucide-react";

interface DikCokBandAnalyticsProps {
  band: {
    id: string;
    name: string;
    fame?: number;
    weekly_fans?: number;
  };
  videos?: any[];
}

export const DikCokBandAnalytics = ({ band, videos = [] }: DikCokBandAnalyticsProps) => {
  const totalViews = videos.reduce((sum, v) => sum + (v.views || 0), 0);
  const totalHype = videos.reduce((sum, v) => sum + (v.hype_gained || 0), 0);
  const totalFans = videos.reduce((sum, v) => sum + (v.fan_gain || 0), 0);
  const avgEngagement = videos.length > 0 ? Math.round(totalViews / videos.length) : 0;

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Total Videos</CardTitle>
          <Award className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{videos.length}</div>
          <p className="text-xs text-muted-foreground">Created on DikCok</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Total Views</CardTitle>
          <Eye className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{totalViews.toLocaleString()}</div>
          <p className="text-xs text-muted-foreground">
            ~{avgEngagement.toLocaleString()} avg per video
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Hype Generated</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{totalHype.toLocaleString()}</div>
          <p className="text-xs text-muted-foreground">From DikCok videos</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Fans Gained</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">+{totalFans.toLocaleString()}</div>
          <p className="text-xs text-muted-foreground">Via video engagement</p>
        </CardContent>
      </Card>
    </div>
  );
};
