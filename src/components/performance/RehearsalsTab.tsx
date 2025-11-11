import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/use-auth-context';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Music2, Plus } from 'lucide-react';
import type { Database } from '@/lib/supabase-types';
import { RehearsalBookingDialog } from './RehearsalBookingDialog';
import { format } from 'date-fns';

type RehearsalRoom = Database['public']['Tables']['rehearsal_rooms']['Row'];
type BandRehearsal = Database['public']['Tables']['band_rehearsals']['Row'] & {
  rehearsal_rooms?: RehearsalRoom | null;
  songs?: { title: string } | null;
};
type Band = Database['public']['Tables']['bands']['Row'];

export function RehearsalsTab() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [userBand, setUserBand] = useState<Band | null>(null);
  const [rehearsals, setRehearsals] = useState<BandRehearsal[]>([]);
  const [showBookingDialog, setShowBookingDialog] = useState(false);
  const [rooms, setRooms] = useState<RehearsalRoom[]>([]);
  const [bandSongs, setBandSongs] = useState<any[]>([]);

  const loadData = useCallback(async () => {
    if (!user?.id) return;

    setLoading(true);
    try {
      // Get user's band with full details (specify the FK relationship)
      const { data: bandMembers, error: memberError } = await supabase
        .from('band_members')
        .select('bands!band_members_band_id_fkey(*)')
        .eq('user_id', user.id)
        .order('joined_at', { ascending: false });

      if (memberError) throw memberError;

      if (bandMembers && bandMembers.length > 0) {
        // Find the first active band, or just use the first one
        const activeBand = bandMembers.find((bm: any) => bm.bands?.status === 'active');
        const selectedBandMember = activeBand || bandMembers[0];
        const bandData = (selectedBandMember as any).bands;
        
        if (!bandData) {
          throw new Error('Band data not found');
        }
        
        console.log('Band data loaded:', { name: bandData.name, balance: bandData.band_balance });
        setUserBand(bandData);

        // Load scheduled rehearsals
        const { data: rehearsalData, error: rehearsalError } = await supabase
          .from('band_rehearsals')
          .select(`
            *,
            rehearsal_rooms:rehearsal_room_id (*),
            songs:selected_song_id (title)
          `)
          .eq('band_id', bandData.id)
          .order('scheduled_start', { ascending: true });

        if (rehearsalError) throw rehearsalError;
        setRehearsals(rehearsalData || []);

        // Load rehearsal rooms
        const { data: roomsData, error: roomsError } = await supabase
          .from('rehearsal_rooms')
          .select('*')
          .order('quality_rating', { ascending: false });

        if (roomsError) throw roomsError;
        setRooms(roomsData || []);

        // Load band songs from setlists and member songs
        const { data: setlistSongs, error: setlistSongsError } = await supabase
          .from('setlist_songs')
          .select(`
            song_id,
            setlists!inner(band_id, is_active)
          `)
          .eq('setlists.band_id', bandData.id)
          .eq('setlists.is_active', true);

        if (setlistSongsError) throw setlistSongsError;

        // Get unique song IDs from setlists
        const setlistSongIds = new Set<string>(
          setlistSongs?.map(ss => ss.song_id) || []
        );

        // Also get songs owned by band members
        const { data: members, error: membersError } = await supabase
          .from('band_members')
          .select('user_id')
          .eq('band_id', bandData.id);

        if (membersError) throw membersError;

        const memberUserIds = members?.map(m => m.user_id) || [];
        
        // Combine song IDs from setlists and load all songs
        let allSongs: any[] = [];
        
        // Get setlist songs
        if (setlistSongIds.size > 0) {
          const { data: songs1, error: songs1Error } = await supabase
            .from('songs')
            .select('*')
            .in('id', Array.from(setlistSongIds))
            .in('status', ['draft', 'recorded'])
            .order('title');

          if (!songs1Error && songs1) {
            allSongs = songs1;
          }
        }
        
        // Also get member songs
        if (memberUserIds.length > 0) {
          const { data: memberSongs, error: memberSongsError } = await supabase
            .from('songs')
            .select('*')
            .in('user_id', memberUserIds)
            .in('status', ['draft', 'recorded'])
            .order('title');

          if (!memberSongsError && memberSongs) {
            // Merge without duplicates
            const existingIds = new Set(allSongs.map(s => s.id));
            memberSongs.forEach(song => {
              if (!existingIds.has(song.id)) {
                allSongs.push(song);
              }
            });
          }
        }

        setBandSongs(allSongs);
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

  const handleBookRehearsal = async (roomId: string, duration: number, songId: string | null, setlistId: string | null, scheduledStart: Date) => {
    if (!userBand) return;

    const room = rooms.find(r => r.id === roomId);
    if (!room) return;

    const totalCost = room.hourly_rate * duration;
    const currentBalance = userBand.band_balance || 0;

    if (currentBalance < totalCost) {
      toast({
        title: 'Insufficient Funds',
        description: `Your band needs $${totalCost}. Current balance: $${currentBalance}`,
        variant: 'destructive',
      });
      return;
    }

    try {
      const endTime = new Date(scheduledStart.getTime() + duration * 60 * 60 * 1000);
      const chemistryGain = Math.floor((room.quality_rating / 10) * duration);
      const xpEarned = Math.floor(50 * duration * (room.equipment_quality / 100));
      const familiarityGained = duration * 60;

      const { data: rehearsalData, error: rehearsalError } = await supabase
        .from('band_rehearsals')
        .insert([{
          band_id: userBand.id,
          rehearsal_room_id: roomId,
          duration_hours: duration,
          scheduled_start: scheduledStart.toISOString(),
          scheduled_end: endTime.toISOString(),
          total_cost: totalCost,
          chemistry_gain: chemistryGain,
          xp_earned: xpEarned,
          selected_song_id: songId,
          familiarity_gained: familiarityGained,
          status: 'in_progress',
        }])
        .select('id')
        .single();

      if (rehearsalError) throw rehearsalError;

      const { error: balanceError } = await supabase
        .from('bands')
        .update({ band_balance: currentBalance - totalCost })
        .eq('id', userBand.id);

      if (balanceError) throw balanceError;

      toast({
        title: 'Rehearsal Booked!',
        description: `Your band is rehearsing for ${duration} hours`,
      });

      setShowBookingDialog(false);
      await loadData();
      
      // Return rehearsal ID for schedule integration
      return rehearsalData?.id;
    } catch (error) {
      console.error('Error booking rehearsal:', error);
      toast({
        title: 'Error',
        description: 'Failed to book rehearsal',
        variant: 'destructive',
      });
    }
  };

  const handleCompleteRehearsal = async (rehearsal: BandRehearsal) => {
    if (!userBand) return;

    try {
      const { error: updateError } = await supabase
        .from('band_rehearsals')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', rehearsal.id);

      if (updateError) throw updateError;

      const { error: chemistryError } = await supabase
        .from('bands')
        .update({
          chemistry_level: Math.min(100, (userBand.chemistry_level || 0) + (rehearsal.chemistry_gain || 0)),
        })
        .eq('id', userBand.id);

      if (chemistryError) throw chemistryError;

      if (rehearsal.selected_song_id) {
        const { data: existing } = await supabase
          .from('band_song_familiarity')
          .select('*')
          .eq('band_id', userBand.id)
          .eq('song_id', rehearsal.selected_song_id)
          .maybeSingle();

        const newMinutes = (existing?.familiarity_minutes || 0) + (rehearsal.familiarity_gained || 0);
        
        if (existing) {
          await supabase
            .from('band_song_familiarity')
            .update({
              familiarity_minutes: Math.min(60, newMinutes),
              last_rehearsed_at: new Date().toISOString(),
            })
            .eq('id', existing.id);
        } else {
          await supabase
            .from('band_song_familiarity')
            .insert({
              band_id: userBand.id,
              song_id: rehearsal.selected_song_id,
              familiarity_minutes: Math.min(60, newMinutes),
              last_rehearsed_at: new Date().toISOString(),
            });
        }
      }

      toast({
        title: 'Rehearsal Complete!',
        description: `Gained ${rehearsal.chemistry_gain} chemistry, ${rehearsal.xp_earned} XP`,
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

  const activeRehearsals = rehearsals.filter(r => r.status === 'in_progress');
  const upcomingRehearsals = rehearsals.filter(r => r.status === 'scheduled');
  const completedRehearsals = rehearsals.filter(r => r.status === 'completed')
    .sort((a, b) => new Date(b.completed_at || b.created_at).getTime() - new Date(a.completed_at || a.created_at).getTime())
    .slice(0, 3);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Band Rehearsals</h2>
          <p className="text-sm text-muted-foreground">
            Band Balance: ${userBand.band_balance || 0}
          </p>
        </div>
        <Button onClick={() => setShowBookingDialog(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Book Rehearsal
        </Button>
      </div>

      {completedRehearsals.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Completed Rehearsals</CardTitle>
            <CardDescription>Last 3 rehearsals</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {completedRehearsals.map((rehearsal) => (
              <div key={rehearsal.id} className="rounded-lg border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold">
                      {(rehearsal.rehearsal_rooms as any)?.name || 'Rehearsal Room'}
                    </h3>
                    {rehearsal.songs && (
                      <p className="text-sm text-muted-foreground">
                        Practiced: {(rehearsal.songs as any).title}
                      </p>
                    )}
                  </div>
                  <Badge variant="default">{rehearsal.duration_hours}h</Badge>
                </div>

                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <p className="text-muted-foreground">Chemistry</p>
                    <p className="font-semibold text-green-500">+{rehearsal.chemistry_gain}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">XP</p>
                    <p className="font-semibold text-blue-500">+{rehearsal.xp_earned}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Familiarity</p>
                    <p className="font-semibold text-purple-500">+{rehearsal.familiarity_gained}m</p>
                  </div>
                </div>

                <div className="text-xs text-muted-foreground">
                  Completed: {rehearsal.completed_at ? format(new Date(rehearsal.completed_at), 'MMM d, yyyy HH:mm') : 'N/A'}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {activeRehearsals.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Active Rehearsals</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {activeRehearsals.map((rehearsal) => {
              const endTime = new Date(rehearsal.scheduled_end);
              const now = new Date();
              const canComplete = now >= endTime;

              return (
                <div key={rehearsal.id} className="rounded-lg border p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold">
                        {(rehearsal.rehearsal_rooms as any)?.name || 'Rehearsal Room'}
                      </h3>
                      {rehearsal.songs && (
                        <p className="text-sm text-muted-foreground">
                          Practicing: {(rehearsal.songs as any).title}
                        </p>
                      )}
                    </div>
                    <Badge variant={canComplete ? 'default' : 'secondary'}>
                      {rehearsal.duration_hours}h
                    </Badge>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div>
                      <p className="text-muted-foreground">Chemistry</p>
                      <p className="font-semibold text-green-500">+{rehearsal.chemistry_gain}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">XP</p>
                      <p className="font-semibold text-blue-500">+{rehearsal.xp_earned}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Ends</p>
                      <p className="font-semibold">{format(endTime, 'HH:mm')}</p>
                    </div>
                  </div>

                  {canComplete ? (
                    <Button onClick={() => handleCompleteRehearsal(rehearsal)} className="w-full">
                      Complete Rehearsal
                    </Button>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center">
                      In progress... ({format(endTime, 'MMM d, HH:mm')})
                    </p>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {upcomingRehearsals.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Upcoming Rehearsals</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {upcomingRehearsals.map((rehearsal) => (
              <div key={rehearsal.id} className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="font-semibold">
                    {(rehearsal.rehearsal_rooms as any)?.name || 'Rehearsal Room'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {format(new Date(rehearsal.scheduled_start), 'MMM d, yyyy HH:mm')}
                  </p>
                </div>
                <Badge variant="outline">{rehearsal.duration_hours}h</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {rehearsals.length === 0 && (
        <Card>
          <CardContent className="py-10 text-center">
            <Music2 className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
            <h3 className="text-lg font-semibold">No Rehearsals Scheduled</h3>
            <p className="mt-1 text-sm text-muted-foreground mb-4">
              Book your first rehearsal to improve your band's chemistry and skills.
            </p>
            <Button onClick={() => setShowBookingDialog(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Book Rehearsal
            </Button>
          </CardContent>
        </Card>
      )}

      {showBookingDialog && (
        <RehearsalBookingDialog
          rooms={rooms}
          band={userBand}
          songs={bandSongs}
          onConfirm={handleBookRehearsal}
          onClose={() => setShowBookingDialog(false)}
        />
      )}
    </div>
  );
}
