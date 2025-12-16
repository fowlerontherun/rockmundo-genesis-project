import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { Music, Sparkles, DollarSign, AlertCircle } from "lucide-react";

interface ReleaseSongTabProps {
  userId: string;
}

export const ReleaseSongTab = ({ userId }: ReleaseSongTabProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedSong, setSelectedSong] = useState<string | null>(null);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [releaseType, setReleaseType] = useState<string>("single");

  const { data: unreleasedSongs } = useQuery({
    queryKey: ["unreleased-songs", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("songs")
        .select("*")
        .eq("user_id", userId)
        .in("status", ["draft", "recorded"])
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Filter out songs already released
      const { data: releases } = await supabase
        .from("song_releases")
        .select("song_id");

      const releasedSongIds = new Set(releases?.map((r) => r.song_id) || []);
      return data?.filter((song) => !releasedSongIds.has(song.id)) || [];
    },
  });

  const { data: platforms } = useQuery({
    queryKey: ["streaming-platforms"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("streaming_platforms")
        .select("*")
        .eq("is_active", true)
        .order("platform_name");

      if (error) throw error;
      return data;
    },
  });

  const releaseMutation = useMutation({
    mutationFn: async () => {
      if (!selectedSong || selectedPlatforms.length === 0) {
        throw new Error("Please select a song and at least one platform");
      }

      const song = unreleasedSongs?.find((s) => s.id === selectedSong);
      if (!song) throw new Error("Song not found");

      // Check quality requirements
      for (const platformId of selectedPlatforms) {
        const platform = platforms?.find((p) => p.id === platformId);
        if (platform && song.quality_score < platform.min_quality_requirement) {
          throw new Error(
            `Song quality (${song.quality_score}) doesn't meet ${platform.platform_name}'s requirement (${platform.min_quality_requirement})`
          );
        }
      }

      // Get platform names for each selected platform
      const platformDetails = platforms?.filter(p => selectedPlatforms.includes(p.id)) || [];

      // Create releases with all required fields
      const releases = selectedPlatforms.map((platformId) => {
        const platform = platformDetails.find(p => p.id === platformId);
        return {
          song_id: selectedSong,
          platform_id: platformId,
          platform_name: platform?.platform_name,
          user_id: userId,
          release_type: releaseType,
          release_date: new Date().toISOString(),
          is_active: true,
          total_streams: 0,
          total_revenue: 0
        };
      });

      const { error } = await supabase.from("song_releases").insert(releases);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Song Released!",
        description: `Your song is now live on ${selectedPlatforms.length} platform(s)`,
      });
      queryClient.invalidateQueries({ queryKey: ["song-releases"] });
      queryClient.invalidateQueries({ queryKey: ["unreleased-songs"] });
      setSelectedSong(null);
      setSelectedPlatforms([]);
    },
    onError: (error: Error) => {
      toast({
        title: "Release Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const totalCost = selectedPlatforms.length * (releaseType === "single" ? 50 : releaseType === "ep" ? 150 : 400);

  return (
    <div className="grid md:grid-cols-2 gap-6">
      {/* Song Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Music className="h-5 w-5" />
            Select Song
          </CardTitle>
          <CardDescription>Choose a song to release</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {!unreleasedSongs || unreleasedSongs.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No unreleased songs available. Create songs in the Songwriting section.
            </p>
          ) : (
            <RadioGroup value={selectedSong || ""} onValueChange={setSelectedSong}>
              {unreleasedSongs.map((song) => (
                <div key={song.id} className="flex items-center space-x-2 p-3 rounded-lg border hover:bg-secondary/50">
                  <RadioGroupItem value={song.id} id={song.id} />
                  <Label htmlFor={song.id} className="flex-1 cursor-pointer">
                    <div className="font-medium">{song.title}</div>
                    <div className="text-sm text-muted-foreground flex items-center gap-2">
                      {song.genre}
                      <Badge variant="outline" className="text-xs">
                        Quality: {song.quality_score}
                      </Badge>
                    </div>
                  </Label>
                </div>
              ))}
            </RadioGroup>
          )}
        </CardContent>
      </Card>

      {/* Platform Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Select Platforms
          </CardTitle>
          <CardDescription>Choose where to release your song</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {platforms?.map((platform) => {
            const selectedSongData = unreleasedSongs?.find((s) => s.id === selectedSong);
            const meetsRequirement = !selectedSongData || selectedSongData.quality_score >= platform.min_quality_requirement;

            return (
              <div key={platform.id} className="flex items-start space-x-3 p-3 rounded-lg border">
                <Checkbox
                  id={platform.id}
                  checked={selectedPlatforms.includes(platform.id)}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setSelectedPlatforms([...selectedPlatforms, platform.id]);
                    } else {
                      setSelectedPlatforms(selectedPlatforms.filter((id) => id !== platform.id));
                    }
                  }}
                  disabled={!meetsRequirement}
                />
                <div className="flex-1">
                  <Label htmlFor={platform.id} className="font-medium cursor-pointer">
                    {platform.platform_name}
                  </Label>
                  <div className="text-sm text-muted-foreground mt-1">
                    ${(platform.base_payout_per_stream * 1000).toFixed(2)} per 1k streams
                  </div>
                  {platform.min_quality_requirement > 0 && (
                    <Badge variant={meetsRequirement ? "outline" : "destructive"} className="text-xs mt-1">
                      Min Quality: {platform.min_quality_requirement}
                    </Badge>
                  )}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Release Options */}
      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle>Release Options</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <Label className="mb-3 block">Release Type</Label>
            <RadioGroup value={releaseType} onValueChange={setReleaseType}>
              <div className="grid grid-cols-3 gap-4">
                <div className="flex items-center space-x-2 p-4 rounded-lg border hover:bg-secondary/50">
                  <RadioGroupItem value="single" id="single" />
                  <Label htmlFor="single" className="cursor-pointer flex-1">
                    <div className="font-medium">Single</div>
                    <div className="text-sm text-muted-foreground">$50/platform</div>
                  </Label>
                </div>
                <div className="flex items-center space-x-2 p-4 rounded-lg border hover:bg-secondary/50">
                  <RadioGroupItem value="ep" id="ep" />
                  <Label htmlFor="ep" className="cursor-pointer flex-1">
                    <div className="font-medium">EP</div>
                    <div className="text-sm text-muted-foreground">$150/platform</div>
                  </Label>
                </div>
                <div className="flex items-center space-x-2 p-4 rounded-lg border hover:bg-secondary/50">
                  <RadioGroupItem value="album" id="album" />
                  <Label htmlFor="album" className="cursor-pointer flex-1">
                    <div className="font-medium">Album</div>
                    <div className="text-sm text-muted-foreground">$400/platform</div>
                  </Label>
                </div>
              </div>
            </RadioGroup>
          </div>

          {selectedSong && selectedPlatforms.length > 0 && (
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="pt-6 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Total Release Cost</span>
                  <span className="text-2xl font-bold text-primary flex items-center gap-1">
                    <DollarSign className="h-5 w-5" />
                    {totalCost}
                  </span>
                </div>
                <div className="flex items-start gap-2 text-sm text-muted-foreground">
                  <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span>
                    {selectedPlatforms.length} platform(s) × ${releaseType === "single" ? 50 : releaseType === "ep" ? 150 : 400}
                  </span>
                </div>
              </CardContent>
            </Card>
          )}

          <Button
            onClick={() => releaseMutation.mutate()}
            disabled={!selectedSong || selectedPlatforms.length === 0 || releaseMutation.isPending}
            className="w-full"
            size="lg"
          >
            {releaseMutation.isPending ? "Releasing..." : "Release Song"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};
