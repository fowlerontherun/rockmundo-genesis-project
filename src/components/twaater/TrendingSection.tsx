import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Hash } from "lucide-react";
import { useTwaaterTrending } from "@/hooks/useTwaaterTrending";
import { TwaatCard } from "./TwaatCard";

interface TrendingSectionProps {
  viewerAccountId?: string;
}

export const TrendingSection = ({ viewerAccountId }: TrendingSectionProps) => {
  const { trendingTwaats, trendingTopics, isLoading } = useTwaaterTrending();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-muted-foreground">Loading trending content...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Trending Topics */}
      {trendingTopics.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Hash className="h-5 w-5" />
              Trending Topics
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {trendingTopics.map((topic, index) => (
              <div
                key={topic.tag}
                className="flex items-center justify-between p-2 rounded-lg hover:bg-accent transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">
                    #{index + 1}
                  </Badge>
                  <span className="font-medium">{topic.tag}</span>
                </div>
                <span className="text-sm text-muted-foreground">
                  {topic.count} {topic.count === 1 ? "twaat" : "twaats"}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Trending Twaats */}
      {trendingTwaats.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Trending Twaats
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-0 p-0">
            {trendingTwaats.slice(0, 10).map((twaat: any) => (
              <TwaatCard
                key={twaat.id}
                twaat={twaat}
                viewerAccountId={viewerAccountId}
              />
            ))}
          </CardContent>
        </Card>
      )}

      {trendingTwaats.length === 0 && trendingTopics.length === 0 && (
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-muted-foreground">
              No trending content yet. Start posting to see what's hot!
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
