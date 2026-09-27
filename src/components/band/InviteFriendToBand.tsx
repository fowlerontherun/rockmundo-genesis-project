import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { BAND_PERFORMANCE_ROLES, BAND_VOCAL_ASSIGNMENTS, DEFAULT_BAND_PERFORMANCE_ROLE } from '@/data/bandPerformanceRoles';
import { useToast } from '@/hooks/use-toast';
import { UserPlus, Loader2, X, Search } from 'lucide-react';
import { searchPublicProfiles, type PublicProfileSearchResult } from '@/services/publicProfileSearch';
import { bandInviteUnavailability } from '@/services/bandInviteEligibility';
import { cancelBandInvitation, sendBandInvitation, friendlyBandInvitationError } from '@/services/bandInvitations';

interface InviteFriendToBandProps {
  bandId: string;
  bandName: string;
  /** Active character profile ID. Kept under the existing prop name for backwards compatibility. */
  currentUserId: string;
  currentAccountId?: string | null;
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

interface ResolvedInvitation extends SentInvitation {
  status: 'accepted' | 'declined' | 'cancelled';
  responded_at: string | null;
}

export function InviteFriendToBand({ bandId, bandName, currentUserId, currentAccountId }: InviteFriendToBandProps) {
  const [open, setOpen] = useState(false);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [sentInvites, setSentInvites] = useState<SentInvitation[]>([]);
  const [recentResponses, setRecentResponses] = useState<ResolvedInvitation[]>([]);
  const [memberUserIds, setMemberUserIds] = useState<Set<string>>(new Set());
  const [pendingUserIds, setPendingUserIds] = useState<Set<string>>(new Set());
  const [playerQuery, setPlayerQuery] = useState('');
  const [playerMatches, setPlayerMatches] = useState<PublicProfileSearchResult[]>([]);
  const [searchingPlayers, setSearchingPlayers] = useState(false);
  const [playerSearchError, setPlayerSearchError] = useState<string | null>(null);
  const [selectedPlayerLabel, setSelectedPlayerLabel] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState('');
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
    // Pending invitations and the roster are essential; the friends shortcut is
    // optional. A broken friendship/profile lookup must not prevent inviting
    // other players by public search or hide already-sent invitations.
    const [inviteResult, memberResult, friendResult] = await Promise.all([
      supabase.from('band_invitations')
        .select('id, invited_user_id, invited_profile_id, instrument_role, status, created_at, responded_at')
        .eq('band_id', bandId)
        .in('status', ['pending', 'accepted', 'declined', 'cancelled'])
        .order('created_at', { ascending: false })
        .limit(80),
      supabase.from('band_members')
        .select('user_id')
        .eq('band_id', bandId)
        .eq('member_status', 'active'),
      supabase.from('friendships')
        .select('id, requestor_id, addressee_id, status')
        .eq('status', 'accepted')
        .or(`requestor_id.eq.${profileId},addressee_id.eq.${profileId}`),
    ]);
    if (inviteResult.error) throw inviteResult.error;
    if (memberResult.error) throw memberResult.error;

    const invitations = inviteResult.data || [];
    const pendingInvites = invitations.filter((invite) => invite.status === 'pending');
    const resolved = invitations.filter((invite) => invite.status !== 'pending' && invite.responded_at)
      .sort((a, b) => new Date(b.responded_at || 0).getTime() - new Date(a.responded_at || 0).getTime())
      .slice(0, 10);
    const bandMembers = memberResult.data || [];
    const friendships = friendResult.error ? [] : (friendResult.data || []);
    const memberIds = new Set(bandMembers.map((m) => m.user_id).filter((id): id is string => !!id));
    const pendingIds = new Set(pendingInvites.map((invite) => invite.invited_user_id).filter((id): id is string => !!id));
    setMemberUserIds(memberIds);
    setPendingUserIds(pendingIds);

    const friendProfileIds = friendships.map((friendship) =>
      friendship.requestor_id === profileId ? friendship.addressee_id : friendship.requestor_id
    );
    const pendingProfileIds = [...pendingInvites, ...resolved].map((invite) => invite.invited_profile_id).filter((id): id is string => !!id);
    const profileIds = Array.from(new Set([...friendProfileIds, ...pendingProfileIds]));
    const { data: profiles, error: profilesError } = profileIds.length
      ? await supabase.from('profiles').select('id, display_name, username, user_id').in('id', profileIds)
      : { data: [], error: null };

    const profileMap = new Map((profilesError ? [] : (profiles || [])).map((profile) => [profile.id, profile]));
    const friendOptions: Friend[] = friendships.flatMap((friendship) => {
      const otherId = friendship.requestor_id === profileId ? friendship.addressee_id : friendship.requestor_id;
      const profile = profileMap.get(otherId);
      if (!profile || memberIds.has(profile.user_id) || pendingIds.has(profile.user_id)
        || profile.user_id === currentAccountId) return [];
      return [{
        id: friendship.id,
        profile: {
          id: profile.id,
          user_id: profile.user_id,
          display_name: profile.display_name || 'Unknown',
          username: profile.username || 'unknown',
        },
      }];
    });
    setFriends(friendOptions);
    const displayInvite = (invite: typeof invitations[number]): SentInvitation => {
      const profile = invite.invited_profile_id ? profileMap.get(invite.invited_profile_id) : undefined;
      return {
        id: invite.id,
        invited_profile_id: invite.invited_profile_id,
        instrument_role: invite.instrument_role,
        created_at: invite.created_at,
        displayName: profile?.display_name || profile?.username || 'Invited player',
      };
    };
    setSentInvites(pendingInvites.map(displayInvite));
    setRecentResponses(resolved.map((invite) => ({
      ...displayInvite(invite),
      status: invite.status as ResolvedInvitation['status'],
      responded_at: invite.responded_at,
    })));
  }, [bandId, currentAccountId]);

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
        setRecentResponses([]);
        setMemberUserIds(new Set());
        setPendingUserIds(new Set());
      } finally {
        setLoading(false);
      }
    };
    void prepare();
  }, [open, currentUserId, loadRecruitmentOptions, toast]);


  // Reuse the game's privacy-aware public profile search instead of exposing
  // raw profiles to the band manager. Backend invitation rules are authoritative.
  useEffect(() => {
    const term = playerQuery.trim();
    if (!open || term.length < 2) {
      setPlayerMatches([]);
      setPlayerSearchError(null);
      setSearchingPlayers(false);
      return;
    }

    let cancelled = false;
    setSearchingPlayers(true);
    setPlayerSearchError(null);
    setPlayerMatches([]);
    const timeout = window.setTimeout(async () => {
      try {
        const matches = await searchPublicProfiles(term, currentUserId, 20);
        if (!cancelled) setPlayerMatches(matches);
      } catch (error) {
        if (!cancelled) setPlayerSearchError(error instanceof Error ? error.message : 'Player search is unavailable.');
      } finally {
        if (!cancelled) setSearchingPlayers(false);
      }
    }, 300);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [open, playerQuery, currentUserId]);

  const handleInvite = async () => {
    if (!selectedPlayer) {
      toast({ title: 'Choose a player', description: 'Search for a player or select a friend to invite.', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      await sendBandInvitation({
        bandId,
        targetProfileId: selectedPlayer,
        instrumentRole,
        vocalRole: vocalRole === 'None' ? null : vocalRole || null,
        message,
      });
      toast({ title: 'Invitation sent!', description: 'The player can accept or decline the invitation in their band invitations.' });
      setSelectedPlayer('');
      setSelectedPlayerLabel('');
      setInstrumentRole(DEFAULT_BAND_PERFORMANCE_ROLE);
      setVocalRole(undefined);
      setMessage('');
      try {
        await loadRecruitmentOptions(currentUserId);
      } catch {
        toast({ title: 'Invitation sent, but the pending list could not refresh', description: 'Reopen this dialog to load the latest invitations.' });
      }
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
      try {
        await loadRecruitmentOptions(currentUserId);
      } catch {
        setSentInvites((previous) => previous.filter((invite) => invite.id !== invitationId));
        toast({ title: 'Invitation cancelled, but the pending list could not refresh' });
      }
    } catch (error) {
      toast({ title: 'Could not cancel invitation', description: friendlyBandInvitationError(error), variant: 'destructive' });
    } finally {
      setCancellingId(null);
    }
  };

  const handleDialogOpenChange = (next: boolean) => {
    if (!next && (submitting || !!cancellingId)) return;
    setOpen(next);
    if (!next) {
      setPlayerQuery('');
      setSelectedPlayer('');
      setSelectedPlayerLabel('');
    }
  };

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)} aria-haspopup="dialog" aria-expanded={open}>
        <UserPlus className="h-4 w-4 mr-2" /> Invite Player
      </Button>

      <Dialog open={open} onOpenChange={handleDialogOpenChange}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Invite a player to {bandName}</DialogTitle>
            <DialogDescription>Search the game for musicians or select a friend, then choose their performance role. Players must accept an invitation before joining.</DialogDescription>
          </DialogHeader>

          {loading ? (
            <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : (
            <div className="space-y-5 py-2">
              <section className="space-y-4">
                <h3 className="font-medium">Send a new invitation</h3>

                <div className="space-y-2">
                  <Label htmlFor="player-search">Find a player</Label>
                  <div className="relative">
                    <Search aria-hidden="true" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="player-search"
                      className="pl-9"
                      maxLength={80}
                      placeholder="Search username or character name"
                      value={playerQuery}
                      onChange={(event) => {
                        setPlayerQuery(event.target.value);
                        setSelectedPlayer('');
                        setSelectedPlayerLabel('');
                      }}
                    />
                  </div>
                  {playerQuery.trim().length < 2 && (
                    <p className="text-xs text-muted-foreground">Enter at least two characters to search for players in RockMundo.</p>
                  )}
                  {searchingPlayers && <p className="text-sm text-muted-foreground" role="status">Searching players...</p>}
                  {playerSearchError && <p className="text-sm text-destructive" role="alert">{playerSearchError}</p>}
                  {!searchingPlayers && !playerSearchError && playerQuery.trim().length >= 2 && playerMatches.length === 0 && (
                    <p className="text-sm text-muted-foreground">No matching players found.</p>
                  )}
                  {playerMatches.length > 0 && (
                    <div aria-label="Player search results" className="max-h-56 space-y-1 overflow-y-auto rounded-md border p-1">
                      {playerMatches.map((player) => {
                        const unavailable = bandInviteUnavailability(player, {
                          inviterProfileId: currentUserId,
                          inviterAccountId: currentAccountId,
                          memberUserIds,
                          pendingUserIds,
                        });
                        const selected = selectedPlayer === player.id;
                        return (
                          <button
                            key={player.id}
                            type="button"
                            disabled={!!unavailable}
                            aria-pressed={selected}
                            onClick={() => {
                              setSelectedPlayer(player.id);
                              setSelectedPlayerLabel(player.display_name || player.username);
                            }}
                            className="flex w-full items-center gap-3 rounded-md p-2 text-left hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50 data-[selected=true]:bg-primary/10"
                            data-selected={selected}
                          >
                            <Avatar className="h-9 w-9">
                              <AvatarImage src={player.avatar_url || undefined} />
                              <AvatarFallback>{(player.display_name || player.username).slice(0, 2).toUpperCase()}</AvatarFallback>
                            </Avatar>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-medium">{player.display_name || player.username} (@{player.username})</span>
                              <span className="block text-xs text-muted-foreground">
                                {unavailable || [player.city_name, player.bands[0]?.name ? `Member of ${player.bands[0].name}` : null].filter(Boolean).join(' • ') || 'Available to invite'}
                              </span>
                            </span>
                            {selected && <span className="text-xs font-medium text-primary">Selected</span>}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {friends.length > 0 && (
                  <div className="space-y-2">
                    <Label htmlFor="friend">Or choose a friend</Label>
                    <Select value={friends.some((friend) => friend.profile.id === selectedPlayer) ? selectedPlayer : ''} onValueChange={(profileId) => {
                      const friend = friends.find((entry) => entry.profile.id === profileId);
                      setSelectedPlayer(profileId);
                      setSelectedPlayerLabel(friend?.profile.display_name || friend?.profile.username || 'Selected player');
                    }}>
                      <SelectTrigger id="friend"><SelectValue placeholder="Choose a friend" /></SelectTrigger>
                      <SelectContent className="bg-popover z-50">
                        {friends.map((friend) => <SelectItem key={friend.id} value={friend.profile.id}>{friend.profile.display_name} (@{friend.profile.username})</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {selectedPlayer && <p className="rounded-md bg-primary/10 p-2 text-sm">Inviting: <strong>{selectedPlayerLabel}</strong></p>}

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
                <Button type="button" onClick={handleInvite} disabled={submitting || !selectedPlayer}>
                  {submitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Sending...</> : 'Send Invitation'}
                </Button>
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

              <section className="space-y-3 border-t pt-4">
                <h3 className="font-medium">Recent invitation activity</h3>
                {recentResponses.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No recent responses yet.</p>
                ) : recentResponses.map((invite) => (
                  <div key={invite.id} className="flex items-center justify-between gap-3 rounded-md border p-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{invite.displayName}</p>
                      <p className="text-xs text-muted-foreground">
                        {invite.instrument_role} • {invite.responded_at ? new Date(invite.responded_at).toLocaleDateString() : new Date(invite.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <Badge variant={invite.status === 'accepted' ? 'default' : 'secondary'} className="capitalize">
                      {invite.status}
                    </Badge>
                  </div>
                ))}
              </section>
            </div>
          )}

          <div className="flex justify-end"><Button variant="outline" aria-label="Close invitation dialog" onClick={() => handleDialogOpenChange(false)} disabled={submitting || !!cancellingId}>Close</Button></div>
        </DialogContent>
      </Dialog>
    </>
  );
}
