import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { usePrimaryBand } from '@/hooks/usePrimaryBand';
import { playTogetherRpc } from './completionApi';
import { getBandDiscoveryContext, setBandShortlisted } from './discoveryApi';
import { changeBandFriendship, listBandFriendships } from './friendshipApi';
export function BandPlayTogetherActions({ targetBandId }: { targetBandId: string }) {
  const client = useQueryClient();
  const { data: own } = usePrimaryBand();
  const bandId = own?.band_id;
  const status = useQuery({ queryKey: ['band-play-status', targetBandId], queryFn: () => playTogetherRpc<{ touring: boolean; single_gigs: boolean } | null>('get_band_play_together_status', { p_band_id: targetBandId }) });
  const context = useQuery({ queryKey: ['band-discovery', bandId], queryFn: () => getBandDiscoveryContext(bandId!), enabled: !!bandId && bandId !== targetBandId });
  const friends = useQuery({ queryKey: ['band-friendships', bandId], queryFn: () => listBandFriendships(bandId!), enabled: !!bandId && bandId !== targetBandId });
  const saved = context.data?.find(b => b.band_id === targetBandId)?.shortlisted ?? false;
  const friend = friends.data?.find(b => b.band_id === targetBandId);
  const change = useMutation({ mutationFn: (action: 'save' | 'friend' | 'accept') => action === 'save' ? setBandShortlisted(bandId!, targetBandId, !saved) : changeBandFriendship(bandId!, targetBandId, action === 'accept' ? 'accept' : 'request'),
    onSuccess: async () => { await Promise.all([client.invalidateQueries({ queryKey: ['band-discovery'] }), client.invalidateQueries({ queryKey: ['band-friendships'] })]); } });
  return <div className="space-y-2 rounded-lg border p-3">
    <div className="flex flex-wrap gap-2">{status.data?.touring && <Badge>Open to touring</Badge>}{status.data?.single_gigs && <Badge variant="outline">Open to support gigs</Badge>}</div>
    {bandId && bandId !== targetBandId && <div className="flex flex-wrap gap-2">
      <Button variant="outline" disabled={!context.isSuccess || change.isPending} onClick={() => change.mutate('save')}>{saved ? 'Remove from shortlist' : 'Shortlist band'}</Button>
      {friend?.status === 'accepted' ? <Badge>Band friends</Badge> : <Button variant="outline" disabled={!friends.isSuccess || change.isPending || (!!friend && !friend.incoming)} onClick={() => change.mutate(friend?.incoming ? 'accept' : 'friend')}>{friend?.incoming ? 'Accept friendship' : friend ? 'Friendship requested' : 'Request friendship'}</Button>}
      <Button asChild variant="secondary"><a href={`/gig-booking?tab=play-together&section=headliner&targetBand=${targetBandId}`}>Invite to a gig</a></Button>
      <Button asChild variant="secondary"><a href={`/tour-manager?inviteBand=${targetBandId}`}>Invite to a booked tour</a></Button>
    </div>}
    {(status.isError || context.isError || friends.isError || change.isError) && <p role="alert" className="text-sm">Some Play Together actions could not be loaded or updated. Check your band’s gig-management permissions and retry from Play Together.</p>}
  </div>;
}
