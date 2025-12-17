import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TrendingUp, Hash, Flame } from "lucide-react";
import { useTwaaterHashtags } from "@/hooks/useTwaaterHashtags";
import { useNavigate } from "react-router-dom";

export const TrendingHashtags = () => {
  const { trending, isLoading } = useTwaaterHashtags();
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Trending
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-6 bg-muted rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!trending.length) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Trending
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No trending hashtags yet</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <TrendingUp className="h-4 w-4" />
          Trending Now
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        {trending.slice(0, 5).map((hashtag, index) => (
          <Button
            key={hashtag.tag}
            variant="ghost"
            className="w-full justify-start h-auto py-2 px-2"
            onClick={() => navigate(`/twaater/tag/${hashtag.tag}`)}
          >
            <div className="flex items-center gap-2 w-full">
              <span className="text-muted-foreground text-xs w-4">{index + 1}</span>
              <div className="flex-1 text-left">
                <div className="flex items-center gap-1">
                  <Hash className="h-3 w-3 text-[hsl(var(--twaater-purple))]" />
                  <span className="font-medium">{hashtag.tag}</span>
                  {index === 0 && (
                    <Flame className="h-3 w-3 text-orange-500" />
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{hashtag.count} twaats</p>
              </div>
            </div>
          </Button>
        ))}
        
        {trending.length > 5 && (
          <Button
            variant="link"
            size="sm"
            className="w-full text-[hsl(var(--twaater-purple))]"
            onClick={() => navigate("/twaater/trending")}
          >
            Show more
          </Button>
        )}
      </CardContent>
    </Card>
  );
};
