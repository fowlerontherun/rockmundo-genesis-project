import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { BAND_PERFORMANCE_ROLES, BAND_VOCAL_ASSIGNMENTS, DEFAULT_BAND_PERFORMANCE_ROLE } from '@/data/bandPerformanceRoles';
import { useToast } from '@/hooks/use-toast';
import { UserPlus, Loader2, X } from 'lucide-react';
import { cancelBandInvitation, sendBandInvitation, friendlyBandInvitationError } from '@/services/bandInvitations';

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

interface SentInvitation {
  id: string;
  invited_profile_id: string | null;
  instrument_role: string;
  created_at: string;
  displayName: string;
}

export function InviteFriendToBand({ bandId, bandName, currentUserId }: InviteFriendToBandProps) {
  const [open, setOpen] = useState(false);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [sentInvites, setSentInvites] = useState<SentInvitation[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [selectedFriend, setSelectedFriend] = useState('');
  const [instrumentRole, setInstrumentRole] = useState<string>(DEFAULT_BAND_PERFORMANCE_ROLE);
  const [vocalRole, setVocalRole] = useState<string | undefined>(undefined);
  const [message, setMessage] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    const handleHubAction = (event: Event) => {
      const detail = (event as CustomEvent<{ label?: string; path?: string }>).detail;
      if (detail?.path === '/band/members' && detail?.label === 'Invite member') setOpen(true);
    };
    window.addEventListener('rockmundo:hub-action', handleHubAction);
    return () => window.removeEventListener('rockmundo:hub-action', handleHubAction);
  }, []);

  const loadRecruitmentOptions = useCallback(async (profileId: string) => {
    const { data: friendships, error } = await supabase
      .from('friendships')
      .select('id, requestor_id, addressee_id, status')
      .eq('status', 'accepted')
      .or(`requestor_id.eq.${profileId},addressee_id.eq.${profileId}`);
    if (error) throw error;

    const otherProfileIds = Array.from(new Set((friendships || []).map(friendship =>
      friendship.requestor_id === profileId ? friendship.addressee_id : friendship.requestor_id
    )));

    const { data: pendingInvites, error: invitesError } = await supabase
      .from('band_invitations')
      .select('id, invited_user_id, invited_profile_id, instrument_role, created_at')
      .eq('band_id', bandId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    if (invitesError) throw invitesError;

    const pendingProfileIds = (pendingInvites || []).map((invite) => invite.invited_profile_id).filter((id): id is string => !!id);
    const profileIds = Array.from(new Set([...otherProfileIds, ...pendingProfileIds]));
    const { data: profiles, error: profilesError } = profileIds.length
      ? await supabase.from('profiles').select('id, display_name, username, user_id').in('id', profileIds)
      : { data: [], error: null };
    if (profilesError) throw profilesError;

    const profileMap = new Map((profiles || []).map((profile) => [profile.id, profile]));
    const friendsWithProfiles = (friendships || []).map(friendship => {
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
    }).filter(Boolean) as Friend[];

    const { data: bandMembers, error: membersError } = await supabase
      .from('band_members')
      .select('user_id')
      .eq('band_id', bandId)
      .eq('member_status', 'active');
    if (membersError) throw membersError;

    const existingUserIds = new Set([
      ...(bandMembers?.map(m => m.user_id).filter(Boolean) || []),
      ...(pendingInvites?.map(i => i.invited_user_id).filter(Boolean) || []),
    ]);
    setFriends(friendsWithProfiles.filter((friend) => !existingUserIds.has(friend.profile.user_id)));
    setSentInvites((pendingInvites || []).map((invite) => {
      const profile = invite.invited_profile_id ? profileMap.get(invite.invited_profile_id) : undefined;
      return {
        id: invite.id,
        invited_profile_id: invite.invited_profile_id,
        instrument_role: invite.instrument_role,
        created_at: invite.created_at,
        displayName: profile?.display_name || profile?.username || 'Invited player',
      };
    }));
  }, [bandId]);

  useEffect(() => {
    if (!open) return;
    const prepare = async () => {
      setLoading(true);
      try {
        if (!currentUserId) throw new Error('Select an active character before inviting a band member.');
        await loadRecruitmentOptions(currentUserId);
      } catch (error) {
        toast({ title: 'Could not load invitations', description: error instanceof Error ? error.message : 'Failed to prepare band invitations', variant: 'destructive' });
        setFriends([]);
        setSentInvites([]);
      } finally {
        setLoading(false);
      }
    };
    void prepare();
  }, [open, currentUserId, loadRecruitmentOptions, toast]);

  const handleInvite = async () => {
    if (!selectedFriend) {
      toast({ title: 'Choose a friend', description: 'Please select a friend to invite', variant: 'destructive' });
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
      toast({ title: 'Invitation sent!', description: 'Your friend has been invited to join the band.' });
      setSelectedFriend('');
      setInstrumentRole(DEFAULT_BAND_PERFORMANCE_ROLE);
      setVocalRole(undefined);
      setMessage('');
      await loadRecruitmentOptions(currentUserId);
    } catch (error) {
      toast({ title: 'Invitation failed', description: friendlyBandInvitationError(error), variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelInvitation = async (invitationId: string) => {
    setCancellingId(invitationId);
    try {
      await cancelBandInvitation(invitationId);
      toast({ title: 'Invitation cancelled', description: 'The pending band invitation has been withdrawn.' });
      await loadRecruitmentOptions(currentUserId);
    } catch (error) {
      toast({ title: 'Could not cancel invitation', description: friendlyBandInvitationError(error), variant: 'destructive' });
    } finally {
      setCancellingId(null);
    }
  };

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)} aria-haspopup="dialog" aria-expanded={open}>
        <UserPlus className="h-4 w-4 mr-2" /> Invite Friend
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Invite Friend to {bandName}</DialogTitle>
            <DialogDescription>Choose a friend, assign their performance role, and manage invitations you have already sent.</DialogDescription>
          </DialogHeader>

          {loading ? (
            <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : (
            <div className="space-y-5 py-2">
              <section className="space-y-3">
                <h3 className="font-medium">Send a new invitation</h3>
                {friends.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No available friends to invite. Existing members and players with pending invitations are hidden.</p>
                ) : (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="friend">Select Friend</Label>
                      <Select value={selectedFriend} onValueChange={setSelectedFriend}>
                        <SelectTrigger id="friend"><SelectValue placeholder="Choose a friend" /></SelectTrigger>
                        <SelectContent className="bg-popover z-50">{friends.map((friend) => <SelectItem key={friend.id} value={friend.profile.id}>{friend.profile.display_name} (@{friend.profile.username})</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="instrument">Primary Performance Role</Label>
                      <Select value={instrumentRole} onValueChange={setInstrumentRole}>
                        <SelectTrigger id="instrument"><SelectValue /></SelectTrigger>
                        <SelectContent className="bg-popover z-50 max-h-72">{BAND_PERFORMANCE_ROLES.map((role) => <SelectItem key={role} value={role}>{role}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="vocals">Vocal Assignment (Optional)</Label>
                      <Select value={vocalRole} onValueChange={setVocalRole}>
                        <SelectTrigger id="vocals"><SelectValue placeholder="Select vocal role" /></SelectTrigger>
                        <SelectContent className="bg-popover z-50">{BAND_VOCAL_ASSIGNMENTS.map((role) => <SelectItem key={role} value={role}>{role}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="message">Personal Message (Optional)</Label>
                      <Textarea id="message" maxLength={280} placeholder="Add a personal message to your invitation..." value={message} onChange={(e) => setMessage(e.target.value)} rows={3} />
                      <p className="text-xs text-muted-foreground">{message.trim().length}/280 characters</p>
                    </div>
                    <Button type="button" onClick={handleInvite} disabled={submitting || !selectedFriend}>
                      {submitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Sending...</> : 'Send Invitation'}
                    </Button>
                  </>
                )}
              </section>

              <section className="space-y-3 border-t pt-4">
                <h3 className="font-medium">Pending invitations</h3>
                {sentInvites.length === 0 ? <p className="text-sm text-muted-foreground">No pending invitations.</p> : sentInvites.map((invite) => (
                  <div key={invite.id} className="flex items-center justify-between gap-3 rounded-md border p-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{invite.displayName}</p>
                      <p className="text-xs text-muted-foreground">{invite.instrument_role} • sent {new Date(invite.created_at).toLocaleDateString()}</p>
                    </div>
                    <Button type="button" size="sm" variant="outline" disabled={cancellingId === invite.id} onClick={() => handleCancelInvitation(invite.id)}>
                      {cancellingId === invite.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <><X className="mr-1 h-4 w-4" />Cancel</>}
                    </Button>
                  </div>
                ))}
              </section>
            </div>
          )}

          <div className="flex justify-end"><Button variant="outline" onClick={() => setOpen(false)} disabled={submitting || !!cancellingId}>Close</Button></div>
        </DialogContent>
      </Dialog>
    </>
  );
}
