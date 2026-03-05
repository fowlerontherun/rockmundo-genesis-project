import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Music, Guitar, Lock, Zap, Star, Play } from 'lucide-react';
import {
  INSTRUMENT_LABELS,
  DEFAULT_PRACTICE_SONGS,
  getDifficultyFromSkill,
  type PracticeSong,
} from '@/lib/minigames/stagePracticeTypes';

interface StagePracticeSelectionProps {
  onStart: (songId: string, songTitle: string, instrumentSlug: string, skillLevel: number, audioUrl?: string | null) => void;
}

export function StagePracticeSelection({ onStart }: StagePracticeSelectionProps) {
  const { user } = useAuth();
  const [selectedSong, setSelectedSong] = useState<PracticeSong | null>(null);
  const [selectedInstrument, setSelectedInstrument] = useState<string>('');

  // Fetch player's instrument skills
  const { data: skills = [], isLoading: loadingSkills } = useQuery({
    queryKey: ['practice-instrument-skills', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();
      if (!profile) return [];

      const { data, error } = await supabase
        .from('skill_progress')
        .select('skill_slug, current_level, current_xp, required_xp')
        .eq('profile_id', profile.id)
        .gt('current_level', 0);
      if (error) throw error;

      // Filter to only instrument-like skills
      const instrumentSlugs = Object.keys(INSTRUMENT_LABELS);
      return (data || []).filter(s => instrumentSlugs.includes(s.skill_slug));
    },
    enabled: !!user?.id,
  });

  // Fetch player's recorded songs
  const { data: recordedSongs = [], isLoading: loadingSongs } = useQuery({
    queryKey: ['practice-recorded-songs', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('songs')
        .select('id, title, genre, duration_seconds, audio_url')
        .eq('user_id', user.id)
        .in('status', ['recorded', 'released', 'completed', 'mastered'])
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data || []).map(s => ({
        id: s.id,
        title: s.title || 'Untitled',
        genre: s.genre || 'Rock',
        durationSeconds: s.duration_seconds || 180,
        bpm: 120,
        isDefault: false,
        audioUrl: s.audio_url || null,
      })) as PracticeSong[];
    },
    enabled: !!user?.id,
  });

  const selectedSkill = skills.find(s => s.skill_slug === selectedInstrument);
  const skillLevel = selectedSkill?.current_level ?? 0;
  const difficulty = getDifficultyFromSkill(skillLevel);
  const canStart = !!selectedSong && !!selectedInstrument && skillLevel > 0;

  const handleStart = () => {
    if (!canStart || !selectedSong) return;
    onStart(selectedSong.id, selectedSong.title, selectedInstrument, skillLevel, selectedSong.audioUrl);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold flex items-center justify-center gap-2">
          <Guitar className="h-8 w-8 text-primary" />
          Stage Practice
        </h1>
        <p className="text-muted-foreground">Sharpen your skills with a rhythm challenge</p>
      </div>

      {/* Song Selection */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Music className="h-5 w-5" />
            Select a Song
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="default">
            <TabsList className="w-full grid grid-cols-2">
              <TabsTrigger value="default">Practice Tracks</TabsTrigger>
              <TabsTrigger value="recorded">My Songs</TabsTrigger>
            </TabsList>

            <TabsContent value="default" className="mt-3">
              <ScrollArea className="h-48">
                <div className="space-y-1.5">
                  {DEFAULT_PRACTICE_SONGS.map(song => (
                    <button
                      key={song.id}
                      onClick={() => setSelectedSong(song)}
                      className={`w-full flex items-center justify-between p-2.5 rounded-lg border transition-colors text-left ${
                        selectedSong?.id === song.id
                          ? 'border-primary bg-primary/10'
                          : 'border-border hover:border-primary/40'
                      }`}
                    >
                      <div>
                        <p className="font-medium text-sm">{song.title}</p>
                        <p className="text-xs text-muted-foreground">{song.genre} • {Math.floor(song.durationSeconds / 60)}:{String(song.durationSeconds % 60).padStart(2, '0')}</p>
                      </div>
                      <Badge variant="outline" className="text-xs">{song.bpm} BPM</Badge>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="recorded" className="mt-3">
              {loadingSongs ? (
                <p className="text-sm text-muted-foreground text-center py-8">Loading songs...</p>
              ) : recordedSongs.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No recorded songs yet. Use practice tracks instead!</p>
              ) : (
                <ScrollArea className="h-48">
                  <div className="space-y-1.5">
                    {recordedSongs.map(song => (
                      <button
                        key={song.id}
                        onClick={() => setSelectedSong(song)}
                        className={`w-full flex items-center justify-between p-2.5 rounded-lg border transition-colors text-left ${
                          selectedSong?.id === song.id
                            ? 'border-primary bg-primary/10'
                            : 'border-border hover:border-primary/40'
                        }`}
                      >
                        <div>
                          <p className="font-medium text-sm">{song.title}</p>
                          <p className="text-xs text-muted-foreground">{song.genre}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Instrument Selection */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Select Instrument
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {loadingSkills ? (
            <p className="text-sm text-muted-foreground">Loading skills...</p>
          ) : skills.length === 0 ? (
            <div className="flex items-center gap-3 p-4 rounded-lg border border-destructive/30 bg-destructive/5">
              <Lock className="h-5 w-5 text-destructive" />
              <div>
                <p className="font-medium text-sm">No Instruments Learned</p>
                <p className="text-xs text-muted-foreground">Start learning an instrument in the Skills page first!</p>
              </div>
            </div>
          ) : (
            <>
              <Select value={selectedInstrument} onValueChange={setSelectedInstrument}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose an instrument..." />
                </SelectTrigger>
                <SelectContent>
                  {skills.map(s => (
                    <SelectItem key={s.skill_slug} value={s.skill_slug}>
                      {INSTRUMENT_LABELS[s.skill_slug] || s.skill_slug} (Lvl {s.current_level})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {selectedInstrument && selectedSkill && (
                <div className="grid grid-cols-3 gap-3">
                  <div className="text-center p-3 rounded-lg bg-muted/50">
                    <Star className="h-4 w-4 mx-auto mb-1 text-yellow-500" />
                    <p className="text-lg font-bold">{skillLevel}</p>
                    <p className="text-xs text-muted-foreground">Skill Level</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-muted/50">
                    <Zap className="h-4 w-4 mx-auto mb-1 text-primary" />
                    <p className="text-lg font-bold">{difficulty.label}</p>
                    <p className="text-xs text-muted-foreground">Difficulty</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-muted/50">
                    <p className="text-lg font-bold">{difficulty.hitWindowMs}ms</p>
                    <p className="text-xs text-muted-foreground">Hit Window</p>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Start Button */}
      <Button
        size="lg"
        className="w-full text-lg py-6"
        disabled={!canStart}
        onClick={handleStart}
      >
        <Play className="h-5 w-5 mr-2" />
        Start Practice
      </Button>
    </div>
  );
}
