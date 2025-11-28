import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Music2 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { getRehearsalLevel, formatRehearsalTime, getNextLevelInfo } from "@/utils/rehearsalLevels";

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
        .select("familiarity_minutes, familiarity_percentage, rehearsal_stage")
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
            <Badge variant="destructive" className="gap-1">
              <Music2 className="h-3 w-3" />
              Unlearned
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p>This song hasn't been rehearsed yet</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  const rehearsalInfo = getRehearsalLevel(familiarity.familiarity_minutes);
  const nextLevelInfo = getNextLevelInfo(familiarity.familiarity_minutes);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant={rehearsalInfo.variant} className="gap-1">
            <Music2 className="h-3 w-3" />
            {rehearsalInfo.name}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <div className="space-y-1">
            <p>{formatRehearsalTime(familiarity.familiarity_minutes)} rehearsed</p>
            <p className="text-xs text-muted-foreground">
              Performance: {rehearsalInfo.performanceModifier > 0 ? '+' : ''}{(rehearsalInfo.performanceModifier * 100).toFixed(0)}%
            </p>
            {nextLevelInfo.nextLevel && (
              <p className="text-xs text-primary">
                {formatRehearsalTime(nextLevelInfo.minutesNeeded)} to {nextLevelInfo.nextLevel.name}
              </p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
