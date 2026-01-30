import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { DollarSign, Clock, TrendingUp, Music2, Zap, AlertCircle, CheckCircle, MapPin, Ban } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format, isSameDay } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import type { Database } from '@/lib/supabase-types';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { getRehearsalLevel, formatRehearsalTime } from '@/utils/rehearsalLevels';
import { REHEARSAL_SLOTS, getSlotTimeRange, FacilitySlot } from '@/utils/facilitySlots';
import { useRehearsalRoomAvailability } from '@/hooks/useRehearsalRoomAvailability';
import { isSlotInPast } from '@/utils/timeSlotValidation';

type RehearsalRoom = Database['public']['Tables']['rehearsal_rooms']['Row'] & {
  city?: { id: string; name: string } | null;
};
type Band = Database['public']['Tables']['bands']['Row'];
type City = { id: string; name: string };

interface RehearsalBookingDialogProps {
  rooms: RehearsalRoom[];
  cities: City[];
  currentCityId: string | null;
  band: Band;
  songs: any[];
  onConfirm: (roomId: string, duration: number, songId: string | null, setlistId: string | null, scheduledStart: Date) => Promise<string | void>;
  onClose: () => void;
}

export const RehearsalBookingDialog = ({ rooms, cities, currentCityId, band, songs, onConfirm, onClose }: RehearsalBookingDialogProps) => {
  const [selectedCityId, setSelectedCityId] = useState<string>(currentCityId || 'all');
  const [selectedRoomId, setSelectedRoomId] = useState<string>('');
  const [selectedDuration, setSelectedDuration] = useState<number>(2);
  const [practiceType, setPracticeType] = useState<'song' | 'setlist'>('song');
  const [selectedSongId, setSelectedSongId] = useState<string>('');
  const [selectedSetlistId, setSelectedSetlistId] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedSlotId, setSelectedSlotId] = useState<string>('');
  const [booking, setBooking] = useState(false);
  const [setlists, setSetlists] = useState<any[]>([]);
  const [songFamiliarity, setSongFamiliarity] = useState<Record<string, number>>({});

  // Filter rooms by selected city
  const filteredRooms = selectedCityId === 'all' 
    ? rooms 
    : rooms.filter(room => room.city_id === selectedCityId);

  // Fetch slot availability for the selected room and date
  const { data: slotAvailability, isLoading: loadingSlots } = useRehearsalRoomAvailability(
    selectedRoomId,
    selectedDate,
    band.id,
    !!selectedRoomId
  );

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

  // Calculate how many consecutive slots are needed for the selected duration
  const slotsNeeded = Math.ceil(selectedDuration / 2);

  const selectedRoom = rooms.find(r => r.id === selectedRoomId);
  const totalCost = selectedRoom ? selectedRoom.hourly_rate * selectedDuration : 0;
  const chemistryGain = selectedRoom ? Math.floor((selectedRoom.quality_rating / 10) * selectedDuration) : 0;
  const xpGain = selectedRoom ? Math.floor(50 * selectedDuration * (selectedRoom.equipment_quality / 100)) : 0;
  const familiarityGain = selectedDuration * 60;

  // Check if a slot has passed (for today only)
  const isSlotPast = (slotId: string): boolean => {
    const slot = REHEARSAL_SLOTS.find(s => s.id === slotId);
    if (!slot) return false;
    return isSlotInPast(slot, selectedDate);
  };

  // Check if consecutive slots are available for the selected duration
  const canBookSlot = (slotId: string): boolean => {
    if (!slotAvailability) return false;
    
    const slotIndex = REHEARSAL_SLOTS.findIndex(s => s.id === slotId);
    if (slotIndex === -1) return false;

    // Check if the first slot has already passed
    const firstSlot = REHEARSAL_SLOTS[slotIndex];
    if (isSlotInPast(firstSlot, selectedDate)) return false;

    // Check if we have enough consecutive available slots
    for (let i = 0; i < slotsNeeded; i++) {
      const checkIndex = slotIndex + i;
      if (checkIndex >= REHEARSAL_SLOTS.length) return false;
      
      const checkSlotId = REHEARSAL_SLOTS[checkIndex].id;
      const slotData = slotAvailability.find(s => s.slot.id === checkSlotId);
      if (!slotData || !slotData.isAvailable) return false;
    }
    
    return true;
  };

  const handleConfirm = async () => {
    if (!selectedRoomId || !selectedSlotId) return;
    if (practiceType === 'song' && !selectedSongId) return;
    if (practiceType === 'setlist' && !selectedSetlistId) return;
    
    setBooking(true);
    try {
      // Get the slot and calculate start time
      const slot = REHEARSAL_SLOTS.find(s => s.id === selectedSlotId);
      if (!slot) throw new Error('Invalid slot');

      const { start } = getSlotTimeRange(slot, selectedDate);
      
      await onConfirm(
        selectedRoomId,
        selectedDuration,
        practiceType === 'song' ? selectedSongId : null,
        practiceType === 'setlist' ? selectedSetlistId : null,
        start
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
    selectedSlotId &&
    ((practiceType === 'song' && selectedSongId) || (practiceType === 'setlist' && selectedSetlistId)) &&
    canAfford &&
    canBookSlot(selectedSlotId);

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
          {/* City Filter */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Filter by City
            </Label>
            <Select value={selectedCityId} onValueChange={(v) => { setSelectedCityId(v); setSelectedRoomId(''); setSelectedSlotId(''); }}>
              <SelectTrigger>
                <SelectValue placeholder="Select a city..." />
              </SelectTrigger>
              <SelectContent className="bg-background">
                <SelectItem value="all">All Cities</SelectItem>
                {cities.map((city) => (
                  <SelectItem key={city.id} value={city.id}>
                    {city.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Room Selection */}
          <div className="space-y-2">
            <Label>Select Rehearsal Room</Label>
            {filteredRooms.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No rehearsal rooms available in this city.
              </p>
            ) : (
              <RadioGroup value={selectedRoomId} onValueChange={(v) => { setSelectedRoomId(v); setSelectedSlotId(''); }}>
                {filteredRooms.map((room) => (
                  <div
                    key={room.id}
                    className={cn(
                      'flex items-start space-x-3 rounded-lg border p-4 transition-colors cursor-pointer',
                      selectedRoomId === room.id && 'border-primary bg-primary/5'
                    )}
                    onClick={() => { setSelectedRoomId(room.id); setSelectedSlotId(''); }}
                  >
                    <RadioGroupItem value={room.id} />
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="font-semibold cursor-pointer">{room.name}</Label>
                        <Badge variant="outline">${room.hourly_rate}/hr</Badge>
                      </div>
                      {room.city && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {room.city.name}
                        </p>
                      )}
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
            )}
          </div>

          {/* Date Selection */}
          {selectedRoomId && (
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
                    onSelect={(date) => { if (date) { setSelectedDate(date); setSelectedSlotId(''); } }}
                    disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>
          )}

          {/* Duration Selection */}
          {selectedRoomId && (
            <div className="space-y-2">
              <Label htmlFor="duration">Duration</Label>
              <Select value={selectedDuration.toString()} onValueChange={(v) => { setSelectedDuration(parseInt(v)); setSelectedSlotId(''); }}>
                <SelectTrigger id="duration">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-background">
                  <SelectItem value="2">2 Hours (1 slot)</SelectItem>
                  <SelectItem value="4">4 Hours (2 slots)</SelectItem>
                  <SelectItem value="6">6 Hours (3 slots)</SelectItem>
                  <SelectItem value="8">8 Hours (4 slots)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Requires {slotsNeeded} consecutive slot{slotsNeeded > 1 ? 's' : ''}
              </p>
            </div>
          )}

          {/* Time Slot Selection */}
          {selectedRoomId && (
            <div className="space-y-2">
              <Label>Time Slot</Label>
              {loadingSlots ? (
                <div className="flex justify-center py-4">
                  <div className="h-6 w-6 animate-spin rounded-full border-b-2 border-primary" />
                </div>
              ) : (
                <RadioGroup value={selectedSlotId} onValueChange={setSelectedSlotId}>
                  <div className="grid grid-cols-2 gap-2">
                  {REHEARSAL_SLOTS.map((slot) => {
                      const slotData = slotAvailability?.find(s => s.slot.id === slot.id);
                      const isBooked = slotData?.isBooked || false;
                      const isYourBooking = slotData?.isYourBooking || false;
                      const bookedBy = slotData?.bookedByBand;
                      const isPast = isSlotPast(slot.id);
                      const canSelect = canBookSlot(slot.id);

                      return (
                        <div
                          key={slot.id}
                          className={cn(
                            'flex items-center space-x-2 rounded-lg border p-3 transition-colors',
                            selectedSlotId === slot.id && 'border-primary bg-primary/5',
                            isPast && 'bg-muted/50 border-muted opacity-60 cursor-not-allowed',
                            isBooked && !isYourBooking && !isPast && 'bg-red-500/10 border-red-500/30',
                            isYourBooking && !isPast && 'bg-blue-500/10 border-blue-500/30',
                            !canSelect && !isPast && 'opacity-50 cursor-not-allowed',
                            canSelect && 'cursor-pointer hover:bg-accent/50'
                          )}
                          onClick={() => canSelect && setSelectedSlotId(slot.id)}
                        >
                          <RadioGroupItem value={slot.id} disabled={!canSelect} />
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <Label className={cn(
                                "text-sm font-medium",
                                canSelect && "cursor-pointer",
                                isPast && "text-muted-foreground"
                              )}>{slot.name}</Label>
                              {isPast ? (
                                <Badge variant="secondary" className="text-xs">
                                  <Ban className="h-3 w-3 mr-1" />
                                  Passed
                                </Badge>
                              ) : isBooked ? (
                                <Badge variant="destructive" className="text-xs">
                                  {isYourBooking ? 'Your booking' : 'Booked'}
                                </Badge>
                              ) : canSelect ? (
                                <Badge variant="outline" className="text-xs bg-green-500/10 text-green-700 dark:text-green-400">
                                  <CheckCircle className="h-3 w-3 mr-1" />
                                  Available
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-xs">
                                  Unavailable
                                </Badge>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                              <Clock className="h-3 w-3" />
                              {slot.startTime} - {slot.endTime}
                            </div>
                            {bookedBy && !isYourBooking && !isPast && (
                              <p className="text-xs text-destructive mt-1">{bookedBy}</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </RadioGroup>
              )}
            </div>
          )}

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
          {selectedRoom && selectedSlotId && (
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
                      Time
                    </span>
                    <span className="font-medium">
                      {format(selectedDate, 'MMM d')} at {REHEARSAL_SLOTS.find(s => s.id === selectedSlotId)?.startTime}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground flex items-center gap-2">
                      <DollarSign className="h-4 w-4" />
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
                    <span className="font-semibold text-purple-500">
                      +{familiarityGain} min {practiceType === 'song' ? '' : '(total)'}
                    </span>
                  </div>
                  
                  {/* Setlist time-split explanation */}
                  {practiceType === 'setlist' && selectedSetlistId && (
                    <div className="mt-3 pt-3 border-t border-border">
                      <p className="text-xs text-muted-foreground">
                        <strong>Note:</strong> Time is split across all songs in the setlist. 
                        A {selectedDuration}h session with multiple songs = less time per song.
                      </p>
                      <p className="text-xs text-primary mt-1">
                        💡 Tip: 6 hours of practice per song = Perfected level
                      </p>
                    </div>
                  )}
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
            <p className="text-sm text-destructive flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
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
