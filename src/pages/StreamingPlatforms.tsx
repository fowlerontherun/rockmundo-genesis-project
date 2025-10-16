import { Card, CardContent } from "@/components/ui/card";
import { Disc } from "lucide-react";

const StreamingPlatforms = () => {
  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center gap-3">
        <Disc className="h-10 w-10 text-primary" />
        <div>
          <h1 className="text-4xl font-bold">Streaming Platforms</h1>
          <p className="text-muted-foreground">
            Release your music and track performance across platforms
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <p className="text-muted-foreground">
            Streaming platform features are being set up. The database tables have been created.
            Once the types regenerate, you'll be able to release songs to Spotify, Apple Music, Tidal, and more!
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default StreamingPlatforms;