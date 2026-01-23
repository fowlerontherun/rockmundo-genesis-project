import { useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ListMusic, Clock, Lock, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { differenceInMinutes } from 'date-fns';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface GigSetlistDisplayProps {
  gigId: string;
  bandId: string;
  currentSetlistId: string | null;
  currentSetlistName?: string | null;
  scheduledDate: string;
  setlists: Array<{
    id: string;
    name: string;
    song_count: number | null;
  }>;
  compact?: boolean;
  onSetlistChanged?: () => void;
}

export const GigSetlistDisplay = ({
  gigId,
  bandId,
  currentSetlistId,
  currentSetlistName,
  scheduledDate,
  setlists,
  compact = false,
  onSetlistChanged,
}: GigSetlistDisplayProps) => {
  const [isUpdating, setIsUpdating] = useState(false);
  const [showSelector, setShowSelector] = useState(false);
  const queryClient = useQueryClient();

  const eligibleSetlists = useMemo(
    () => setlists.filter((sl) => (sl.song_count ?? 0) >= 6),
    [setlists]
  );

  // Calculate if we're within 1 hour of gig start
  const minutesUntilGig = differenceInMinutes(new Date(scheduledDate), new Date());
  const canChange = minutesUntilGig > 60;
  const isLocked = !canChange && minutesUntilGig > 0;

  const currentSetlist = setlists.find((s) => s.id === currentSetlistId);
  const displayName = currentSetlistName || currentSetlist?.name || 'No setlist';

  const handleUpdateSetlist = async (newSetlistId: string) => {
    if (!canChange || isUpdating) return;

    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from('gigs')
        .update({ setlist_id: newSetlistId })
        .eq('id', gigId);

      if (error) throw error;

      toast.success('Setlist updated successfully');
      queryClient.invalidateQueries({ queryKey: ['gig', gigId] });
      queryClient.invalidateQueries({ queryKey: ['scheduled-activities'] });
      queryClient.invalidateQueries({ queryKey: ['tour-venues'] });
      setShowSelector(false);
      onSetlistChanged?.();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update setlist');
    } finally {
      setIsUpdating(false);
    }
  };

  if (compact) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1.5 text-xs">
              <ListMusic className="h-3 w-3 text-muted-foreground" />
              <span className="text-muted-foreground truncate max-w-[120px]">
                {displayName}
              </span>
              {isLocked && <Lock className="h-3 w-3 text-warning" />}
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>Setlist: {displayName}</p>
            {isLocked && <p className="text-warning">Locked (within 1 hour of gig)</p>}
            {canChange && <p className="text-muted-foreground">Click to change</p>}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ListMusic className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Setlist:</span>
          <Badge variant="outline" className="text-xs">
            {displayName}
            {currentSetlist?.song_count && ` (${currentSetlist.song_count} songs)`}
          </Badge>
        </div>
        
        {isLocked ? (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1 text-xs text-warning">
                  <Lock className="h-3 w-3" />
                  <span>Locked</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Cannot change setlist within 1 hour of gig start</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : canChange && eligibleSetlists.length > 1 ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowSelector(!showSelector)}
            className="text-xs h-7"
          >
            Change
          </Button>
        ) : null}
      </div>

      {showSelector && canChange && (
        <div className="flex items-center gap-2">
          <Select
            value={currentSetlistId || ''}
            onValueChange={handleUpdateSetlist}
            disabled={isUpdating}
          >
            <SelectTrigger className="h-8 text-xs flex-1">
              <SelectValue placeholder="Select setlist..." />
            </SelectTrigger>
            <SelectContent>
              {eligibleSetlists.map((setlist) => (
                <SelectItem key={setlist.id} value={setlist.id}>
                  {setlist.name} ({setlist.song_count} songs)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowSelector(false)}
            className="h-8 text-xs"
          >
            Cancel
          </Button>
        </div>
      )}

      {!currentSetlistId && (
        <div className="flex items-center gap-1 text-xs text-destructive">
          <AlertCircle className="h-3 w-3" />
          <span>No setlist assigned - gig cannot start</span>
        </div>
      )}
    </div>
  );
};
