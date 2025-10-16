import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { DollarSign, Clock, TrendingUp, Music2, Zap } from 'lucide-react';
import type { Database } from '@/lib/supabase-types';
import { cn } from '@/lib/utils';

type RehearsalRoom = Database['public']['Tables']['rehearsal_rooms']['Row'];
type Band = Database['public']['Tables']['bands']['Row'];

interface RehearsalBookingDialogProps {
  rooms: RehearsalRoom[];
  band: Band;
  songs: any[];
  onConfirm: (roomId: string, duration: number, songId: string, scheduledStart: Date) => Promise<void>;
  onClose: () => void;
}

const DURATION_OPTIONS = [
  { value: 1, label: '1 Hour', multiplier: 1 },
  { value: 2, label: '2 Hours', multiplier: 2 },
  { value: 4, label: '4 Hours', multiplier: 4 },
  { value: 8, label: '8 Hours (Full Day)', multiplier: 8 },
];

export const RehearsalBookingDialog = ({ rooms, band, songs, onConfirm, onClose }: RehearsalBookingDialogProps) => {
  const [selectedRoomId, setSelectedRoomId] = useState<string>('');
  const [selectedDuration, setSelectedDuration] = useState<number>(2);
  const [selectedSongId, setSelectedSongId] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [booking, setBooking] = useState(false);

  const selectedRoom = rooms.find(r => r.id === selectedRoomId);
  const totalCost = selectedRoom ? selectedRoom.hourly_rate * selectedDuration : 0;
  const chemistryGain = selectedRoom ? Math.floor((selectedRoom.quality_rating / 10) * selectedDuration) : 0;
  const xpGain = selectedRoom ? Math.floor(50 * selectedDuration * (selectedRoom.equipment_quality / 100)) : 0;
  const familiarityGain = selectedDuration * 60;

  const handleConfirm = async () => {
    if (!selectedRoomId || !selectedSongId) return;
    
    setBooking(true);
    try {
      await onConfirm(selectedRoomId, selectedDuration, selectedSongId, selectedDate);
    } finally {
      setBooking(false);
    }
  };

  const canAfford = (band.band_balance || 0) >= totalCost;

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
          {/* Date Selection */}
          <div className="space-y-2">
            <Label>Rehearsal Date</Label>
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(date) => date && setSelectedDate(date)}
              disabled={(date) => date < new Date()}
              className="rounded-md border"
            />
          </div>

          {/* Room Selection */}
          <div className="space-y-2">
            <Label>Select Rehearsal Room</Label>
            <RadioGroup value={selectedRoomId} onValueChange={setSelectedRoomId}>
              {rooms.map((room) => (
                <div
                  key={room.id}
                  className={cn(
                    'flex items-start space-x-3 rounded-lg border p-4 transition-colors',
                    selectedRoomId === room.id && 'border-primary bg-primary/5'
                  )}
                >
                  <RadioGroupItem value={room.id} />
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="font-semibold">{room.name}</Label>
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
              <SelectContent>
                {DURATION_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value.toString()}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Song Selection */}
          <div className="space-y-2">
            <Label htmlFor="song">Song to Practice</Label>
            <Select value={selectedSongId} onValueChange={setSelectedSongId}>
              <SelectTrigger id="song">
                <SelectValue placeholder="Choose a song..." />
              </SelectTrigger>
              <SelectContent>
                {songs.length === 0 ? (
                  <div className="p-2 text-sm text-muted-foreground">
                    No completed songs available
                  </div>
                ) : (
                  songs.map((song) => (
                    <SelectItem key={song.id} value={song.id}>
                      {song.title}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

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
            disabled={!selectedRoomId || !selectedSongId || !canAfford || booking}
          >
            {booking ? 'Booking...' : `Book Rehearsal ($${totalCost})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
