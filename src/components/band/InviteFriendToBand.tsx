import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { BAND_PERFORMANCE_ROLES, BAND_VOCAL_ASSIGNMENTS, DEFAULT_BAND_PERFORMANCE_ROLE } from '@/data/bandPerformanceRoles';
import { useToast } from '@/hooks/use-toast';
import { UserPlus, Loader2 } from 'lucide-react';
import { sendBandInvitation, friendlyBandInvitationError } from '@/services/bandInvitations';

interface InviteFriendToBandProps {
  bandId: string;
  bandName: string;
  /** Active character profile ID. Kept under the existing prop name for backwards compatibility. */
  currentUserId: string;
}

interface Friend {
  id: string;
  profile: {
    id: string;
    user_id: string;
    display_name: string;
    username: string;
  };
}

export function InviteFriendToBand({ bandId, bandName, currentUserId }: InviteFriendToBandProps) {
  const [open, setOpen] = useState(false);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedFriend, setSelectedFriend] = useState('');
  const [instrumentRole, setInstrumentRole] = useState<string>(DEFAULT_BAND_PERFORMANCE_ROLE);
  const [vocalRole, setVocalRole] = useState<string | undefined>(undefined);
  const [message, setMessage] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    const handleHubAction = (event: Event) => {
      const detail = (event as CustomEvent<{ label?: string; path?: string }>).detail;
      if (detail?.path === '/band/members' && detail?.label === 'Invite member') {
        setOpen(true);
      }
    };

    window.addEventListener('rockmundo:hub-action', handleHubAction);
    return () => window.removeEventListener('rockmundo:hub-action', handleHubAction);
  }, []);

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
    if (!open) return;

    const prepareFriends = async () => {
      setLoading(true);
      try {
        if (!currentUserId) {
          toast({
            title: 'Character required',
            description: 'Select an active character before inviting a band member.',
            variant: 'destructive',
          });
          setFriends([]);
          return;
        }

        await loadFriends(currentUserId);
      } catch (error) {
        console.error('Error preparing band invitation:', error);
        toast({
          title: 'Error',
          description: 'Failed to prepare the band invitation form',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    void prepareFriends();
  }, [open, currentUserId, loadFriends, toast]);

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
      await sendBandInvitation({
        bandId,
        targetProfileId: selectedFriend,
        instrumentRole,
        vocalRole: vocalRole === 'None' ? null : vocalRole || null,
        message,
      });

      toast({
        title: 'Invitation sent!',
        description: 'Your friend has been invited to join the band.',
      });

      setOpen(false);
      setSelectedFriend('');
      setInstrumentRole(DEFAULT_BAND_PERFORMANCE_ROLE);
      setVocalRole(undefined);
      setMessage('');
    } catch (error: any) {
      console.error('Error sending invitation:', error);
      toast({
        title: 'Error',
        description: friendlyBandInvitationError(error),
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <UserPlus className="h-4 w-4 mr-2" />
        Invite Friend
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Invite Friend to {bandName}</DialogTitle>
            <DialogDescription>
              Choose a friend and assign a primary performance role from RockMundo's skill tree.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {loading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : friends.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No available friends to invite. Friends who are already members or have pending invites are hidden.
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
                        <SelectItem key={friend.id} value={friend.profile.id}>
                          {friend.profile.display_name} (@{friend.profile.username})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="instrument">Primary Performance Role</Label>
                  <Select value={instrumentRole} onValueChange={setInstrumentRole}>
                    <SelectTrigger id="instrument">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-popover z-50 max-h-72">
                      {BAND_PERFORMANCE_ROLES.map((role) => (
                        <SelectItem key={role} value={role}>
                          {role}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    This is the same role catalogue used by the game skill tree.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="vocals">Vocal Assignment (Optional)</Label>
                  <Select value={vocalRole} onValueChange={setVocalRole}>
                    <SelectTrigger id="vocals">
                      <SelectValue placeholder="Select vocal role" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover z-50">
                      {BAND_VOCAL_ASSIGNMENTS.map((role) => (
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
                    maxLength={280}
                    aria-describedby="band-invite-message-help"
                    placeholder="Add a personal message to your invitation..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={3}
                  />
                  <p id="band-invite-message-help" className="text-xs text-muted-foreground">
                    {message.trim().length}/280 characters
                  </p>
                </div>
              </>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleInvite}
              disabled={submitting || !selectedFriend || friends.length === 0}
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2" />
                  Sending...
                </>
              ) : (
                'Send Invitation'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
