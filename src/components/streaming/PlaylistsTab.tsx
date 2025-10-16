import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ListMusic } from "lucide-react";

interface PlaylistsTabProps {
  userId: string;
}

export const PlaylistsTab = ({ userId }: PlaylistsTabProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ListMusic className="h-5 w-5" />
          Playlist Submissions
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">
          Playlist submission features coming soon. Submit your songs to curated playlists for exposure.
        </p>
      </CardContent>
    </Card>
  );
};
