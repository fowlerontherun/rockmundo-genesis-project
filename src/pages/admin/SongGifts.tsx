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
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Gift, Music, Sparkles, History } from "lucide-react";
import { generateSongDuration } from "@/utils/setlistDuration";
import { useAuth } from "@/hooks/use-auth-context";
import { MUSIC_GENRES } from "@/data/genres";
import { z } from "zod";

const songGiftSchema = z.object({
  title: z.string().min(1, "Title required").max(200, "Title too long"),
  genre: z.string().min(1, "Genre required"),
  lyrics: z.string().max(5000, "Lyrics too long").optional(),
  quality_score: z.number().min(0).max(1000),
  lyrics_strength: z.number().min(0).max(100),
  melody_strength: z.number().min(0).max(100),
  rhythm_strength: z.number().min(0).max(100),
  arrangement_strength: z.number().min(0).max(100),
  production_potential: z.number().min(0).max(100),
  ai_generated_lyrics: z.boolean(),
  gift_message: z.string().max(1000, "Message too long").optional()
});

const SongGifts = () => {
  const { user } = useAuth();
  const [searchBand, setSearchBand] = useState("");
  const [selectedBandId, setSelectedBandId] = useState("");
  const [songData, setSongData] = useState({
    title: "",
    genre: "Rock",
    lyrics: "",
    quality_score: 500,
    lyrics_strength: 50,
    melody_strength: 50,
    rhythm_strength: 50,
    arrangement_strength: 50,
    production_potential: 50,
    ai_generated_lyrics: false,
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

  const { data: recentGifts } = useQuery({
    queryKey: ['recent-song-gifts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('admin_song_gifts')
        .select(`
          id,
          created_at,
          gift_message,
          songs (title, genre),
          bands (name)
        `)
        .order('created_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      return data;
    }
  });

  const calculateSongRating = () => {
    const { lyrics_strength, melody_strength, rhythm_strength, arrangement_strength, production_potential } = songData;
    return Math.round((lyrics_strength + melody_strength + rhythm_strength + arrangement_strength + production_potential) / 5);
  };

  const giftMutation = useMutation({
    mutationFn: async () => {
      if (!selectedBandId || !user) throw new Error("Missing data");
      
      const validation = songGiftSchema.safeParse(songData);
      if (!validation.success) {
        throw new Error(validation.error.errors[0].message);
      }
      
      const band = bands?.find(b => b.id === selectedBandId);
      if (!band) throw new Error("Band not found");

      const duration = generateSongDuration();
      const song_rating = calculateSongRating();
      
      const { data: song, error: songError } = await supabase
        .from('songs')
        .insert([{
          title: songData.title,
          genre: songData.genre,
          lyrics: songData.lyrics || null,
          quality_score: songData.quality_score,
          song_rating: song_rating,
          status: 'recorded',
          band_id: selectedBandId,
          user_id: band.leader_id,
          duration_seconds: duration.durationSeconds,
          duration_display: duration.durationDisplay,
          lyrics_strength: songData.lyrics_strength,
          melody_strength: songData.melody_strength,
          rhythm_strength: songData.rhythm_strength,
          arrangement_strength: songData.arrangement_strength,
          production_potential: songData.production_potential,
          ai_generated_lyrics: songData.ai_generated_lyrics,
          ownership_type: 'band',
          catalog_status: 'private'
        }])
        .select()
        .single();

      if (songError) throw songError;

      await supabase.from('admin_song_gifts').insert([{
        song_id: song.id,
        gifted_to_band_id: selectedBandId,
        gifted_to_user_id: band.leader_id,
        gifted_by_admin_id: user.id,
        gift_message: songData.gift_message || null
      }]);

      return song;
    },
    onSuccess: () => {
      toast.success("Song gifted successfully!");
      setSongData({ 
        title: "", 
        genre: "Rock", 
        lyrics: "", 
        quality_score: 500, 
        lyrics_strength: 50,
        melody_strength: 50,
        rhythm_strength: 50,
        arrangement_strength: 50,
        production_potential: 50,
        ai_generated_lyrics: false,
        gift_message: "" 
      });
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
          <p className="text-muted-foreground">Create fully-featured songs with all attributes and gift them to bands</p>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Music className="h-5 w-5" />
                Song Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label>Title *</Label>
                  <Input 
                    value={songData.title} 
                    onChange={(e) => setSongData({...songData, title: e.target.value})}
                    placeholder="Enter song title"
                    maxLength={200}
                  />
                </div>
                <div>
                  <Label>Genre *</Label>
                  <Select value={songData.genre} onValueChange={(value) => setSongData({...songData, genre: value})}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MUSIC_GENRES.map(genre => (
                        <SelectItem key={genre} value={genre}>{genre}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label>Lyrics (optional)</Label>
                <Textarea 
                  value={songData.lyrics} 
                  onChange={(e) => setSongData({...songData, lyrics: e.target.value})}
                  placeholder="Enter song lyrics..."
                  rows={4}
                  maxLength={5000}
                />
                <p className="text-xs text-muted-foreground mt-1">{songData.lyrics.length}/5000</p>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="ai-lyrics"
                  checked={songData.ai_generated_lyrics}
                  onCheckedChange={(checked) => setSongData({...songData, ai_generated_lyrics: checked as boolean})}
                />
                <Label htmlFor="ai-lyrics" className="text-sm font-normal cursor-pointer">
                  AI Generated Lyrics
                </Label>
              </div>

              <div className="space-y-4 pt-4 border-t">
                <h3 className="font-semibold">Song Strength Attributes</h3>
                
                <div>
                  <div className="flex justify-between mb-2">
                    <Label>Lyrics Strength</Label>
                    <Badge variant="outline">{songData.lyrics_strength}/100</Badge>
                  </div>
                  <Slider 
                    value={[songData.lyrics_strength]} 
                    onValueChange={([value]) => setSongData({...songData, lyrics_strength: value})}
                    max={100}
                    step={1}
                  />
                </div>

                <div>
                  <div className="flex justify-between mb-2">
                    <Label>Melody Strength</Label>
                    <Badge variant="outline">{songData.melody_strength}/100</Badge>
                  </div>
                  <Slider 
                    value={[songData.melody_strength]} 
                    onValueChange={([value]) => setSongData({...songData, melody_strength: value})}
                    max={100}
                    step={1}
                  />
                </div>

                <div>
                  <div className="flex justify-between mb-2">
                    <Label>Rhythm Strength</Label>
                    <Badge variant="outline">{songData.rhythm_strength}/100</Badge>
                  </div>
                  <Slider 
                    value={[songData.rhythm_strength]} 
                    onValueChange={([value]) => setSongData({...songData, rhythm_strength: value})}
                    max={100}
                    step={1}
                  />
                </div>

                <div>
                  <div className="flex justify-between mb-2">
                    <Label>Arrangement Strength</Label>
                    <Badge variant="outline">{songData.arrangement_strength}/100</Badge>
                  </div>
                  <Slider 
                    value={[songData.arrangement_strength]} 
                    onValueChange={([value]) => setSongData({...songData, arrangement_strength: value})}
                    max={100}
                    step={1}
                  />
                </div>

                <div>
                  <div className="flex justify-between mb-2">
                    <Label>Production Potential</Label>
                    <Badge variant="outline">{songData.production_potential}/100</Badge>
                  </div>
                  <Slider 
                    value={[songData.production_potential]} 
                    onValueChange={([value]) => setSongData({...songData, production_potential: value})}
                    max={100}
                    step={1}
                  />
                </div>
              </div>

              <div className="pt-4 border-t">
                <div className="flex justify-between mb-2">
                  <Label>Overall Quality Score</Label>
                  <Badge variant="outline">{songData.quality_score}/1000</Badge>
                </div>
                <Slider 
                  value={[songData.quality_score]} 
                  onValueChange={([value]) => setSongData({...songData, quality_score: value})}
                  max={1000}
                  step={10}
                />
              </div>

              <Card className="bg-muted/50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Sparkles className="h-4 w-4" />
                    Song Quality Preview
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{calculateSongRating()}/100</div>
                  <p className="text-xs text-muted-foreground">Calculated from strength attributes</p>
                </CardContent>
              </Card>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Gift className="h-5 w-5" />
                  Gift to Band
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Search Band</Label>
                  <Input 
                    placeholder="Type band name..." 
                    value={searchBand} 
                    onChange={(e) => setSearchBand(e.target.value)} 
                  />
                </div>
                
                {bands && bands.length > 0 && (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {bands.map(band => (
                      <div 
                        key={band.id} 
                        className={`p-3 border rounded cursor-pointer hover:bg-accent transition-colors ${selectedBandId === band.id ? 'bg-accent border-primary' : ''}`}
                        onClick={() => setSelectedBandId(band.id)}
                      >
                        <p className="font-semibold">{band.name}</p>
                      </div>
                    ))}
                  </div>
                )}
                
                <div>
                  <Label>Gift Message</Label>
                  <Textarea 
                    value={songData.gift_message} 
                    onChange={(e) => setSongData({...songData, gift_message: e.target.value})} 
                    placeholder="Optional message to the band"
                    rows={3}
                    maxLength={1000}
                  />
                </div>
                
                <Button 
                  onClick={() => giftMutation.mutate()} 
                  disabled={!selectedBandId || !songData.title || giftMutation.isPending} 
                  className="w-full"
                  size="lg"
                >
                  <Gift className="mr-2 h-4 w-4" />
                  {giftMutation.isPending ? "Gifting..." : "Gift Song to Band"}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <History className="h-5 w-5" />
                  Recent Gifts
                </CardTitle>
              </CardHeader>
              <CardContent>
                {recentGifts && recentGifts.length > 0 ? (
                  <div className="space-y-3">
                    {recentGifts.map((gift: any) => (
                      <div key={gift.id} className="text-sm border-b pb-2">
                        <p className="font-semibold">{gift.songs?.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {gift.bands?.name} • {gift.songs?.genre}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(gift.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No recent gifts</p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AdminRoute>
  );
};

export default SongGifts;
