import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Music2, Radio, Video, TrendingUp, DollarSign } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function ReleaseDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: release, isLoading } = useQuery({
    queryKey: ["release-detail", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("releases")
        .select(`
          *,
          songs:release_songs(song:songs(*)),
          streaming:song_releases(*, platform:streaming_platforms(*)),
          videos:music_videos(*),
          radio:radio_submissions(*)
        `)
        .eq("id", id)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <p className="text-center text-muted-foreground">Loading release...</p>
      </div>
    );
  }

  if (!release) {
    return (
      <div className="container mx-auto p-6">
        <p className="text-center text-muted-foreground">Release not found</p>
      </div>
    );
  }

  const totalStreams = release.streaming?.reduce((sum: number, s: any) => sum + (s.total_streams || 0), 0) || 0;
  const totalRevenue = release.streaming?.reduce((sum: number, s: any) => sum + (s.total_revenue || 0), 0) || 0;
  const videoViews = release.videos?.reduce((sum: number, v: any) => sum + (v.views || 0), 0) || 0;
  const radioPlays = release.radio?.reduce((sum: number, r: any) => sum + (r.play_count || 0), 0) || 0;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Button variant="ghost" onClick={() => navigate("/releases")}>
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Releases
      </Button>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-4xl font-bold">{release.title}</h1>
          <div className="flex items-center gap-2 mt-2">
            <Badge>{release.release_type}</Badge>
            <Badge variant="outline">{release.release_status}</Badge>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Total Streams
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{totalStreams.toLocaleString()}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Revenue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">${totalRevenue.toFixed(2)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Video className="h-4 w-4" />
              Video Views
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{videoViews.toLocaleString()}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Radio className="h-4 w-4" />
              Radio Plays
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{radioPlays.toLocaleString()}</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="songs" className="w-full">
        <TabsList>
          <TabsTrigger value="songs">Songs</TabsTrigger>
          <TabsTrigger value="streaming">Streaming</TabsTrigger>
          <TabsTrigger value="videos">Music Videos</TabsTrigger>
          <TabsTrigger value="radio">Radio</TabsTrigger>
        </TabsList>

        <TabsContent value="songs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Tracklist</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {release.songs?.map((rs: any, idx: number) => (
                  <div key={rs.song.id} className="flex items-center gap-4 p-3 border rounded-lg">
                    <span className="text-muted-foreground w-8">{idx + 1}</span>
                    <Music2 className="h-4 w-4" />
                    <div className="flex-1">
                      <p className="font-medium">{rs.song.title}</p>
                      <p className="text-sm text-muted-foreground">{rs.song.genre}</p>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {Math.floor(rs.song.duration_seconds / 60)}:{String(rs.song.duration_seconds % 60).padStart(2, '0')}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="streaming" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Streaming Platforms</CardTitle>
                <Button onClick={() => navigate("/streaming")}>Manage Streaming</Button>
              </div>
            </CardHeader>
            <CardContent>
              {release.streaming && release.streaming.length > 0 ? (
                <div className="space-y-2">
                  {release.streaming.map((stream: any) => (
                    <div key={stream.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium">{stream.platform?.name || "Unknown Platform"}</p>
                        <p className="text-sm text-muted-foreground">
                          Released: {new Date(stream.release_date).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">{stream.total_streams?.toLocaleString() || 0} streams</p>
                        <p className="text-sm text-green-500">${stream.total_revenue?.toFixed(2) || "0.00"}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">Not on any streaming platforms yet</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="videos" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Music Videos</CardTitle>
                <Button onClick={() => navigate("/music-videos")}>Create Video</Button>
              </div>
            </CardHeader>
            <CardContent>
              {release.videos && release.videos.length > 0 ? (
                <div className="space-y-2">
                  {release.videos.map((video: any) => (
                    <div key={video.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium">{video.title}</p>
                        <Badge variant="outline">{video.status}</Badge>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">{video.views?.toLocaleString() || 0} views</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">No music videos created yet</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="radio" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Radio Submissions</CardTitle>
                <Button onClick={() => navigate("/radio")}>Submit to Radio</Button>
              </div>
            </CardHeader>
            <CardContent>
              {release.radio && release.radio.length > 0 ? (
                <div className="space-y-2">
                  {release.radio.map((radio: any) => (
                    <div key={radio.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium">Radio Submission</p>
                        <Badge variant="outline">{radio.status}</Badge>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">{radio.play_count || 0} plays</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">Not submitted to radio yet</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
