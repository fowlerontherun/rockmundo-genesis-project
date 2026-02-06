import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart, Music, Star } from "lucide-react";
import { useSongAuctions } from "@/hooks/useSongAuctions";

interface PurchasedSongsTabProps {
  userId: string;
}

export const PurchasedSongsTab = ({ userId }: PurchasedSongsTabProps) => {
  const { purchasedSongs, purchasesLoading } = useSongAuctions(userId);

  if (purchasesLoading) {
    return (
      <Card>
        <CardContent className="pt-6 text-center">
          <p className="text-muted-foreground">Loading purchased songs...</p>
        </CardContent>
      </Card>
    );
  }

  if (purchasedSongs.length === 0) {
    return (
      <Card>
        <CardContent className="pt-12 pb-12 text-center space-y-3">
          <ShoppingCart className="h-12 w-12 mx-auto text-muted-foreground" />
          <h3 className="font-semibold">No Purchased Songs</h3>
          <p className="text-sm text-muted-foreground">
            Songs you buy from the marketplace will appear here. Purchased songs cannot be resold.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Purchased Songs ({purchasedSongs.length})
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Songs acquired from the marketplace. These are permanently in your collection and cannot be resold.
          </p>
        </CardHeader>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {purchasedSongs.map((song) => (
          <Card key={song.id}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-lg truncate flex items-center gap-2">
                    <Music className="h-4 w-4 text-primary flex-shrink-0" />
                    {song.title}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">{song.genre}</p>
                </div>
                <Badge variant="secondary" className="gap-1 flex-shrink-0">
                  <Star className="h-3 w-3" />
                  Purchased
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  Quality: {song.quality_score}
                </Badge>
                {song.duration_display && (
                  <Badge variant="outline" className="text-xs">
                    {song.duration_display}
                  </Badge>
                )}
              </div>
              <div className="text-xs text-muted-foreground border-t pt-2 mt-2">
                This song cannot be relisted on the marketplace.
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};
