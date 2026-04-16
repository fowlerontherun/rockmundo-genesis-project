import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TrendingUp, Users, Music, ChevronRight } from "lucide-react";
import { PlatformLogo } from "./PlatformLogo";

interface EnhancedPlatformCardProps {
  platform: {
    id: string;
    platform_name: string;
    brand_color?: string;
    description?: string;
    total_users?: number;
    base_rate_per_stream?: number;
  };
  userStats?: {
    totalStreams: number;
    totalRevenue: number;
    releaseCount: number;
  };
}

export function EnhancedPlatformCard({ platform, userStats }: EnhancedPlatformCardProps) {
  const navigate = useNavigate();
  const brandColor = platform.brand_color || "#6366f1";

  const formatNumber = (num: number) => {
    if (num >= 1000000000) return `${(num / 1000000000).toFixed(1)}B`;
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(0)}K`;
    return num.toString();
  };

  return (
    <Card 
      className="overflow-hidden hover:shadow-lg transition-all cursor-pointer group"
      onClick={() => navigate(`/streaming/${platform.id}`)}
      style={{ borderColor: brandColor + "40" }}
    >
      <div 
        className="h-2"
        style={{ backgroundColor: brandColor }}
      />
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <PlatformLogo platformName={platform.platform_name} size="lg" />
            <div>
              <CardTitle className="text-lg">{platform.platform_name}</CardTitle>
              <CardDescription className="text-xs">
                {formatNumber(platform.total_users || 0)} users
              </CardDescription>
            </div>
          </div>
          <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:translate-x-1 transition-transform" />
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {platform.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">
            {platform.description}
          </p>
        )}

        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="p-2 rounded-lg bg-muted/50">
            <TrendingUp className="h-4 w-4 mx-auto mb-1 text-emerald-500" />
            <p className="text-sm font-bold">{formatNumber(userStats?.totalStreams || 0)}</p>
            <p className="text-xs text-muted-foreground">Streams</p>
          </div>
          <div className="p-2 rounded-lg bg-muted/50">
            <Music className="h-4 w-4 mx-auto mb-1 text-primary" />
            <p className="text-sm font-bold">{userStats?.releaseCount || 0}</p>
            <p className="text-xs text-muted-foreground">Releases</p>
          </div>
          <div className="p-2 rounded-lg bg-muted/50">
            <span className="text-sm font-bold block">${(userStats?.totalRevenue || 0).toFixed(0)}</span>
            <p className="text-xs text-muted-foreground mt-1">Revenue</p>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <Badge variant="outline" className="text-xs">
            ${((platform.base_rate_per_stream || 0.003) * 1000).toFixed(2)}/1K streams
          </Badge>
          <Button 
            size="sm" 
            variant="ghost"
            className="text-xs"
            style={{ color: brandColor }}
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/streaming/${platform.id}`);
            }}
          >
            View Details
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
