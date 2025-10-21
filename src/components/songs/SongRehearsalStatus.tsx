import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Music2, Clock } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

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
        .select("familiarity_minutes, familiarity_percentage, last_rehearsed_at")
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
            <Badge variant="outline" className="gap-1">
              <Music2 className="h-3 w-3" />
              Not Rehearsed
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p>This song hasn't been rehearsed by the band yet</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  const percentage = familiarity.familiarity_percentage || Math.min(100, (familiarity.familiarity_minutes / 60) * 100);
  const level = percentage >= 80 ? "Well Rehearsed" : percentage >= 50 ? "Familiar" : "Learning";
  const variant = percentage >= 80 ? "default" : percentage >= 50 ? "secondary" : "outline";

  const lastRehearsed = familiarity.last_rehearsed_at
    ? new Date(familiarity.last_rehearsed_at).toLocaleDateString()
    : "Never";

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
          <div className="space-y-1">
            <p className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {familiarity.familiarity_minutes} minutes rehearsed (60 min max)
            </p>
            <p className="text-xs text-muted-foreground">Last rehearsed: {lastRehearsed}</p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
