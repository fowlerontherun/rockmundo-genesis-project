import { listBandFriendships, changeBandFriendship } from './friendshipApi';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { getBandDiscoveryContext, setBandShortlisted } from './discoveryApi';

export type PlayTogetherCandidate = { id: string; name: string; fame: number; detail: string };
type Filter = 'all' | 'shortlist' | 'labelmates' | 'friends';

/** Candidates must come from the authoritative gig/tour eligibility query. */
export function PlayTogetherPicker({ bandId, candidates, onSelect, selectedId, preferredId, disabled = false, actionLabel = 'Select band' }: {
  bandId: string;
  candidates: PlayTogetherCandidate[];
  onSelect: (id: string) => void;
  selectedId?: string;
  preferredId?: string;
  disabled?: boolean;
  actionLabel?: string;
}) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [sort, setSort] = useState('recommended');
  const client = useQueryClient();
  const context = useQuery({ queryKey: ['band-discovery', bandId], queryFn: () => getBandDiscoveryContext(bandId) });
  const friends = useQuery({ queryKey: ['band-friendships', bandId], queryFn: () => listBandFriendships(bandId) });
  const friendship = useMutation({
    mutationFn: (id: string) => changeBandFriendship(bandId, id, 'request'),
    onSuccess: () => client.invalidateQueries({ queryKey: ['band-friendships'] }),
  });
  const friendshipById = new Map((friends.data ?? []).map(row => [row.band_id, row]));
  const shortlist = useMutation({
    mutationFn: ({ id, saved }: { id: string; saved: boolean }) => setBandShortlisted(bandId, id, saved),
    onSuccess: () => client.invalidateQueries({ queryKey: ['band-discovery', bandId] }),
  });
  const byId = new Map((context.data ?? []).map(row => [row.band_id, row]));
  const visible = candidates.filter(band => band.name.toLowerCase().includes(search.trim().toLowerCase()))
    .filter(band => filter === 'all' || (filter === 'friends' ? friendshipById.get(band.id)?.status === 'accepted' : filter === 'shortlist' ? byId.get(band.id)?.shortlisted : byId.get(band.id)?.labelmate))
    .sort((a, b) => {
      if (sort === 'recommended' && (a.id === preferredId || b.id === preferredId)) return Number(b.id === preferredId) - Number(a.id === preferredId);
      if (sort === 'fame') return b.fame-a.fame || a.name.localeCompare(b.name);
      if (sort === 'name') return a.name.localeCompare(b.name);
      const score = (id: string) => Number(!!byId.get(id)?.shortlisted)*4 + Number(friendshipById.get(id)?.status === 'accepted')*2 + Number(!!byId.get(id)?.labelmate);
      return score(b.id)-score(a.id) || a.name.localeCompare(b.name);
    });

  return <div className="space-y-3">
    <div className="flex flex-col gap-2 sm:flex-row"><Input aria-label="Search available bands" placeholder="Search available bands…" value={search} onChange={event => setSearch(event.target.value)} /><label className="flex shrink-0 items-center gap-2 text-sm">Sort<select aria-label="Sort available bands" className="rounded-md border bg-background p-2" value={sort} onChange={event => setSort(event.target.value)}><option value="recommended">Your connections first</option><option value="fame">Highest fame</option><option value="name">Band name</option></select></label></div>
    <div className="flex flex-wrap gap-2">
      {(['all', 'shortlist', 'friends', 'labelmates'] as const).map(value => <Button key={value} size="sm" variant={filter === value ? 'default' : 'outline'}
        disabled={value === 'friends' ? !friends.isSuccess : value !== 'all' && !context.isSuccess} aria-pressed={filter === value} onClick={() => setFilter(value)}>
        {{ all: 'All available', shortlist: 'Shortlist', labelmates: 'Labelmates', friends: 'Friends' }[value]}
      </Button>)}
    </div>
    {context.isError && <p role="alert" className="text-sm">Shortlists and labelmate suggestions could not be loaded. <Button size="sm" variant="outline" onClick={() => void context.refetch()}>Retry</Button></p>}
    {friends.isError && <p role="alert">Friendships could not be loaded. <Button onClick={() => void friends.refetch()}>Retry friendships</Button></p>}
    {friendship.isError && <p role="alert">Could not send the friendship request. A recently declined request must wait seven days before resending.</p>}
    {shortlist.isError && <p role="alert" className="text-sm text-destructive">Could not update your shortlist. Please try again.</p>}
    <p className="text-xs text-muted-foreground" aria-live="polite">Showing {visible.length} of {candidates.length} eligible bands. Friends and saved bands still need to be available for these dates.</p>
    <div className="grid gap-3 md:grid-cols-2">
      {visible.map(band => {
        const relation = byId.get(band.id);
        const friend = friendshipById.get(band.id);
        return <div key={band.id} className="space-y-3 rounded-lg border p-3">
          <div className="font-semibold"><a className="underline-offset-4 hover:underline" href={`/band/${band.id}`} target="_blank" rel="noreferrer" aria-label={`View ${band.name} profile (opens in a new tab)`}>{band.name}</a> {band.id === preferredId && <Badge variant="outline">Band from your link</Badge>} {relation?.labelmate && <Badge variant="secondary">Same label</Badge>}</div>
          <p className="text-sm text-muted-foreground">Fame {band.fame.toLocaleString()} · {band.detail}</p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" disabled={disabled} aria-pressed={selectedId === band.id} onClick={() => onSelect(band.id)}>{selectedId === band.id ? 'Selected' : actionLabel}</Button>
            <Button size="sm" variant="outline" disabled={!context.isSuccess || shortlist.isPending} aria-pressed={!!relation?.shortlisted}
              onClick={() => shortlist.mutate({ id: band.id, saved: !relation?.shortlisted })}>{relation?.shortlisted ? 'Remove from shortlist' : 'Shortlist'}</Button>
            {friend ? <Badge variant="outline">{friend.status === 'accepted' ? 'Band friends' : friend.incoming ? 'Friend request received — reply in Gig booking → Play Together → Friends' : 'Friend request sent'}</Badge>
              : <Button size="sm" variant="outline" disabled={!friends.isSuccess || friendship.isPending} onClick={() => friendship.mutate(band.id)}>Request friendship</Button>}
          </div>
        </div>;
      })}
    </div>
    {!visible.length && <div className="space-y-2 rounded-lg border border-dashed p-4 text-sm text-muted-foreground"><p>{candidates.length ? 'No available bands match these filters.' : 'No eligible bands are currently available for these dates. Try another date, or ask a band to update its availability.'}</p>{candidates.length > 0 && <Button variant="outline" onClick={() => { setSearch(''); setFilter('all'); }}>Clear band filters</Button>}</div>}
  </div>;
}
