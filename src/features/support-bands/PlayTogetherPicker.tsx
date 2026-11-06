import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { getBandDiscoveryContext, setBandShortlisted } from './discoveryApi';

export type PlayTogetherCandidate = { id: string; name: string; fame: number; detail: string };
type Filter = 'all' | 'shortlist' | 'labelmates';

/** Candidates must come from the authoritative gig/tour eligibility query. */
export function PlayTogetherPicker({ bandId, candidates, onSelect, selectedId, disabled = false, actionLabel = 'Select band' }: {
  bandId: string;
  candidates: PlayTogetherCandidate[];
  onSelect: (id: string) => void;
  selectedId?: string;
  disabled?: boolean;
  actionLabel?: string;
}) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const client = useQueryClient();
  const context = useQuery({ queryKey: ['band-discovery', bandId], queryFn: () => getBandDiscoveryContext(bandId) });
  const shortlist = useMutation({
    mutationFn: ({ id, saved }: { id: string; saved: boolean }) => setBandShortlisted(bandId, id, saved),
    onSuccess: () => client.invalidateQueries({ queryKey: ['band-discovery', bandId] }),
  });
  const byId = new Map((context.data ?? []).map(row => [row.band_id, row]));
  const visible = candidates.filter(band => band.name.toLowerCase().includes(search.trim().toLowerCase()))
    .filter(band => filter === 'all' || (filter === 'shortlist' ? byId.get(band.id)?.shortlisted : byId.get(band.id)?.labelmate))
    .sort((a, b) => Number(!!byId.get(b.id)?.labelmate) - Number(!!byId.get(a.id)?.labelmate) || a.name.localeCompare(b.name));

  return <div className="space-y-3">
    <Input aria-label="Search available bands" placeholder="Search available bands…" value={search} onChange={event => setSearch(event.target.value)} />
    <div className="flex flex-wrap gap-2">
      {(['all', 'shortlist', 'labelmates'] as const).map(value => <Button key={value} size="sm" variant={filter === value ? 'default' : 'outline'}
        disabled={value !== 'all' && !context.isSuccess} aria-pressed={filter === value} onClick={() => setFilter(value)}>
        {{ all: 'All available', shortlist: 'Shortlist', labelmates: 'Labelmates' }[value]}
      </Button>)}
    </div>
    {context.isError && <p role="alert" className="text-sm">Shortlists and labelmate suggestions could not be loaded. <Button size="sm" variant="outline" onClick={() => void context.refetch()}>Retry</Button></p>}
    {shortlist.isError && <p role="alert" className="text-sm text-destructive">Could not update your shortlist. Please try again.</p>}
    <div className="grid gap-3 md:grid-cols-2">
      {visible.map(band => {
        const relation = byId.get(band.id);
        return <div key={band.id} className="space-y-3 rounded-lg border p-3">
          <div className="font-semibold">{band.name} {relation?.labelmate && <Badge variant="secondary">Same label</Badge>}</div>
          <p className="text-sm text-muted-foreground">Fame {band.fame.toLocaleString()} · {band.detail}</p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" disabled={disabled} aria-pressed={selectedId === band.id} onClick={() => onSelect(band.id)}>{selectedId === band.id ? 'Selected' : actionLabel}</Button>
            <Button size="sm" variant="outline" disabled={!context.isSuccess || shortlist.isPending} aria-pressed={!!relation?.shortlisted}
              onClick={() => shortlist.mutate({ id: band.id, saved: !relation?.shortlisted })}>{relation?.shortlisted ? 'Remove from shortlist' : 'Shortlist'}</Button>
          </div>
        </div>;
      })}
    </div>
    {!visible.length && <p className="text-sm text-muted-foreground">No available bands match these filters. Saved bands still need to be eligible for these dates.</p>}
  </div>;
}
