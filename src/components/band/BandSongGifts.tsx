import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Gift, Music } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface BandSongGiftsProps {
  bandId: string;
}

export const BandSongGifts = ({ bandId }: BandSongGiftsProps) => {
  
  const { data: gifts } = useQuery({
    queryKey: ['band-song-gifts', bandId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('band_gift_notifications')
        .select('*')
        .eq('gifted_to_band_id', bandId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!bandId
  });

  if (!gifts || gifts.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Gift className="h-4 w-4 text-primary" />
          Gifted Songs ({gifts.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="divide-y divide-border">
          {gifts.map((gift) => (
            <div key={gift.id} className="py-2 first:pt-0 last:pb-0 flex items-center gap-2">
              <Music className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-medium text-sm truncate">{gift.song_title}</span>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                    {gift.genre}
                  </Badge>
                  {gift.song_rating && (
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                      {gift.song_rating}/100
                    </Badge>
                  )}
                </div>
                {gift.gift_message && (
                  <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                    "{gift.gift_message}"
                  </p>
                )}
              </div>
              <span className="text-[10px] text-muted-foreground shrink-0">
                {formatDistanceToNow(new Date(gift.created_at), { addSuffix: true })}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};