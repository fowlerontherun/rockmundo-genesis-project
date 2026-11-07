import { createTourSupportOffers } from '@/features/support-bands/groupedOffersApi';
import { PlayTogetherPicker } from '@/features/support-bands/PlayTogetherPicker';
import { useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar, Loader2, MapPin, Route, Send, Users, X } from 'lucide-react';
import { toast } from 'sonner';
import {
  cancelGigSupportOffer,
  findTourSupportCandidates,
  findTourSupportShowCandidates,
} from '@/features/support-bands/api';
import {
  cancelConfirmedSupportSlot,
  getTourSupportAssignments,
} from '@/features/support-bands/tourManagementApi';

interface TourSupportPanelProps {
  tourId: string;
  headlinerBandId: string;
  tourStatus: string;
}

const statusVariant = (status: string | null) => {
  if (status === 'accepted' || status === 'completed') return 'default' as const;
  if (status === 'pending') return 'secondary' as const;
  return 'outline' as const;
};

export function TourSupportPanel({ tourId, headlinerBandId, tourStatus }: TourSupportPanelProps) {
  const queryClient = useQueryClient();
  const [selectedBandId, setSelectedBandId] = useState<string>('');
  const [excludedDates, setExcludedDates] = useState<string[]>([]);
  const request = useRef<{ key: string; id: string } | null>(null);
  const editable = tourStatus === 'scheduled' || tourStatus === 'active';

  const { data: assignments = [], isLoading: loadingAssignments, isError: assignmentsError } = useQuery({
    queryKey: ['tour-support-assignments', tourId, headlinerBandId],
    queryFn: () => getTourSupportAssignments({ tourId, headlinerBandId }),
    enabled: !!tourId && !!headlinerBandId,
  });

  const { data: candidates = [], isLoading: loadingCandidates, isError: candidatesError } = useQuery({
    queryKey: ['tour-support-candidates', tourId, headlinerBandId],
    queryFn: () => findTourSupportCandidates({ tourId, headlinerBandId }),
    enabled: !!tourId && !!headlinerBandId && editable,
  });

  const { data: showCandidates = [], isLoading: loadingShows, isError: showsError } = useQuery({
    queryKey: ['tour-support-show-candidates', tourId, headlinerBandId],
    queryFn: () => findTourSupportShowCandidates({ tourId, headlinerBandId }),
    enabled: !!tourId && !!headlinerBandId && editable,
  });

  const blockedGigIds = useMemo(
    () => new Set(assignments.filter((row) => row.support_status === 'pending' || row.support_status === 'accepted' || row.support_status === 'completed').map((row) => row.gig_id)),
    [assignments],
  );

  const selectedCoverage = useMemo(() => {
    if (!selectedBandId) return [];
    return showCandidates.filter((row) => row.support_band_id === selectedBandId && !blockedGigIds.has(row.gig_id));
  }, [selectedBandId, showCandidates, blockedGigIds]);

  const offeredCoverage = selectedCoverage.filter(show => !excludedDates.includes(show.gig_id));

  const selectedCandidate = candidates.find((row) => row.support_band_id === selectedBandId) ?? null;

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['tour-support-assignments', tourId] }),
      queryClient.invalidateQueries({ queryKey: ['tour-support-candidates', tourId] }),
      queryClient.invalidateQueries({ queryKey: ['tour-support-show-candidates', tourId] }),
    ]);
  };

  const sendOffers = useMutation({
    mutationFn: async () => {
      if (!selectedBandId || offeredCoverage.length === 0) return 0;
      const gigIds = offeredCoverage.map(show => show.gig_id).sort();
      const key = JSON.stringify([headlinerBandId, tourId, selectedBandId, gigIds]);
      if (request.current?.key !== key) request.current = { key, id: crypto.randomUUID() };
      return createTourSupportOffers(headlinerBandId, tourId, selectedBandId, gigIds, request.current.id);
    },
    onSuccess: async (count) => {
      toast.success(`Support offer sent for ${count} tour show${count === 1 ? '' : 's'}`);
      setSelectedBandId('');
      setExcludedDates([]);
      request.current = null;
      await refresh();
    },
    onError: async () => {
      toast.error('Could not confirm that the tour offers were sent. Refresh coverage before retrying.');
      await refresh();
    },
  });

  const cancelAssignment = useMutation({
    mutationFn: async ({ slotId, status }: { slotId: string; status: string }) => {
      if (status === 'pending') return cancelGigSupportOffer(slotId);
      return cancelConfirmedSupportSlot({ supportSlotId: slotId, reason: 'Removed from tour support lineup by headliner' });
    },
    onSuccess: async () => {
      toast.success('Support slot cancelled. This date can now be filled by another band.');
      await refresh();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Could not cancel support slot'),
  });

  if (assignmentsError || (editable && (candidatesError || showsError))) return <Card><CardContent className="p-4" role="alert">
    Support availability could not be verified. <Button variant="outline" onClick={() => void refresh()}>Retry</Button>
  </CardContent></Card>;
  if (!editable && assignments.length === 0) return null;

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base"><Users className="h-4 w-4" />Tour Support Acts</CardTitle>
            <CardDescription>Manage support coverage show-by-show. Confirmed support acts receive 20% of artist ticket revenue.</CardDescription>
          </div>
          <Badge variant="outline">1 support act per show</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <section className="space-y-2">
          <div className="flex items-center justify-between"><h4 className="text-sm font-semibold">Tour coverage</h4><span className="text-xs text-muted-foreground">{assignments.filter((a) => a.support_status === 'accepted' || a.support_status === 'completed').length}/{assignments.length} confirmed</span></div>
          {loadingAssignments ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading support assignments…</div>
          ) : assignments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No tour shows found.</p>
          ) : (
            <div className="grid gap-2 md:grid-cols-2">
              {assignments.map((row) => (
                <div key={row.gig_id} className="rounded-lg border p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-sm font-medium"><Calendar className="h-3.5 w-3.5" />{new Date(row.scheduled_date).toLocaleDateString()}</div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground"><MapPin className="h-3 w-3" />{row.city_name ?? 'City'} · {row.venue_name}</div>
                    </div>
                    <Badge variant={statusVariant(row.support_status)}>{row.support_status ?? 'Open slot'}</Badge>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-2 border-t pt-2">
                    <span className="text-sm">{row.support_band_name ?? 'No support act assigned'}</span>
                    {editable && row.support_slot_id && (row.support_status === 'pending' || row.support_status === 'accepted') && (
                      <Button size="sm" variant="ghost" disabled={cancelAssignment.isPending} onClick={() => cancelAssignment.mutate({ slotId: row.support_slot_id!, status: row.support_status! })}>
                        <X className="mr-1 h-3.5 w-3.5" />Remove
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {editable && (
          <section className="space-y-3 border-t pt-4">
            <h4 className="text-sm font-semibold">Fill open dates</h4>
            {loadingCandidates || loadingShows ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Matching support bands across the tour…</div>
            ) : candidates.length === 0 ? (
              <p className="text-sm text-muted-foreground">No eligible support bands currently cover the remaining tour dates.</p>
            ) : (
              <>
                <PlayTogetherPicker bandId={headlinerBandId} selectedId={selectedBandId} onSelect={id => { setSelectedBandId(id); setExcludedDates([]); }}
                  disabled={sendOffers.isPending}
                  candidates={candidates.map(candidate => ({ id: candidate.support_band_id, name: candidate.support_band_name,
                    fame: candidate.fame, detail: `${candidate.eligible_shows}/${candidate.total_shows} eligible dates${candidate.full_tour_match ? ' · Full tour match' : ''}` }))} />

                {selectedCandidate && (
                  <div className="rounded-lg border p-3 space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{selectedCandidate.support_band_name}</span>
                      {selectedCandidate.full_tour_match && <Badge>Full-tour match</Badge>}
                      <Badge variant="secondary">Fame {selectedCandidate.fame.toLocaleString()}</Badge>
                      <Badge variant="secondary">Popularity {selectedCandidate.popularity.toLocaleString()}</Badge>
                    </div>
                    <div className="grid gap-2 md:grid-cols-2">
                      {selectedCoverage.map((show) => (
                        <div key={show.gig_id} className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2 text-sm">
                          <label className="flex items-center gap-2"><input type="checkbox" checked={!excludedDates.includes(show.gig_id)} disabled={sendOffers.isPending}
                            onChange={event => setExcludedDates(current => event.target.checked ? current.filter(id => id !== show.gig_id) : [...current, show.gig_id])} />
                            {new Date(show.scheduled_date).toLocaleDateString()}</label>
                          <Badge variant="outline" className="gap-1"><Route className="h-3 w-3" />Travel OK</Badge>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center justify-between gap-3 border-t pt-3">
                      <p className="text-xs text-muted-foreground">Only currently open, eligible dates are included. Confirmed dates are never overwritten.</p>
                      <Button size="sm" disabled={offeredCoverage.length === 0 || sendOffers.isPending} onClick={() => sendOffers.mutate()}>
                        {sendOffers.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                        Invite to {offeredCoverage.length} dates
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </section>
        )}
      </CardContent>
    </Card>
  );
}
