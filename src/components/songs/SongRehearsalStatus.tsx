import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Music2, Clock } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { getRehearsalLevel, formatRehearsalTime, getNextLevelInfo } from "@/utils/rehearsalLevels";

interface SongRehearsalStatusProps {
  songId: string;
  bandId?: string | null;
}

export function SongRehearsalStatus({ songId, bandId }: SongRehearsalStatusProps) {
  const { data: familiarity } = useQuery({
    queryKey: ["song-rehearsal-status", songId, bandId],
    queryFn: async () => {
      if (!bandId) return null;

      const { data } = await supabase
        .from("band_song_familiarity")
        .select("familiarity_minutes, familiarity_percentage, last_rehearsed_at, rehearsal_stage")
        .eq("song_id", songId)
        .eq("band_id", bandId)
        .maybeSingle();
      
      return data;
    },
    enabled: !!songId && !!bandId,
  });

  if (!bandId) return null;

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
            <p>This song hasn't been rehearsed by the band yet</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  const rehearsalInfo = getRehearsalLevel(familiarity.familiarity_minutes);
  const nextLevelInfo = getNextLevelInfo(familiarity.familiarity_minutes);
  const lastRehearsed = familiarity.last_rehearsed_at
    ? new Date(familiarity.last_rehearsed_at).toLocaleDateString()
    : "Never";

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
            <p className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatRehearsalTime(familiarity.familiarity_minutes)} rehearsed
            </p>
            <p className="text-xs text-muted-foreground">Last rehearsed: {lastRehearsed}</p>
            <p className="text-xs text-muted-foreground">
              Performance modifier: {rehearsalInfo.performanceModifier > 0 ? '+' : ''}{(rehearsalInfo.performanceModifier * 100).toFixed(0)}%
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
