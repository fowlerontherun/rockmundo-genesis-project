import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { DollarSign, Clock, TrendingUp, Music2, Zap } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import type { Database } from '@/lib/supabase-types';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { getRehearsalLevel, formatRehearsalTime } from '@/utils/rehearsalLevels';

type RehearsalRoom = Database['public']['Tables']['rehearsal_rooms']['Row'];
type Band = Database['public']['Tables']['bands']['Row'];

interface RehearsalBookingDialogProps {
  rooms: RehearsalRoom[];
  band: Band;
  songs: any[];
  onConfirm: (roomId: string, duration: number, songId: string | null, setlistId: string | null, scheduledStart: Date) => Promise<string | void>;
  onClose: () => void;
}

const DURATION_OPTIONS = [
  { value: 1, label: '1 Hour' },
  { value: 2, label: '2 Hours' },
  { value: 3, label: '3 Hours' },
  { value: 4, label: '4 Hours' },
  { value: 6, label: '6 Hours' },
  { value: 8, label: '8 Hours (Full Day)' },
];

const TIME_OPTIONS = Array.from({ length: 24 }, (_, i) => ({
  value: i,
  label: `${i.toString().padStart(2, '0')}:00`,
}));

export const RehearsalBookingDialog = ({ rooms, band, songs, onConfirm, onClose }: RehearsalBookingDialogProps) => {
  const [selectedRoomId, setSelectedRoomId] = useState<string>('');
  const [selectedDuration, setSelectedDuration] = useState<number>(2);
  const [practiceType, setPracticeType] = useState<'song' | 'setlist'>('song');
  const [selectedSongId, setSelectedSongId] = useState<string>('');
  const [selectedSetlistId, setSelectedSetlistId] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedTime, setSelectedTime] = useState<number>(14); // 2 PM default
  const [booking, setBooking] = useState(false);
  const [setlists, setSetlists] = useState<any[]>([]);
  const [songFamiliarity, setSongFamiliarity] = useState<Record<string, number>>({});

  useEffect(() => {
    const loadSetlists = async () => {
      const { data } = await supabase
        .from('setlists')
        .select('id, name')
        .eq('band_id', band.id)
        .eq('is_active', true);
      
      setSetlists(data || []);
    };
    
    loadSetlists();
  }, [band.id]);

  // Fetch familiarity data for all songs
  useEffect(() => {
    const loadFamiliarity = async () => {
      if (!songs.length || !band.id) return;
      
      const songIds = songs.map(s => s.id);
      const { data } = await supabase
        .from('band_song_familiarity')
        .select('song_id, familiarity_minutes')
        .eq('band_id', band.id)
        .in('song_id', songIds);
      
      const familiarityMap: Record<string, number> = {};
      data?.forEach(item => {
        familiarityMap[item.song_id] = item.familiarity_minutes;
      });
      setSongFamiliarity(familiarityMap);
    };
    
    loadFamiliarity();
  }, [songs, band.id]);

  const selectedRoom = rooms.find(r => r.id === selectedRoomId);
  const totalCost = selectedRoom ? selectedRoom.hourly_rate * selectedDuration : 0;
  const chemistryGain = selectedRoom ? Math.floor((selectedRoom.quality_rating / 10) * selectedDuration) : 0;
  const xpGain = selectedRoom ? Math.floor(50 * selectedDuration * (selectedRoom.equipment_quality / 100)) : 0;
  const familiarityGain = selectedDuration * 60;

  const handleConfirm = async () => {
    if (!selectedRoomId) return;
    if (practiceType === 'song' && !selectedSongId) return;
    if (practiceType === 'setlist' && !selectedSetlistId) return;
    
    setBooking(true);
    try {
      // Combine date and time
      const scheduledStart = new Date(selectedDate);
      scheduledStart.setHours(selectedTime, 0, 0, 0);
      
      await onConfirm(
        selectedRoomId,
        selectedDuration,
        practiceType === 'song' ? selectedSongId : null,
        practiceType === 'setlist' ? selectedSetlistId : null,
        scheduledStart
      );
      
      onClose();
    } catch (error) {
      console.error('Failed to book rehearsal:', error);
    } finally {
      setBooking(false);
    }
  };

  const canAfford = (band.band_balance || 0) >= totalCost;
  const canBook = selectedRoomId && 
    ((practiceType === 'song' && selectedSongId) || (practiceType === 'setlist' && selectedSetlistId)) &&
    canAfford;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[700px]">
        <DialogHeader>
          <DialogTitle>Book a Rehearsal</DialogTitle>
          <DialogDescription>
            Improve your band's chemistry and song familiarity through practice.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Date & Time Selection */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Rehearsal Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal',
                      !selectedDate && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {selectedDate ? format(selectedDate, 'PPP') : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={(date) => date && setSelectedDate(date)}
                    disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label htmlFor="time">Start Time</Label>
              <Select value={selectedTime.toString()} onValueChange={(v) => setSelectedTime(parseInt(v))}>
                <SelectTrigger id="time">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-background">
                  {TIME_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value.toString()}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Room Selection */}
          <div className="space-y-2">
            <Label>Select Rehearsal Room</Label>
            <RadioGroup value={selectedRoomId} onValueChange={setSelectedRoomId}>
              {rooms.map((room) => (
                <div
                  key={room.id}
                  className={cn(
                    'flex items-start space-x-3 rounded-lg border p-4 transition-colors cursor-pointer',
                    selectedRoomId === room.id && 'border-primary bg-primary/5'
                  )}
                  onClick={() => setSelectedRoomId(room.id)}
                >
                  <RadioGroupItem value={room.id} />
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="font-semibold cursor-pointer">{room.name}</Label>
                      <Badge variant="outline">${room.hourly_rate}/hr</Badge>
                    </div>
                    {room.description && (
                      <p className="text-sm text-muted-foreground">{room.description}</p>
                    )}
                    <div className="flex gap-3 text-xs text-muted-foreground">
                      <span>Quality: {room.quality_rating}/100</span>
                      <span>Equipment: {room.equipment_quality}/100</span>
                      <span>Capacity: {room.capacity}</span>
                    </div>
                  </div>
                </div>
              ))}
            </RadioGroup>

            {rooms.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                No rehearsal rooms available. Contact an admin.
              </p>
            )}
          </div>

          {/* Duration Selection */}
          <div className="space-y-2">
            <Label htmlFor="duration">Duration</Label>
            <Select value={selectedDuration.toString()} onValueChange={(v) => setSelectedDuration(parseInt(v))}>
              <SelectTrigger id="duration">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-background">
                {DURATION_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value.toString()}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Practice Type Selection */}
          <div className="space-y-2">
            <Label>What to Practice</Label>
            <RadioGroup value={practiceType} onValueChange={(v: any) => setPracticeType(v)}>
              <div className="flex gap-4">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="song" id="type-song" />
                  <Label htmlFor="type-song" className="cursor-pointer">Single Song</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="setlist" id="type-setlist" />
                  <Label htmlFor="type-setlist" className="cursor-pointer">Entire Setlist</Label>
                </div>
              </div>
            </RadioGroup>
          </div>

          {/* Song/Setlist Selection */}
          {practiceType === 'song' ? (
            <div className="space-y-2">
              <Label htmlFor="song">Song to Practice</Label>
              <Select value={selectedSongId} onValueChange={setSelectedSongId}>
                <SelectTrigger id="song">
                  <SelectValue placeholder="Choose a song..." />
                </SelectTrigger>
                <SelectContent className="bg-background max-h-[300px]">
                  {songs.length === 0 ? (
                    <div className="p-2 text-sm text-muted-foreground">
                      No songs available - complete a song first!
                    </div>
                  ) : (
                    songs.map((song) => {
                      const minutes = songFamiliarity[song.id] || 0;
                      const level = getRehearsalLevel(minutes);
                      return (
                        <SelectItem key={song.id} value={song.id} className="py-2">
                          <div className="flex items-center justify-between gap-3 w-full">
                            <span className="truncate">{song.title}</span>
                            <Badge 
                              variant={level.variant} 
                              className="text-xs shrink-0 ml-auto"
                            >
                              {level.name}
                            </Badge>
                          </div>
                        </SelectItem>
                      );
                    })
                  )}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="setlist">Setlist to Practice</Label>
              <Select value={selectedSetlistId} onValueChange={setSelectedSetlistId}>
                <SelectTrigger id="setlist">
                  <SelectValue placeholder="Choose a setlist..." />
                </SelectTrigger>
                <SelectContent className="bg-background">
                  {setlists.length === 0 ? (
                    <div className="p-2 text-sm text-muted-foreground">
                      No active setlists available
                    </div>
                  ) : (
                    setlists.map((setlist) => (
                      <SelectItem key={setlist.id} value={setlist.id}>
                        {setlist.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Cost & Benefits Preview */}
          {selectedRoom && (
            <Card className="bg-muted/50">
              <CardContent className="pt-6">
                <h4 className="font-semibold mb-4 flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Rehearsal Summary
                </h4>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      Total Cost
                    </span>
                    <span className="font-bold">${totalCost}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground flex items-center gap-2">
                      <TrendingUp className="h-4 w-4" />
                      Chemistry Gain
                    </span>
                    <span className="font-semibold text-green-500">+{chemistryGain}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground flex items-center gap-2">
                      <Zap className="h-4 w-4" />
                      XP Earned
                    </span>
                    <span className="font-semibold text-blue-500">+{xpGain}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground flex items-center gap-2">
                      <Music2 className="h-4 w-4" />
                      Song Familiarity
                    </span>
                    <span className="font-semibold text-purple-500">+{familiarityGain} min</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Band Balance */}
          <div className="flex items-center justify-between rounded-lg bg-muted p-3 text-sm">
            <span>Band Balance:</span>
            <span className={cn('font-semibold', !canAfford && 'text-destructive')}>
              ${band.band_balance || 0}
            </span>
          </div>

          {!canAfford && (
            <p className="text-sm text-destructive">
              Insufficient funds. Your band needs ${totalCost - (band.band_balance || 0)} more.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={booking}>
            Cancel
          </Button>
          <Button 
            onClick={handleConfirm} 
            disabled={!canBook || booking}
          >
            {booking ? 'Booking...' : `Book Rehearsal ($${totalCost})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};