import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Gift className="h-5 w-5 text-primary" />
          Gifted Songs
        </CardTitle>
        <CardDescription>
          Songs that have been gifted to your band
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {gifts.map((gift) => (
          <div key={gift.id} className="flex items-start justify-between border rounded-lg p-4">
            <div className="flex gap-3">
              <Music className="h-5 w-5 mt-1 text-muted-foreground" />
              <div className="space-y-1">
                <h4 className="font-semibold">{gift.song_title}</h4>
                <div className="flex gap-2">
                  <Badge variant="secondary">{gift.genre}</Badge>
                  {gift.song_rating && (
                    <Badge variant="outline">Rating: {gift.song_rating}/100</Badge>
                  )}
                </div>
                {gift.gift_message && (
                  <p className="text-sm text-muted-foreground mt-2">{gift.gift_message}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  Received {formatDistanceToNow(new Date(gift.created_at))} ago
                </p>
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};
