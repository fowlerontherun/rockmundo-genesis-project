import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Eye, DollarSign, TrendingUp, Clock, Calendar, Film } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface VideoAnalyticsProps {
  video: {
    id: string;
    title: string;
    views_count: number;
    earnings: number;
    hype_score: number;
    production_quality: number;
    budget: number;
    status: string;
    release_date: string | null;
    created_at: string;
  };
}

export function VideoAnalytics({ video }: VideoAnalyticsProps) {
  const isReleased = video.status === "released";
  const roi = video.earnings > 0 ? ((video.earnings / video.budget) * 100).toFixed(1) : "0";
  const cpm = video.views_count > 0 ? ((video.earnings / video.views_count) * 1000).toFixed(2) : "0";
  
  // Estimated daily views based on hype score
  const estimatedDailyViews = Math.floor((video.hype_score / 100) * 5000 + Math.random() * 1000);
  
  // Days since release
  const daysSinceRelease = video.release_date 
    ? Math.floor((Date.now() - new Date(video.release_date).getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Views</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{video.views_count.toLocaleString()}</div>
            {isReleased && (
              <p className="text-xs text-muted-foreground">
                ~{estimatedDailyViews.toLocaleString()}/day estimated
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Earnings</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${video.earnings.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              ${cpm} CPM (per 1K views)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Hype Score</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{video.hype_score}</div>
            <p className="text-xs text-muted-foreground">
              {video.hype_score >= 80 ? "Viral potential!" : video.hype_score >= 50 ? "Growing steadily" : "Building momentum"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">ROI</CardTitle>
            <Film className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${parseFloat(roi) >= 100 ? "text-emerald-500" : parseFloat(roi) >= 50 ? "text-amber-500" : ""}`}>
              {roi}%
            </div>
            <p className="text-xs text-muted-foreground">
              Budget: ${video.budget.toLocaleString()}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Video Details</CardTitle>
          <CardDescription>Performance metrics and timeline</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Production Quality</span>
                <Badge variant={video.production_quality >= 80 ? "default" : "secondary"}>
                  {video.production_quality}/100
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Status</span>
                <Badge variant={isReleased ? "default" : "outline"}>
                  {video.status}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Budget Tier</span>
                <span className="text-sm font-medium">
                  {video.budget >= 50000 ? "Deluxe" : video.budget >= 25000 ? "Premium" : video.budget >= 10000 ? "Professional" : "Standard"}
                </span>
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Created:</span>
                <span>{formatDistanceToNow(new Date(video.created_at), { addSuffix: true })}</span>
              </div>
              {video.release_date && (
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Released:</span>
                  <span>{formatDistanceToNow(new Date(video.release_date), { addSuffix: true })}</span>
                </div>
              )}
              {isReleased && (
                <div className="flex items-center gap-2 text-sm">
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Active for:</span>
                  <span>{daysSinceRelease} days</span>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
