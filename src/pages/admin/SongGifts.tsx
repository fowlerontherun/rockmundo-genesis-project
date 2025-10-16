import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminRoute } from "@/components/AdminRoute";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Gift, Music } from "lucide-react";
import { generateSongDuration } from "@/utils/setlistDuration";
import { useAuth } from "@/hooks/use-auth-context";

const SongGifts = () => {
  const { user } = useAuth();
  const [searchBand, setSearchBand] = useState("");
  const [selectedBandId, setSelectedBandId] = useState("");
  const [songData, setSongData] = useState({
    title: "",
    genre: "Rock",
    lyrics: "",
    quality_score: 500,
    gift_message: ""
  });

  const { data: bands } = useQuery({
    queryKey: ['search-bands', searchBand],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bands')
        .select('id, name, leader_id')
        .ilike('name', `%${searchBand}%`)
        .limit(10);
      if (error) throw error;
      return data;
    },
    enabled: searchBand.length > 2
  });

  const giftMutation = useMutation({
    mutationFn: async () => {
      if (!selectedBandId || !user) throw new Error("Missing data");
      
      const band = bands?.find(b => b.id === selectedBandId);
      if (!band) throw new Error("Band not found");

      const duration = generateSongDuration();
      
      const { data: song, error: songError } = await supabase
        .from('songs')
        .insert([{
          title: songData.title,
          genre: songData.genre,
          lyrics: songData.lyrics,
          quality_score: songData.quality_score,
          song_rating: songData.quality_score,
          status: 'completed',
          band_id: selectedBandId,
          user_id: band.leader_id,
          duration_seconds: duration.durationSeconds,
          duration_display: duration.durationDisplay,
          lyrics_strength: 50,
          melody_strength: 50,
          rhythm_strength: 50,
          arrangement_strength: 50,
          production_potential: 50
        }])
        .select()
        .single();

      if (songError) throw songError;

      await supabase.from('admin_song_gifts').insert([{
        song_id: song.id,
        gifted_to_band_id: selectedBandId,
        gifted_to_user_id: band.leader_id,
        gifted_by_admin_id: user.id,
        gift_message: songData.gift_message
      }]);

      return song;
    },
    onSuccess: () => {
      toast.success("Song gifted successfully!");
      setSongData({ title: "", genre: "Rock", lyrics: "", quality_score: 500, gift_message: "" });
      setSelectedBandId("");
      setSearchBand("");
    },
    onError: (error: any) => {
      toast.error("Failed to gift song: " + error.message);
    }
  });

  return (
    <AdminRoute>
      <div className="container mx-auto p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Gift Songs to Bands</h1>
          <p className="text-muted-foreground">Create and gift completed songs to bands</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Music className="h-5 w-5" />
                Create Song
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Title</Label>
                <Input value={songData.title} onChange={(e) => setSongData({...songData, title: e.target.value})} />
              </div>
              <div>
                <Label>Genre</Label>
                <Input value={songData.genre} onChange={(e) => setSongData({...songData, genre: e.target.value})} />
              </div>
              <div>
                <Label>Quality Score (0-1000)</Label>
                <Input type="number" min="0" max="1000" value={songData.quality_score} 
                  onChange={(e) => setSongData({...songData, quality_score: parseInt(e.target.value)})} />
              </div>
              <div>
                <Label>Lyrics (optional)</Label>
                <Textarea value={songData.lyrics} onChange={(e) => setSongData({...songData, lyrics: e.target.value})} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Gift className="h-5 w-5" />
                Select Band
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Search Band</Label>
                <Input placeholder="Type band name..." value={searchBand} onChange={(e) => setSearchBand(e.target.value)} />
              </div>
              
              {bands && bands.length > 0 && (
                <div className="space-y-2">
                  {bands.map(band => (
                    <div key={band.id} 
                      className={`p-3 border rounded cursor-pointer hover:bg-accent ${selectedBandId === band.id ? 'bg-accent' : ''}`}
                      onClick={() => setSelectedBandId(band.id)}>
                      <p className="font-semibold">{band.name}</p>
                    </div>
                  ))}
                </div>
              )}
              
              <div>
                <Label>Gift Message</Label>
                <Textarea value={songData.gift_message} 
                  onChange={(e) => setSongData({...songData, gift_message: e.target.value})} 
                  placeholder="Optional message to the band" />
              </div>
              
              <Button onClick={() => giftMutation.mutate()} 
                disabled={!selectedBandId || !songData.title || giftMutation.isPending} 
                className="w-full">
                <Gift className="mr-2 h-4 w-4" />
                Gift Song to Band
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminRoute>
  );
};

export default SongGifts;
