import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Music2 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface SongFamiliarityBadgeProps {
  songId: string;
  bandId: string;
}

export function SongFamiliarityBadge({ songId, bandId }: SongFamiliarityBadgeProps) {
  const { data: familiarity } = useQuery({
    queryKey: ["song-familiarity", songId, bandId],
    queryFn: async () => {
      const { data } = await supabase
        .from("band_song_familiarity")
        .select("familiarity_minutes, familiarity_percentage")
        .eq("song_id", songId)
        .eq("band_id", bandId)
        .maybeSingle();
      return data;
    },
    enabled: !!songId && !!bandId,
  });

  if (!familiarity) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="outline" className="gap-1">
              <Music2 className="h-3 w-3" />
              Not Rehearsed
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p>This song hasn't been rehearsed yet</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  const percentage = familiarity.familiarity_percentage || Math.min(100, (familiarity.familiarity_minutes / 60) * 100);
  const level = percentage >= 80 ? "Well Rehearsed" : percentage >= 50 ? "Familiar" : "Learning";
  const variant = percentage >= 80 ? "default" : percentage >= 50 ? "secondary" : "outline";

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant={variant} className="gap-1">
            <Music2 className="h-3 w-3" />
            {level} ({Math.round(percentage)}%)
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p>{familiarity.familiarity_minutes} minutes rehearsed (60 min max)</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
