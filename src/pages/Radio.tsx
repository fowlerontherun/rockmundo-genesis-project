import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { Radio as RadioIcon, Music, TrendingUp, Star, Clock, Send, CheckCircle, XCircle } from "lucide-react";

export default function Radio() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [user, setUser] = useState<any>(null);

  // Get current user
  useState(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
    });
  });
  const [selectedStation, setSelectedStation] = useState<string>("");
  const [selectedSong, setSelectedSong] = useState<string>("");
  const [filterType, setFilterType] = useState<'all' | 'national' | 'local'>('all');

  const { data: profile } = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*, bands!bands_leader_id_fkey(id, name, fame)')
        .eq('user_id', user?.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const { data: stations } = useQuery({
    queryKey: ['radio-stations', filterType],
    queryFn: async () => {
      let query = supabase
        .from('radio_stations')
        .select('*, cities(name, country)')
        .eq('is_active', true)
        .order('quality_level', { ascending: false });
      
      if (filterType !== 'all') {
        query = query.eq('station_type', filterType);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const { data: shows } = useQuery({
    queryKey: ['radio-shows', selectedStation],
    queryFn: async () => {
      if (!selectedStation) return [];
      const { data, error } = await supabase
        .from('radio_shows')
        .select('*')
        .eq('station_id', selectedStation)
        .eq('is_active', true)
        .order('time_slot');
      if (error) throw error;
      return data;
    },
    enabled: !!selectedStation,
  });

  const { data: recordedSongs } = useQuery({
    queryKey: ['recorded-songs', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('songs')
        .select('*')
        .eq('user_id', user?.id)
        .eq('status', 'recorded')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const { data: mySubmissions } = useQuery({
    queryKey: ['my-radio-submissions', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('radio_submissions')
        .select('*, songs(title, genre), radio_stations(name)')
        .eq('user_id', user?.id)
        .order('submitted_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const { data: topSongs } = useQuery({
    queryKey: ['top-radio-songs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('songs')
        .select('*, profiles(display_name)')
        .order('hype', { ascending: false })
        .limit(10);
      if (error) throw error;
      return data;
    },
  });

  const submitSong = useMutation({
    mutationFn: async () => {
      if (!selectedStation || !selectedSong) {
        throw new Error('Please select a station and song');
      }

      // Check if already submitted this week
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      const weekStartDate = weekStart.toISOString().split('T')[0];

      const { data: existing } = await supabase
        .from('radio_submissions')
        .select('id')
        .eq('station_id', selectedStation)
        .eq('song_id', selectedSong)
        .eq('week_submitted', weekStartDate)
        .single();

      if (existing) {
        throw new Error('You have already submitted this song to this station this week');
      }

      const { data, error } = await supabase
        .from('radio_submissions')
        .insert([{
          song_id: selectedSong,
          user_id: user?.id,
          station_id: selectedStation,
          week_submitted: weekStartDate,
        }])
        .select()
        .single();
      
      if (error) throw error;

      // Get song and station details for hype/fame calculation
      const { data: selectedSongData } = await supabase
        .from('songs')
        .select('hype, band_id')
        .eq('id', selectedSong)
        .single();

      const { data: stationData } = await supabase
        .from('radio_stations')
        .select('listener_base')
        .eq('id', selectedStation)
        .single();

      if (selectedSongData && stationData) {
        // Update song hype
        await supabase
          .from('songs')
          .update({
            hype: (selectedSongData.hype || 0) + Math.floor((stationData.listener_base || 0) * 0.001)
          })
          .eq('id', selectedSong);

        // Award fame to band and members if band song
        if (selectedSongData.band_id) {
          const fameGain = Math.floor((stationData.listener_base || 0) * 0.0005);
          
          const { data: band } = await supabase
            .from('bands')
            .select('fame')
            .eq('id', selectedSongData.band_id)
            .single();

          if (band) {
            await supabase
              .from('bands')
              .update({ fame: (band.fame || 0) + fameGain })
              .eq('id', selectedSongData.band_id);

            // Award fame to band members
            const { data: members } = await supabase
              .from('band_members')
              .select('user_id')
              .eq('band_id', selectedSongData.band_id)
              .eq('is_touring_member', false);

            if (members) {
              const famePerMember = Math.floor(fameGain / Math.max(1, members.length));
              
              for (const member of members) {
                const { data: profile } = await supabase
                  .from('profiles')
                  .select('fame')
                  .eq('user_id', member.user_id)
                  .single();

                if (profile) {
                  await supabase
                    .from('profiles')
                    .update({ fame: (profile.fame || 0) + famePerMember })
                    .eq('user_id', member.user_id);
                }
              }
            }
          }
        }
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-radio-submissions'] });
      toast.success('Song submitted to radio station!');
      setSelectedSong('');
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  const getQualityColor = (level: number) => {
    if (level >= 4) return 'text-yellow-500';
    if (level >= 3) return 'text-blue-500';
    return 'text-gray-500';
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'accepted':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'rejected':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-yellow-500" />;
    }
  };

  if (!user) {
    navigate('/auth');
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-stage">
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center gap-3">
          <RadioIcon className="h-8 w-8" />
          <div>
            <h1 className="text-4xl font-oswald">Radio Airplay</h1>
            <p className="text-muted-foreground">Submit your songs to radio stations and build hype</p>
          </div>
        </div>

        <Alert>
          <Music className="h-4 w-4" />
          <AlertDescription>
            Submit your recorded songs to radio stations. Higher quality stations are more selective but reach more listeners.
            Songs can be played up to 7 times per week if added to playlists. Each play increases hype, streams, and sales!
          </AlertDescription>
        </Alert>

        <Tabs defaultValue="submit" className="w-full">
          <TabsList>
            <TabsTrigger value="submit">Submit Song</TabsTrigger>
            <TabsTrigger value="submissions">My Submissions</TabsTrigger>
            <TabsTrigger value="trending">Trending on Radio</TabsTrigger>
          </TabsList>

          <TabsContent value="submit" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Submit Song to Radio</CardTitle>
                <CardDescription>Choose a station and one of your recorded songs to submit</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Filter Stations</label>
                  <div className="flex gap-2">
                    <Button
                      variant={filterType === 'all' ? 'default' : 'outline'}
                      onClick={() => setFilterType('all')}
                    >
                      All
                    </Button>
                    <Button
                      variant={filterType === 'national' ? 'default' : 'outline'}
                      onClick={() => setFilterType('national')}
                    >
                      National
                    </Button>
                    <Button
                      variant={filterType === 'local' ? 'default' : 'outline'}
                      onClick={() => setFilterType('local')}
                    >
                      Local
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {stations?.map((station) => (
                    <Card
                      key={station.id}
                      className={`cursor-pointer transition-colors ${
                        selectedStation === station.id ? 'border-primary' : ''
                      }`}
                      onClick={() => setSelectedStation(station.id)}
                    >
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div>
                            <CardTitle className="text-lg">{station.name}</CardTitle>
                            <CardDescription>{station.frequency}</CardDescription>
                          </div>
                          <div className="flex items-center gap-1">
                            {[...Array(5)].map((_, i) => (
                              <Star
                                key={i}
                                className={`h-4 w-4 ${
                                  i < station.quality_level
                                    ? 'fill-yellow-500 text-yellow-500'
                                    : 'text-gray-300'
                                }`}
                              />
                            ))}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Type:</span>
                          <Badge variant="outline">{station.station_type}</Badge>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Location:</span>
                          <span className="text-sm">
                            {station.station_type === 'national'
                              ? station.country
                              : `${station.cities?.name}, ${station.cities?.country}`}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Listeners:</span>
                          <span className="font-semibold">
                            {station.listener_base.toLocaleString()}
                          </span>
                        </div>
                        {station.accepted_genres?.length > 0 && (
                          <div className="pt-2">
                            <p className="text-xs text-muted-foreground mb-1">Accepts:</p>
                            <div className="flex flex-wrap gap-1">
                              {station.accepted_genres.map((genre: string) => (
                                <Badge key={genre} variant="secondary" className="text-xs">
                                  {genre}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {selectedStation && shows && shows.length > 0 && (
                  <div className="pt-4">
                    <h3 className="text-lg font-semibold mb-2">Shows on this station:</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {shows.map((show) => (
                        <div key={show.id} className="p-3 border rounded-lg">
                          <p className="font-medium">{show.show_name}</p>
                          <p className="text-sm text-muted-foreground">Host: {show.host_name}</p>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {show.show_genres?.map((genre: string) => (
                              <Badge key={genre} variant="outline" className="text-xs">
                                {genre}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <label className="text-sm font-medium mb-2 block">Select Song</label>
                  <Select value={selectedSong} onValueChange={setSelectedSong}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a recorded song" />
                    </SelectTrigger>
                    <SelectContent>
                      {recordedSongs?.map((song) => (
                        <SelectItem key={song.id} value={song.id}>
                          {song.title} ({song.genre}) - Quality: {song.quality_score}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  onClick={() => submitSong.mutate()}
                  disabled={!selectedStation || !selectedSong || submitSong.isPending}
                  className="w-full"
                >
                  <Send className="h-4 w-4 mr-2" />
                  Submit to Radio Station
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="submissions" className="space-y-4">
            {mySubmissions?.length === 0 ? (
              <Card>
                <CardContent className="pt-6">
                  <p className="text-center text-muted-foreground">
                    No submissions yet. Submit your first song to a radio station!
                  </p>
                </CardContent>
              </Card>
            ) : (
              mySubmissions?.map((submission) => (
                <Card key={submission.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg">{submission.songs?.title}</CardTitle>
                        <CardDescription>{submission.radio_stations?.name}</CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(submission.status)}
                        <Badge
                          variant={
                            submission.status === 'accepted'
                              ? 'default'
                              : submission.status === 'rejected'
                              ? 'destructive'
                              : 'secondary'
                          }
                        >
                          {submission.status}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Genre:</span>
                        <Badge variant="outline">{submission.songs?.genre}</Badge>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Submitted:</span>
                        <span>{new Date(submission.submitted_at).toLocaleDateString()}</span>
                      </div>
                      {submission.rejection_reason && (
                        <Alert variant="destructive">
                          <AlertDescription>{submission.rejection_reason}</AlertDescription>
                        </Alert>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="trending" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Top Songs on Radio</CardTitle>
                <CardDescription>Songs with the most hype from radio airplay</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {topSongs?.map((song, index) => (
                    <div key={song.id} className="flex items-center gap-4 p-3 border rounded-lg">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10">
                        <span className="font-bold">{index + 1}</span>
                      </div>
                      <div className="flex-1">
                        <p className="font-medium">{song.title}</p>
                        <p className="text-sm text-muted-foreground">
                          by {song.profiles?.display_name}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-green-500" />
                        <span className="font-semibold">{song.hype || 0} hype</span>
                      </div>
                      <Badge variant="outline">{song.genre}</Badge>
                      {song.total_radio_plays > 0 && (
                        <Badge variant="secondary">{song.total_radio_plays} plays</Badge>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
