import { useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ListMusic, Clock, CheckCircle2 } from 'lucide-react';
import { calculateSetlistDuration } from '@/utils/setlistDuration';
import { useSetlistSongs } from '@/hooks/useSetlists';

interface GigSetlistSelectorProps {
  gigId: string;
  bandId: string;
  currentSetlistId: string | null;
  setlists: Array<{
    id: string;
    name: string;
    song_count: number | null;
  }>;
  onSetlistChanged: () => void;
}

export const GigSetlistSelector = ({
  gigId,
  bandId,
  currentSetlistId,
  setlists,
  onSetlistChanged,
}: GigSetlistSelectorProps) => {
  const [selectedSetlistId, setSelectedSetlistId] = useState(currentSetlistId || '');
  const [isUpdating, setIsUpdating] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: setlistSongsData } = useSetlistSongs(selectedSetlistId || null);

  const eligibleSetlists = useMemo(
    () => setlists.filter((sl) => (sl.song_count ?? 0) >= 6),
    [setlists]
  );

  const setlistDuration = useMemo(() => {
    if (!setlistSongsData) return null;
    return calculateSetlistDuration(
      setlistSongsData.map((ss) => ({
        duration_seconds: ss.songs?.duration_seconds || 180,
      }))
    );
  }, [setlistSongsData]);

  const hasChanges = selectedSetlistId !== currentSetlistId;

  const handleUpdateSetlist = async () => {
    if (!selectedSetlistId || !hasChanges) return;

    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from('gigs')
        .update({ setlist_id: selectedSetlistId })
        .eq('id', gigId);

      if (error) throw error;

      toast({
        title: 'Setlist updated',
        description: 'The gig setlist has been changed successfully.',
      });

      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['gig', gigId] });
      onSetlistChanged();
    } catch (error: any) {
      console.error('Error updating setlist:', error);
      toast({
        title: 'Error updating setlist',
        description: error.message || 'Failed to update the setlist.',
        variant: 'destructive',
      });
    } finally {
      setIsUpdating(false);
    }
  };

  if (eligibleSetlists.length === 0) {
    return null;
  }

  const currentSetlist = setlists.find((s) => s.id === currentSetlistId);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ListMusic className="h-5 w-5" />
          Change Setlist
        </CardTitle>
        <CardDescription>
          You can change the setlist for this gig up until it starts.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Current Setlist:</span>
            <Badge variant="outline">
              {currentSetlist?.name || 'No setlist'} ({currentSetlist?.song_count || 0} songs)
            </Badge>
          </div>

          <Select
            value={selectedSetlistId}
            onValueChange={setSelectedSetlistId}
          >
            <SelectTrigger>
              <SelectValue placeholder="Choose a different setlist..." />
            </SelectTrigger>
            <SelectContent>
              {eligibleSetlists.map((setlist) => (
                <SelectItem key={setlist.id} value={setlist.id}>
                  {setlist.name} ({setlist.song_count} songs)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {selectedSetlistId && setlistDuration && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>Duration: {setlistDuration.displayTime}</span>
            </div>
          )}
        </div>

        {hasChanges && (
          <Button
            onClick={handleUpdateSetlist}
            disabled={isUpdating}
            className="w-full"
          >
            {isUpdating ? (
              'Updating...'
            ) : (
              <>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Update Setlist
              </>
            )}
          </Button>
        )}

        {!hasChanges && selectedSetlistId && (
          <p className="text-sm text-muted-foreground text-center">
            This is the current setlist for this gig.
          </p>
        )}
      </CardContent>
    </Card>
  );
};
