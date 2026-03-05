import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Music, Upload, Trash2, CheckCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { DEFAULT_PRACTICE_SONGS } from '@/lib/minigames/stagePracticeTypes';

interface TrackAudioRow {
  id: string;
  track_id: string;
  track_title: string;
  genre: string;
  audio_url: string | null;
  uploaded_at: string | null;
}

export default function PracticeTracksAdmin() {
  const queryClient = useQueryClient();
  const [uploadingTrackId, setUploadingTrackId] = useState<string | null>(null);

  const { data: trackAudio = [], isLoading } = useQuery({
    queryKey: ['practice-track-audio'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('practice_track_audio')
        .select('*');
      if (error) throw error;
      return (data || []) as TrackAudioRow[];
    },
  });

  const audioMap = new Map(trackAudio.map(t => [t.track_id, t]));

  const uploadMutation = useMutation({
    mutationFn: async ({ trackId, file, song }: { trackId: string; file: File; song: typeof DEFAULT_PRACTICE_SONGS[0] }) => {
      const ext = file.name.split('.').pop() || 'mp3';
      const path = `${trackId}.${ext}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('practice-tracks')
        .upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('practice-tracks')
        .getPublicUrl(path);

      const audioUrl = urlData.publicUrl;

      // Upsert into practice_track_audio table
      const { error: dbError } = await supabase
        .from('practice_track_audio')
        .upsert({
          track_id: trackId,
          track_title: song.title,
          genre: song.genre,
          audio_url: audioUrl,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'track_id' });
      if (dbError) throw dbError;

      return audioUrl;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['practice-track-audio'] });
      toast.success('Audio uploaded successfully!');
      setUploadingTrackId(null);
    },
    onError: (err) => {
      toast.error(`Upload failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setUploadingTrackId(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (trackId: string) => {
      const existing = audioMap.get(trackId);
      if (!existing?.audio_url) return;

      // Delete from storage
      const urlParts = existing.audio_url.split('/practice-tracks/');
      if (urlParts[1]) {
        await supabase.storage.from('practice-tracks').remove([urlParts[1]]);
      }

      // Delete from table
      const { error } = await supabase
        .from('practice_track_audio')
        .delete()
        .eq('track_id', trackId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['practice-track-audio'] });
      toast.success('Audio removed');
    },
    onError: (err) => {
      toast.error(`Delete failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    },
  });

  const handleFileChange = (trackId: string, song: typeof DEFAULT_PRACTICE_SONGS[0], file: File | null) => {
    if (!file) return;
    setUploadingTrackId(trackId);
    uploadMutation.mutate({ trackId, file, song });
  };

  return (
    <div className="container mx-auto p-4 md:p-6 max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <Music className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Practice Track Audio</h1>
          <p className="text-sm text-muted-foreground">Upload background music for each default practice track</p>
        </div>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : (
        <div className="space-y-3">
          {DEFAULT_PRACTICE_SONGS.map(song => {
            const existing = audioMap.get(song.id);
            const hasAudio = !!existing?.audio_url;
            const isUploading = uploadingTrackId === song.id && uploadMutation.isPending;

            return (
              <Card key={song.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium">{song.title}</p>
                        <Badge variant="outline" className="text-xs">{song.genre}</Badge>
                        <Badge variant="secondary" className="text-xs">{song.bpm} BPM</Badge>
                      </div>

                      {hasAudio ? (
                        <div className="flex items-center gap-2 mt-2">
                          <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                          <audio
                            controls
                            src={existing!.audio_url!}
                            className="h-8 flex-1 max-w-xs"
                            preload="none"
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            onClick={() => deleteMutation.mutate(song.id)}
                            disabled={deleteMutation.isPending}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground mt-1">No audio uploaded</p>
                      )}
                    </div>

                    <div className="flex-shrink-0">
                      {isUploading ? (
                        <Button variant="outline" size="sm" disabled>
                          <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                          Uploading...
                        </Button>
                      ) : (
                        <label>
                          <Button variant="outline" size="sm" asChild>
                            <span>
                              <Upload className="h-4 w-4 mr-1" />
                              {hasAudio ? 'Replace' : 'Upload'}
                            </span>
                          </Button>
                          <Input
                            type="file"
                            accept="audio/*"
                            className="hidden"
                            onChange={(e) => handleFileChange(song.id, song, e.target.files?.[0] || null)}
                          />
                        </label>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
