import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getLabelSuggestionRoster, listLabelSuggestions, respondToLabelSuggestion, suggestLabelPairing } from './labelSuggestionsApi';

type Props = { labelId: string; bandId?: never; onFindSupport?: never } | { bandId: string; labelId?: never; onFindSupport: () => void };
export function LabelSuggestionsPanel(props: Props) {
  const client = useQueryClient();
  const [headliner, setHeadliner] = useState('');
  const [support, setSupport] = useState('');
  const [note, setNote] = useState('');
  const scope = props.labelId ? { labelId: props.labelId } : { bandId: props.bandId! };
  const suggestions = useQuery({ queryKey: ['label-play-together', scope], queryFn: () => listLabelSuggestions(scope) });
  const roster = useQuery({ queryKey: ['label-play-together-roster', props.labelId],
    queryFn: () => getLabelSuggestionRoster(props.labelId!), enabled: !!props.labelId });
  const change = useMutation({
    mutationFn: async (action: { id: string; response: 'interested' | 'declined' } | { create: true }) => {
      if ('create' in action) await suggestLabelPairing(props.labelId!, headliner, support, note);
      else await respondToLabelSuggestion(action.id, props.bandId!, action.response);
    },
    onSuccess: async () => {
      setNote('');
      await Promise.all([
        client.invalidateQueries({ queryKey: ['label-play-together'] }),
        client.invalidateQueries({ queryKey: ['band-discovery'] }),
      ]);
    },
  });
  return <div className="space-y-3 rounded-lg border p-4">
    <h3 className="font-semibold">Label Play Together suggestions</h3>
    <p className="text-sm text-muted-foreground">Labels can recommend roster bands support each other. Each band can express interest and shortlist the other. Arrange dates through Find Support or your tour; each booking needs a separate invitation and acceptance.</p>
    {props.labelId && <>
      {roster.isPending ? <p>Loading roster…</p> : roster.isError ? <p role="alert">Could not load the roster. <Button onClick={() => void roster.refetch()}>Retry roster</Button></p> : <form className="space-y-3" onSubmit={event => { event.preventDefault(); change.mutate({ create: true }); }}>
        <fieldset disabled={change.isPending} className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1 text-sm">Headliner<select aria-label="Suggested headliner" className="block w-full rounded-md border bg-background p-2" value={headliner} onChange={event => setHeadliner(event.target.value)}>
            <option value="">Choose a band</option>{roster.data?.map(band => <option key={band.id} value={band.id}>{band.name}</option>)}
          </select></label>
          <label className="space-y-1 text-sm">Support band<select aria-label="Suggested support band" className="block w-full rounded-md border bg-background p-2" value={support} onChange={event => setSupport(event.target.value)}>
            <option value="">Choose a band</option>{roster.data?.filter(band => band.id !== headliner).map(band => <option key={band.id} value={band.id}>{band.name}</option>)}
          </select></label>
        </div>
        <label className="block text-sm">Why play together?<textarea aria-label="Suggestion note" className="mt-1 block w-full rounded-md border bg-background p-2" maxLength={500} value={note} onChange={event => setNote(event.target.value)} /></label>
        <Button type="submit" disabled={change.isPending || !headliner || !support || headliner === support}>Suggest pairing</Button>
        </fieldset>
        {(roster.data?.length ?? 0) < 2 && <p className="text-sm">At least two active roster bands are needed.</p>}
      </form>}
    </>}
    {suggestions.isPending && <p>Loading suggestions…</p>}
    {suggestions.isError && <p role="alert">Could not load suggestions. <Button onClick={() => void suggestions.refetch()}>Retry suggestions</Button></p>}
    {change.isSuccess && <p role="status" className="text-sm">{props.labelId ? 'Suggestion saved. Existing pairings keep their original details and responses.' : 'Response saved.'}</p>}
    {change.isError && <p role="alert">Could not confirm the change. Refresh and review the current roster and responses before retrying. <Button onClick={() => { void suggestions.refetch(); if (props.labelId) void roster.refetch(); }}>Refresh</Button></p>}
    {suggestions.data?.length === 0 && <p className="text-sm text-muted-foreground">No suggestions yet.</p>}
    {suggestions.data?.map(suggestion => {
      const ownResponse = props.bandId === suggestion.headliner_band_id ? suggestion.headliner_response : suggestion.support_response;
      return <div key={suggestion.id} className="space-y-2 rounded-lg border p-3">
        <p className="font-medium">{suggestion.headliner_name} with support from {suggestion.support_name}</p>
        <p className="text-sm text-muted-foreground">Suggested by {suggestion.label_name}</p>
        {suggestion.note && <p className="whitespace-pre-wrap text-sm">{suggestion.note}</p>}
        <div className="flex flex-wrap gap-2"><Badge variant="outline">Headliner: {suggestion.headliner_response}</Badge><Badge variant="outline">Support: {suggestion.support_response}</Badge></div>
        {!suggestion.roster_current && <p className="text-sm">This pairing is no longer on the label’s active roster.</p>}
        {props.bandId && <div className="flex flex-wrap gap-2">
          <Button disabled={change.isPending || !suggestion.roster_current || ownResponse === 'interested'} onClick={() => change.mutate({ id: suggestion.id, response: 'interested' })}>Interested &amp; shortlist</Button>
          <Button variant="outline" disabled={change.isPending || ownResponse === 'declined'} onClick={() => change.mutate({ id: suggestion.id, response: 'declined' })}>Decline suggestion</Button>
          {props.bandId === suggestion.headliner_band_id && suggestion.roster_current && suggestion.headliner_response === 'interested' && suggestion.support_response === 'interested' && <Button variant="secondary" onClick={props.onFindSupport}>Find Support dates</Button>}
        </div>}
      </div>;
    })}
  </div>;
}
