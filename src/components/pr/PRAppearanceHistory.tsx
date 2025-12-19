import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tv,
  Radio,
  Mic2,
  Newspaper,
  BookOpen,
  Youtube,
  Film,
  Calendar,
  DollarSign,
  TrendingUp,
  Users,
  CheckCircle,
  Clock,
} from "lucide-react";
import { format, parseISO } from "date-fns";

interface PRAppearanceHistoryProps {
  bandId: string;
}

const mediaTypeConfig: Record<string, { icon: React.ElementType; label: string; color: string }> = {
  tv: { icon: Tv, label: "TV", color: "text-blue-500" },
  radio: { icon: Radio, label: "Radio", color: "text-amber-500" },
  podcast: { icon: Mic2, label: "Podcast", color: "text-purple-500" },
  newspaper: { icon: Newspaper, label: "Newspaper", color: "text-gray-500" },
  magazine: { icon: BookOpen, label: "Magazine", color: "text-pink-500" },
  youtube: { icon: Youtube, label: "YouTube", color: "text-red-500" },
  film: { icon: Film, label: "Film", color: "text-amber-600" },
};

export function PRAppearanceHistory({ bandId }: PRAppearanceHistoryProps) {
  const { data: appearances, isLoading } = useQuery({
    queryKey: ["pr-appearances", bandId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("media_appearances")
        .select("*")
        .eq("band_id", bandId)
        .order("air_date", { ascending: false })
        .limit(50);

      if (error) throw error;
      return data || [];
    },
    enabled: !!bandId,
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
    );
  }

  if (!appearances || appearances.length === 0) {
    return (
      <Card className="bg-card/50 backdrop-blur">
        <CardContent className="flex flex-col items-center justify-center p-8 text-center">
          <Calendar className="mb-4 h-12 w-12 text-muted-foreground" />
          <h3 className="text-lg font-semibold">No Appearances Yet</h3>
          <p className="text-sm text-muted-foreground">
            Accept PR offers to start building your media presence.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <ScrollArea className="h-[600px] pr-4">
      <div className="space-y-3">
        {appearances.map((appearance) => {
          const config = mediaTypeConfig[appearance.media_type || "tv"] || mediaTypeConfig.tv;
          const Icon = config.icon;
          const airDate = appearance.air_date ? parseISO(appearance.air_date) : null;

          return (
            <Card key={appearance.id} className="bg-card/60 backdrop-blur">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={`rounded-lg bg-muted p-2 ${config.color}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium">{appearance.program_name || `${config.label} Appearance`}</h4>
                      <Badge variant="secondary" className="text-xs">
                        {appearance.network}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      {airDate && (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {format(airDate, "MMM d, yyyy")}
                        </span>
                      )}
                      {(appearance.audience_reach ?? 0) > 0 && (
                        <span className="flex items-center gap-1 text-blue-400">
                          <Users className="h-3 w-3" />
                          Reach: {(appearance.audience_reach || 0).toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </ScrollArea>
  );
}
