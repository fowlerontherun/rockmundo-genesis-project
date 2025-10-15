import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/use-auth-context';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Music2, Clock, DollarSign, TrendingUp, AlertCircle } from 'lucide-react';
import type { Database } from '@/lib/supabase-types';

type RehearsalRoom = Database['public']['Tables']['rehearsal_rooms']['Row'];
type BandRehearsal = Database['public']['Tables']['band_rehearsals']['Row'];
type Band = Database['public']['Tables']['bands']['Row'];

export function RehearsalsTab() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(false);
  const [rooms, setRooms] = useState<RehearsalRoom[]>([]);
  const [userBand, setUserBand] = useState<Band | null>(null);
  const [activeRehearsal, setActiveRehearsal] = useState<BandRehearsal | null>(null);
  const [selectedRoom, setSelectedRoom] = useState<string>('');
  const [duration, setDuration] = useState<string>('2');

  const loadData = useCallback(async () => {
    if (!user?.id) return;

    setLoading(true);
    try {
      // Load rehearsal rooms
      const { data: roomsData, error: roomsError } = await supabase
        .from('rehearsal_rooms')
        .select('*')
        .order('name');

      if (roomsError) throw roomsError;
      setRooms(roomsData || []);

      // Get user's band (first one if multiple)
      const { data: bandMembers, error: memberError } = await supabase
        .from('band_members')
        .select('band_id, bands:bands!band_members_band_id_fkey(*)')
        .eq('user_id', user.id)
        .limit(1);

      if (memberError) throw memberError;

      if (bandMembers && bandMembers.length > 0) {
        const band = (bandMembers[0] as any).bands;
        setUserBand(band);

        // Check for active rehearsal
        const { data: rehearsal, error: rehearsalError } = await supabase
          .from('band_rehearsals')
          .select('*')
          .eq('band_id', band.id)
          .eq('status', 'in_progress')
          .maybeSingle();

        if (rehearsalError) throw rehearsalError;
        setActiveRehearsal(rehearsal);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load rehearsal data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [user?.id, toast]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleBookRehearsal = async () => {
    if (!userBand || !selectedRoom || !duration) {
      toast({
        title: 'Missing Information',
        description: 'Please select a rehearsal room and duration',
        variant: 'destructive',
      });
      return;
    }

    const room = rooms.find((r) => r.id === selectedRoom);
    if (!room) return;

    const durationHours = parseInt(duration);
    const totalCost = room.hourly_rate * durationHours;
    
    // Ensure band_balance is treated as a number and defaults to 0
    const currentBalance = typeof userBand.band_balance === 'number' ? userBand.band_balance : 0;

    if (currentBalance < totalCost) {
      toast({
        title: 'Insufficient Funds',
        description: `Your band needs $${totalCost} to book this rehearsal. Current balance: $${currentBalance}`,
        variant: 'destructive',
      });
      return;
    }

    setBooking(true);
    try {
      const now = new Date();
      const endTime = new Date(now.getTime() + durationHours * 60 * 60 * 1000);

      // Calculate rewards based on room quality and duration
      const chemistryGain = Math.floor((room.quality_rating / 10) * durationHours);
      const xpEarned = Math.floor(50 * durationHours * (room.equipment_quality / 100));

      // Create rehearsal
      const { error: rehearsalError } = await supabase
        .from('band_rehearsals')
        .insert([{
          band_id: userBand.id,
          rehearsal_room_id: selectedRoom,
          duration_hours: durationHours,
          scheduled_start: now.toISOString(),
          scheduled_end: endTime.toISOString(),
          total_cost: totalCost,
          chemistry_gain: chemistryGain,
          xp_earned: xpEarned,
        }]);

      if (rehearsalError) throw rehearsalError;

      // Deduct cost from band balance (ensure we use the current balance)
      const newBalance = currentBalance - totalCost;
      const { error: balanceError } = await supabase
        .from('bands')
        .update({ band_balance: newBalance })
        .eq('id', userBand.id);

      if (balanceError) throw balanceError;

      toast({
        title: 'Rehearsal Booked!',
        description: `Your band is now rehearsing for ${durationHours} hours`,
      });

      loadData();
    } catch (error) {
      console.error('Error booking rehearsal:', error);
      toast({
        title: 'Error',
        description: 'Failed to book rehearsal',
        variant: 'destructive',
      });
    } finally {
      setBooking(false);
    }
  };

  const handleCompleteRehearsal = async () => {
    if (!activeRehearsal || !userBand) return;

    try {
      // Mark rehearsal as completed
      const { error: updateError } = await supabase
        .from('band_rehearsals')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', activeRehearsal.id);

      if (updateError) throw updateError;

      // Update band chemistry
      const { error: chemistryError } = await supabase
        .from('bands')
        .update({
          chemistry_level: Math.min(100, (userBand.chemistry_level || 0) + activeRehearsal.chemistry_gain),
        })
        .eq('id', userBand.id);

      if (chemistryError) throw chemistryError;

      toast({
        title: 'Rehearsal Complete!',
        description: `Gained ${activeRehearsal.chemistry_gain} chemistry and ${activeRehearsal.xp_earned} XP`,
      });

      loadData();
    } catch (error) {
      console.error('Error completing rehearsal:', error);
      toast({
        title: 'Error',
        description: 'Failed to complete rehearsal',
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    );
  }

  if (!userBand) {
    return (
      <div className="rounded-lg border border-dashed p-10 text-center">
        <Music2 className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
        <h3 className="text-lg font-semibold">No Band Found</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          You need to be in a band to book rehearsals.
        </p>
      </div>
    );
  }

  if (activeRehearsal) {
    const endTime = new Date(activeRehearsal.scheduled_end);
    const now = new Date();
    const canComplete = now >= endTime;

    return (
      <Card>
        <CardHeader>
          <CardTitle>Active Rehearsal</CardTitle>
          <CardDescription>Your band is currently rehearsing</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-semibold">Duration:</span>
              <span>{activeRehearsal.duration_hours} hours</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-semibold">Ends at:</span>
              <span>{endTime.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-semibold">Chemistry Gain:</span>
              <span className="text-green-500">+{activeRehearsal.chemistry_gain}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-semibold">XP Earned:</span>
              <span className="text-blue-500">+{activeRehearsal.xp_earned}</span>
            </div>
          </div>

          {canComplete ? (
            <Button onClick={handleCompleteRehearsal} className="w-full">
              Complete Rehearsal
            </Button>
          ) : (
            <div className="flex items-center gap-2 rounded-lg bg-muted p-3 text-sm">
              <AlertCircle className="h-4 w-4" />
              <span>Rehearsal in progress. Come back when it's complete!</span>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  const selectedRoomData = rooms.find((r) => r.id === selectedRoom);
  const totalCost = selectedRoomData ? selectedRoomData.hourly_rate * parseInt(duration) : 0;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Book a Rehearsal</CardTitle>
          <CardDescription>
            Improve your band's chemistry and gig readiness through practice
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="room">Rehearsal Room</Label>
            <Select value={selectedRoom} onValueChange={setSelectedRoom}>
              <SelectTrigger id="room">
                <SelectValue placeholder="Select a rehearsal room" />
              </SelectTrigger>
              <SelectContent>
                {rooms.map((room) => (
                  <SelectItem key={room.id} value={room.id}>
                    {room.name} - ${room.hourly_rate}/hr (Quality: {room.quality_rating})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="duration">Duration</Label>
            <Select value={duration} onValueChange={setDuration}>
              <SelectTrigger id="duration">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2">2 Hours</SelectItem>
                <SelectItem value="4">4 Hours</SelectItem>
                <SelectItem value="6">6 Hours</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {selectedRoomData && (
            <div className="rounded-lg border p-4 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Total Cost
                </span>
                <span className="font-semibold">${totalCost}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Est. Chemistry Gain
                </span>
                <span className="text-green-500">
                  +{Math.floor((selectedRoomData.quality_rating / 10) * parseInt(duration))}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Est. XP
                </span>
                <span className="text-blue-500">
                  +{Math.floor(50 * parseInt(duration) * (selectedRoomData.equipment_quality / 100))}
                </span>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between rounded-lg bg-muted p-3 text-sm">
            <span>Band Balance:</span>
            <span className="font-semibold">${userBand.band_balance}</span>
          </div>

          <Button
            onClick={handleBookRehearsal}
            disabled={booking || !selectedRoom || totalCost > userBand.band_balance}
            className="w-full"
          >
            {booking ? 'Booking...' : `Book Rehearsal ($${totalCost})`}
          </Button>
        </CardContent>
      </Card>

      {rooms.length === 0 && (
        <div className="rounded-lg border border-dashed p-10 text-center">
          <Music2 className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
          <h3 className="text-lg font-semibold">No Rehearsal Rooms Available</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Check back later for available rehearsal spaces.
          </p>
        </div>
      )}
    </div>
  );
}
