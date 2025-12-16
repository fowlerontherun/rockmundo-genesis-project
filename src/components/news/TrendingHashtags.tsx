import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Hash, TrendingUp } from "lucide-react";

export function TrendingHashtags() {
  const { data: trending } = useQuery({
    queryKey: ["trending-hashtags"],
    queryFn: async () => {
      // Get recent twaats and extract hashtags
      const { data: twaats } = await supabase
        .from("twaats")
        .select("body, created_at")
        .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order("created_at", { ascending: false })
        .limit(500);

      if (!twaats) return [];

      // Extract and count hashtags
      const hashtagCounts: Record<string, number> = {};
      twaats.forEach((twaat) => {
        const matches = twaat.body.match(/#(\w+)/g);
        if (matches) {
          matches.forEach((tag) => {
            const normalized = tag.toLowerCase();
            hashtagCounts[normalized] = (hashtagCounts[normalized] || 0) + 1;
          });
        }
      });

      // Sort by count and return top 5
      return Object.entries(hashtagCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([tag, count]) => ({ tag, count }));
    },
    staleTime: 5 * 60 * 1000,
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <TrendingUp className="h-5 w-5" />
          Trending on Twaater
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {trending && trending.length > 0 ? (
          trending.map((item, index) => (
            <div key={item.tag} className="flex items-center justify-between py-1">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground text-sm">#{index + 1}</span>
                <Hash className="h-4 w-4 text-primary" />
                <span className="font-medium">{item.tag.replace('#', '')}</span>
              </div>
              <Badge variant="secondary">{item.count} posts</Badge>
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground py-2">No trending topics today</p>
        )}
      </CardContent>
    </Card>
  );
}
