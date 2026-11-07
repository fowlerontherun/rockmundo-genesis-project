import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { changeBandFriendship, listBandFriendships, searchFriendBands, type FriendshipAction } from './friendshipApi';

export function BandFriendsPanel({ bandId }: { bandId: string }) {
  const client = useQueryClient();
  const [search, setSearch] = useState('');
  const [submittedSearch, setSubmittedSearch] = useState('');
  const bands = useQuery({ queryKey: ['band-friend-search', bandId, submittedSearch],
    queryFn: () => searchFriendBands(bandId, submittedSearch), enabled: submittedSearch.length >= 2 });
  const friends = useQuery({ queryKey: ['band-friendships', bandId], queryFn: () => listBandFriendships(bandId) });
  const change = useMutation({
    mutationFn: ({ id, action }: { id: string; action: FriendshipAction }) => changeBandFriendship(bandId, id, action),
    onSuccess: () => client.invalidateQueries({ queryKey: ['band-friendships'] }),
  });
  if (friends.isPending) return <p>Loading band friendships…</p>;
  if (friends.isError) return <p role="alert">Band friendships could not be loaded. <Button onClick={() => void friends.refetch()}>Retry</Button></p>;
  return <div className="space-y-3">
    <p className="text-sm text-muted-foreground">Search for a band or send friendship requests from Find Support. Both bands must agree. Friends still need to accept each gig or tour offer.</p>
    <form className="flex gap-2" onSubmit={event => { event.preventDefault(); setSubmittedSearch(search.trim()); }}>
      <Input aria-label="Find a band to befriend" value={search} onChange={event => setSearch(event.target.value)} placeholder="Band name (at least 2 characters)" />
      <Button type="submit" disabled={search.trim().length < 2 || bands.isFetching}>Search bands</Button>
    </form>
    {bands.isError && <p role="alert">Band search failed. <Button onClick={() => void bands.refetch()}>Retry search</Button></p>}
    {bands.isSuccess && bands.data.length === 0 && <p>No matching active bands.</p>}
    {(bands.data ?? []).map(band => <div className="flex items-center justify-between gap-2 rounded-lg border p-3" key={band.id}>
      <span>{band.name}</span><Button disabled={change.isPending || friends.data.some(friend => friend.band_id === band.id)}
        onClick={() => change.mutate({ id: band.id, action: 'request' })}>{friends.data.some(friend => friend.band_id === band.id) ? 'Already connected or pending' : 'Request friendship'}</Button>
    </div>)}
    {change.isError && <p role="alert">The friendship could not be updated. Refresh and try again. <Button onClick={() => void friends.refetch()}>Refresh</Button></p>}
    {!friends.data.length && <p>No band friendships or requests yet.</p>}
    {friends.data.map(friend => <div key={friend.band_id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
      <div>{friend.band_name} <Badge variant="secondary">{friend.status === 'accepted' ? 'Friends' : friend.incoming ? 'Incoming request' : 'Request sent'}</Badge></div>
      <div className="flex gap-2">
        {friend.status === 'pending' && friend.incoming ? <>
          <Button disabled={change.isPending} onClick={() => change.mutate({ id: friend.band_id, action: 'accept' })}>Accept friendship</Button>
          <Button variant="outline" disabled={change.isPending} onClick={() => change.mutate({ id: friend.band_id, action: 'decline' })}>Decline</Button>
        </> : <Button variant="outline" disabled={change.isPending} onClick={() => change.mutate({ id: friend.band_id, action: 'remove' })}>{friend.status === 'accepted' ? 'Remove friend' : 'Withdraw request'}</Button>}
      </div>
    </div>)}
  </div>;
}
