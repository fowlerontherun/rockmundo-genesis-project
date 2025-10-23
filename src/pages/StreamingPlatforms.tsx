import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Disc, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useGameData } from "@/hooks/useGameData";
import { MyReleasesTab } from "@/components/streaming/MyReleasesTab";
import { ReleaseSongTab } from "@/components/streaming/ReleaseSongTab";
import { AnalyticsTab } from "@/components/streaming/AnalyticsTab";
import { DetailedAnalyticsTab } from "@/components/streaming/DetailedAnalyticsTab";
import { PlaylistsTab } from "@/components/streaming/PlaylistsTab";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info } from "lucide-react";

const StreamingPlatforms = () => {
  const navigate = useNavigate();
  const { profile } = useGameData();
  const userId = profile?.user_id;

  if (!userId) {
    return (
      <div className="container mx-auto py-8">
        <p className="text-muted-foreground">Please log in to access streaming platforms.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="space-y-4">
        <Button
          variant="ghost"
          onClick={() => navigate("/music-hub")}
          className="mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Music Hub
        </Button>

        <div className="flex items-center gap-3">
          <Disc className="h-10 w-10 text-primary" />
          <div>
            <h1 className="text-4xl font-bold">Streaming Platforms</h1>
            <p className="text-muted-foreground">
              Release your music and track performance across platforms
            </p>
          </div>
        </div>

        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            For full release management including physical formats (CD, Vinyl), use the <Button variant="link" className="p-0 h-auto" onClick={() => navigate('/release-manager')}>Release Manager</Button>
          </AlertDescription>
        </Alert>
      </div>

      <Tabs defaultValue="releases" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="releases">My Releases</TabsTrigger>
          <TabsTrigger value="new-release">Release Song</TabsTrigger>
          <TabsTrigger value="analytics">Overview</TabsTrigger>
          <TabsTrigger value="detailed-analytics">Detailed Analytics</TabsTrigger>
          <TabsTrigger value="playlists">Playlists</TabsTrigger>
        </TabsList>

        <TabsContent value="releases">
          <MyReleasesTab userId={userId} />
        </TabsContent>

        <TabsContent value="new-release">
          <ReleaseSongTab userId={userId} />
        </TabsContent>

        <TabsContent value="analytics">
          <AnalyticsTab userId={userId} />
        </TabsContent>

        <TabsContent value="detailed-analytics">
          <DetailedAnalyticsTab userId={userId} />
        </TabsContent>

        <TabsContent value="playlists">
          <PlaylistsTab userId={userId} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default StreamingPlatforms;