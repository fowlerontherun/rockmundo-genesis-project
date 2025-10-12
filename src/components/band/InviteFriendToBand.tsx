import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { UserPlus, Loader2 } from 'lucide-react';
import type { Database } from '@/lib/supabase-types';
import { fetchPrimaryProfileForUser } from '@/integrations/supabase/friends';

interface InviteFriendToBandProps {
  bandId: string;
  bandName: string;
  currentUserId: string;
}

type ProfileRow = Database['public']['Tables']['profiles']['Row'];

interface Friend {
  id: string;
  profile: {
    id: string;
    user_id: string;
    display_name: string;
    username: string;
  };
}

const INSTRUMENTS = ['Guitar', 'Bass', 'Drums', 'Keyboard', 'Other'];
const VOCAL_ROLES = ['Lead Vocals', 'Backing Vocals', 'None'];

export function InviteFriendToBand({ bandId, bandName, currentUserId }: InviteFriendToBandProps) {
  const [open, setOpen] = useState(false);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedFriend, setSelectedFriend] = useState('');
  const [instrumentRole, setInstrumentRole] = useState('Guitar');
  const [vocalRole, setVocalRole] = useState<string | undefined>(undefined);
  const [message, setMessage] = useState('');
  const [currentProfile, setCurrentProfile] = useState<ProfileRow | null>(null);
  const { toast } = useToast();

  const loadFriends = useCallback(async (profileId: string) => {
    try {
      const { data: friendships, error } = await supabase
        .from('friendships')
        .select('id, requestor_id, addressee_id, status')
        .eq('status', 'accepted')
        .or(`requestor_id.eq.${profileId},addressee_id.eq.${profileId}`);

      if (error) throw error;

      if (!friendships || friendships.length === 0) {
        setFriends([]);
        return;
      }

      const otherProfileIds = Array.from(new Set(friendships.map(friendship =>
        friendship.requestor_id === profileId ? friendship.addressee_id : friendship.requestor_id
      )));

      if (otherProfileIds.length === 0) {
        setFriends([]);
        return;
      }

      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, display_name, username, user_id')
        .in('id', otherProfileIds);

      if (profilesError) throw profilesError;

      const profileMap = new Map((profiles || []).map((profile) => [profile.id, profile]));

      const friendsWithProfiles = friendships
        .map(friendship => {
          const otherId = friendship.requestor_id === profileId ? friendship.addressee_id : friendship.requestor_id;
          const profile = profileMap.get(otherId);
          if (!profile) return null;

          return {
            id: friendship.id,
            profile: {
              id: profile.id,
              user_id: profile.user_id,
              display_name: profile.display_name || 'Unknown',
              username: profile.username || 'unknown',
            },
          } satisfies Friend;
        })
        .filter(Boolean) as Friend[];

      const { data: bandMembers } = await supabase
        .from('band_members')
        .select('user_id')
        .eq('band_id', bandId);

      const { data: pendingInvites } = await supabase
        .from('band_invitations')
        .select('invited_user_id')
        .eq('band_id', bandId)
        .eq('status', 'pending');

      const existingUserIds = new Set([
        ...(bandMembers?.map(m => m.user_id) || []),
        ...(pendingInvites?.map(i => i.invited_user_id) || [])
      ]);

      const availableFriends = friendsWithProfiles.filter(
        f => !existingUserIds.has(f.profile.user_id)
      );

      setFriends(availableFriends);
    } catch (error) {
      console.error('Error loading friends:', error);
      toast({
        title: 'Error',
        description: 'Failed to load friends list',
        variant: 'destructive',
      });
    }
  }, [bandId, toast]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const prepareFriends = async () => {
      setLoading(true);
      try {
        if (!currentProfile) {
          const profile = await fetchPrimaryProfileForUser(currentUserId);
          if (!profile) {
            toast({
              title: 'Profile required',
              description: 'Create your character profile to invite friends.',
              variant: 'destructive',
            });
            setFriends([]);
            return;
          }
          setCurrentProfile(profile);
          return;
        }

        await loadFriends(currentProfile.id);
      } catch (error) {
        console.error('Error preparing friends:', error);
        toast({
          title: 'Error',
          description: 'Failed to load friends list',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    void prepareFriends();
  }, [open, currentProfile, currentUserId, loadFriends, toast]);

  const handleInvite = async () => {
    if (!selectedFriend) {
      toast({
        title: 'Error',
        description: 'Please select a friend to invite',
        variant: 'destructive',
      });
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('band_invitations')
        .insert({
          band_id: bandId,
          inviter_user_id: currentUserId,
          invited_user_id: selectedFriend,
          instrument_role: instrumentRole,
          vocal_role: vocalRole || null,
          message: message || null,
          status: 'pending',
        });

      if (error) throw error;

      toast({
        title: 'Invitation sent!',
        description: 'Your friend has been invited to join the band.',
      });

      setOpen(false);
      // Reset form
      setSelectedFriend('');
      setInstrumentRole('Guitar');
      setVocalRole(undefined);
      setMessage('');
    } catch (error: any) {
      console.error('Error sending invitation:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to send invitation',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <UserPlus className="h-4 w-4 mr-2" />
          Invite Friend
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invite Friend to {bandName}</DialogTitle>
          <DialogDescription>
            Choose a friend from your list and assign them a role in the band.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : friends.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No available friends to invite. Either you have no friends or they're already in the band.
            </p>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="friend">Select Friend</Label>
                <Select value={selectedFriend} onValueChange={setSelectedFriend}>
                  <SelectTrigger id="friend">
                    <SelectValue placeholder="Choose a friend" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover z-50">
                    {friends.map((friend) => (
                      <SelectItem key={friend.id} value={friend.profile.user_id}>
                        {friend.profile.display_name} (@{friend.profile.username})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="instrument">Instrument Role</Label>
                <Select value={instrumentRole} onValueChange={setInstrumentRole}>
                  <SelectTrigger id="instrument">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-popover z-50">
                    {INSTRUMENTS.map((instrument) => (
                      <SelectItem key={instrument} value={instrument}>
                        {instrument}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="vocals">Vocal Role (Optional)</Label>
                <Select value={vocalRole} onValueChange={setVocalRole}>
                  <SelectTrigger id="vocals">
                    <SelectValue placeholder="Select vocal role" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover z-50">
                    {VOCAL_ROLES.map((role) => (
                      <SelectItem key={role} value={role}>
                        {role}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="message">Personal Message (Optional)</Label>
                <Textarea
                  id="message"
                  placeholder="Add a personal message to your invitation..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={3}
                />
              </div>
            </>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button 
            onClick={handleInvite} 
            disabled={submitting || !selectedFriend || friends.length === 0}
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              'Send Invitation'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
