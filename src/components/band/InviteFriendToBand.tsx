import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { UserPlus, Loader2 } from 'lucide-react';

interface InviteFriendToBandProps {
  bandId: string;
  bandName: string;
  currentUserId: string;
}

interface Friend {
  id: string;
  user_id: string;
  friend_user_id: string;
  friend_profile: {
    id: string;
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
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      loadFriends();
    }
  }, [open]);

  const loadFriends = async () => {
    setLoading(true);
    try {
      // Get accepted friendships with friend user IDs
      const { data: friendships, error } = await supabase
        .from('friendships')
        .select('id, user_id, friend_user_id, friend_profile_id')
        .eq('user_id', currentUserId)
        .eq('status', 'accepted');

      if (error) throw error;

      if (!friendships || friendships.length === 0) {
        setFriends([]);
        setLoading(false);
        return;
      }

      // Get friend profiles separately
      const profileIds = friendships.map(f => f.friend_profile_id).filter(Boolean);
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, display_name, username, user_id')
        .in('id', profileIds);

      if (profilesError) throw profilesError;

      // Map friendships to friends with profile data
      const friendsWithProfiles = friendships
        .map(friendship => {
          const profile = profiles?.find(p => p.id === friendship.friend_profile_id);
          if (!profile) return null;
          return {
            id: friendship.id,
            user_id: friendship.user_id,
            friend_user_id: friendship.friend_user_id,
            friend_profile: {
              id: profile.id,
              display_name: profile.display_name || 'Unknown',
              username: profile.username || 'unknown',
            },
          };
        })
        .filter(Boolean) as Friend[];

      // Filter out friends who are already band members or have pending invitations
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
        f => !existingUserIds.has(f.friend_user_id)
      );

      setFriends(availableFriends);
    } catch (error) {
      console.error('Error loading friends:', error);
      toast({
        title: 'Error',
        description: 'Failed to load friends list',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

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
                      <SelectItem key={friend.id} value={friend.friend_user_id}>
                        {friend.friend_profile.display_name} (@{friend.friend_profile.username})
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
