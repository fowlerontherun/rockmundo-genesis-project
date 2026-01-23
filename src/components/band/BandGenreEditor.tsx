import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Music, Clock, AlertCircle } from 'lucide-react';
import { MUSIC_GENRES } from '@/data/genres';
import { differenceInDays, addDays, formatDistanceToNow } from 'date-fns';

interface BandGenreEditorProps {
  bandId: string;
  currentPrimaryGenre: string | null;
  currentSecondaryGenres: string[] | null;
  genreLastChangedAt: string | null;
  isLeader: boolean;
  onUpdate: () => void;
}

const GENRE_COOLDOWN_DAYS = 30;

export function BandGenreEditor({
  bandId,
  currentPrimaryGenre,
  currentSecondaryGenres,
  genreLastChangedAt,
  isLeader,
  onUpdate,
}: BandGenreEditorProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [primaryGenre, setPrimaryGenre] = useState(currentPrimaryGenre || '');
  const [secondaryGenre1, setSecondaryGenre1] = useState(currentSecondaryGenres?.[0] || '');
  const [secondaryGenre2, setSecondaryGenre2] = useState(currentSecondaryGenres?.[1] || '');
  
  useEffect(() => {
    setPrimaryGenre(currentPrimaryGenre || '');
    setSecondaryGenre1(currentSecondaryGenres?.[0] || '');
    setSecondaryGenre2(currentSecondaryGenres?.[1] || '');
  }, [currentPrimaryGenre, currentSecondaryGenres]);

  // Calculate cooldown
  const lastChanged = genreLastChangedAt ? new Date(genreLastChangedAt) : null;
  const nextChangeDate = lastChanged ? addDays(lastChanged, GENRE_COOLDOWN_DAYS) : null;
  const now = new Date();
  const canChange = !nextChangeDate || now >= nextChangeDate;
  const daysRemaining = nextChangeDate && !canChange 
    ? differenceInDays(nextChangeDate, now) 
    : 0;

  // Check if anything changed
  const hasChanges = 
    primaryGenre !== (currentPrimaryGenre || '') ||
    secondaryGenre1 !== (currentSecondaryGenres?.[0] || '') ||
    secondaryGenre2 !== (currentSecondaryGenres?.[1] || '');

  const updateGenreMutation = useMutation({
    mutationFn: async () => {
      const secondaryGenres = [secondaryGenre1, secondaryGenre2].filter(Boolean);
      
      const { error } = await supabase
        .from('bands')
        .update({
          primary_genre: primaryGenre || null,
          genre: primaryGenre || null, // Keep legacy column in sync
          secondary_genres: secondaryGenres,
          genre_last_changed_at: new Date().toISOString(),
        })
        .eq('id', bandId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: 'Genres Updated',
        description: `Your band's genre has been updated. Next change available in ${GENRE_COOLDOWN_DAYS} days.`,
      });
      queryClient.invalidateQueries({ queryKey: ['band', bandId] });
      queryClient.invalidateQueries({ queryKey: ['band-details', bandId] });
      onUpdate();
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update genres',
        variant: 'destructive',
      });
    },
  });

  // Get available genres for secondary (exclude primary)
  const availableSecondary = MUSIC_GENRES.filter(g => g !== primaryGenre);
  // Get available for secondary 2 (exclude primary and secondary 1)
  const availableSecondary2 = availableSecondary.filter(g => g !== secondaryGenre1);

  if (!isLeader) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Music className="h-5 w-5" />
            Band Genres
          </CardTitle>
          <CardDescription>Only the band leader can change genres</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {currentPrimaryGenre && (
              <Badge variant="default">{currentPrimaryGenre}</Badge>
            )}
            {currentSecondaryGenres?.map((genre, i) => (
              <Badge key={i} variant="secondary">{genre}</Badge>
            ))}
            {!currentPrimaryGenre && !currentSecondaryGenres?.length && (
              <span className="text-sm text-muted-foreground">No genres set</span>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Music className="h-5 w-5" />
          Band Genres
        </CardTitle>
        <CardDescription>
          Set your primary genre and up to 2 secondary genres. This affects rankings and venue matching.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Cooldown Warning */}
        {!canChange && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-warning/10 border border-warning/30 text-warning">
            <Clock className="h-4 w-4" />
            <span className="text-sm">
              Genre change locked for {daysRemaining} more day{daysRemaining !== 1 ? 's' : ''} 
              {nextChangeDate && ` (available ${formatDistanceToNow(nextChangeDate, { addSuffix: true })})`}
            </span>
          </div>
        )}

        {/* Primary Genre */}
        <div className="space-y-2">
          <Label htmlFor="primary-genre">Primary Genre *</Label>
          <Select 
            value={primaryGenre} 
            onValueChange={setPrimaryGenre}
            disabled={!canChange}
          >
            <SelectTrigger id="primary-genre">
              <SelectValue placeholder="Select primary genre" />
            </SelectTrigger>
            <SelectContent>
              {MUSIC_GENRES.map((genre) => (
                <SelectItem key={genre} value={genre}>
                  {genre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Your main genre - affects chart rankings and venue recommendations
          </p>
        </div>

        {/* Secondary Genre 1 */}
        <div className="space-y-2">
          <Label htmlFor="secondary-genre-1">Secondary Genre 1 (Optional)</Label>
          <Select 
            value={secondaryGenre1 || "__none__"} 
            onValueChange={(val) => setSecondaryGenre1(val === "__none__" ? "" : val)}
            disabled={!canChange || !primaryGenre}
          >
            <SelectTrigger id="secondary-genre-1">
              <SelectValue placeholder="Select secondary genre" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">None</SelectItem>
              {availableSecondary.map((genre) => (
                <SelectItem key={genre} value={genre}>
                  {genre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Secondary Genre 2 */}
        <div className="space-y-2">
          <Label htmlFor="secondary-genre-2">Secondary Genre 2 (Optional)</Label>
          <Select 
            value={secondaryGenre2 || "__none__"} 
            onValueChange={(val) => setSecondaryGenre2(val === "__none__" ? "" : val)}
            disabled={!canChange || !primaryGenre || !secondaryGenre1}
          >
            <SelectTrigger id="secondary-genre-2">
              <SelectValue placeholder="Select secondary genre" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">None</SelectItem>
              {availableSecondary2.map((genre) => (
                <SelectItem key={genre} value={genre}>
                  {genre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Info Box */}
        <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50 border">
          <AlertCircle className="h-4 w-4 mt-0.5 text-muted-foreground" />
          <div className="text-xs text-muted-foreground">
            <p className="font-medium mb-1">Genre Cooldown</p>
            <p>You can only change your band's genre once every {GENRE_COOLDOWN_DAYS} days. Choose wisely!</p>
          </div>
        </div>

        {/* Save Button */}
        <Button
          onClick={() => updateGenreMutation.mutate()}
          disabled={!canChange || !hasChanges || !primaryGenre || updateGenreMutation.isPending}
          className="w-full"
        >
          {updateGenreMutation.isPending ? 'Saving...' : 'Save Genres'}
        </Button>
      </CardContent>
    </Card>
  );
}
