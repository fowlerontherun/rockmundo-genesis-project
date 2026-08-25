import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, Loader2, MapPin, Route, Send, Users } from 'lucide-react';
import { toast } from 'sonner';
import {
  createGigSupportOffer,
  findTourSupportCandidates,
  findTourSupportShowCandidates,
} from '@/features/support-bands/api';

interface TourSupportPanelProps {
  tourId: string;
  headlinerBandId: string;
  tourStatus: string;
}

export function TourSupportPanel({ tourId, headlinerBandId, tourStatus }: TourSupportPanelProps) {
  const queryClient = useQueryClient();
  const [selectedBandId, setSelectedBandId] = useState<string>('');

  const editable = tourStatus === 'scheduled' || tourStatus === 'active';

  const { data: candidates = [], isLoading: loadingCandidates } = useQuery({
    queryKey: ['tour-support-candidates', tourId, headlinerBandId],
    queryFn: () => findTourSupportCandidates({ tourId, headlinerBandId }),
    enabled: !!tourId && !!headlinerBandId && editable,
  });

  const { data: showCandidates = [], isLoading: loadingShows } = useQuery({
    queryKey: ['tour-support-show-candidates', tourId, headlinerBandId],
    queryFn: () => findTourSupportShowCandidates({ tourId, headlinerBandId }),
    enabled: !!tourId && !!headlinerBandId && editable,
  });

  const selectedCoverage = useMemo(() => {
    if (!selectedBandId) return [];
    return showCandidates.filter((row) => row.support_band_id === selectedBandId);
  }, [selectedBandId, showCandidates]);

  const selectedCandidate = candidates.find((row) => row.support_band_id === selectedBandId) ?? null;

  const sendOffers = useMutation({
    mutationFn: async () => {
      if (!selectedBandId || selectedCoverage.length === 0) return 0;
      let sent = 0;
      for (const show of selectedCoverage) {
        await createGigSupportOffer({ gigId: show.gig_id, supportBandId: selectedBandId });
        sent += 1;
      }
      return sent;
    },
    onSuccess: async (count) => {
      toast.success(`Support offer sent for ${count} tour show${count === 1 ? '' : 's'}`);
      await queryClient.invalidateQueries({ queryKey: ['tour-support-candidates', tourId] });
      await queryClient.invalidateQueries({ queryKey: ['tour-support-show-candidates', tourId] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Could not send the tour support offer');
    },
  });

  if (!editable) return null;

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4" />
              Tour Support Acts
            </CardTitle>
            <CardDescription>
              Find bands that have marked the tour cities and dates as available. Travel feasibility is checked across adjacent stops.
            </CardDescription>
          </div>
          <Badge variant="outline">20% ticket share</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {loadingCandidates || loadingShows ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Matching support bands across the tour…
          </div>
        ) : candidates.length === 0 ? (
          <p className="text-sm text-muted-foreground">No eligible support bands currently cover any of these tour dates.</p>
        ) : (
          <>
            <Select value={selectedBandId} onValueChange={setSelectedBandId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a support band" />
              </SelectTrigger>
              <SelectContent>
                {candidates.map((candidate) => (
                  <SelectItem key={candidate.support_band_id} value={candidate.support_band_id}>
                    {candidate.support_band_name} · {candidate.eligible_shows}/{candidate.total_shows} shows
                    {candidate.full_tour_match ? ' · Full tour' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

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
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                          {new Date(show.scheduled_date).toLocaleDateString()}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <MapPin className="h-3 w-3" />
                          Eligible city/date
                        </div>
                      </div>
                      <Badge variant="outline" className="gap-1">
                        <Route className="h-3 w-3" /> Travel OK
                      </Badge>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between gap-3 border-t pt-3">
                  <p className="text-xs text-muted-foreground">
                    Offers are sent only for the {selectedCoverage.length} eligible show{selectedCoverage.length === 1 ? '' : 's'}. Each date is accepted independently by the support band.
                  </p>
                  <Button
                    size="sm"
                    disabled={selectedCoverage.length === 0 || sendOffers.isPending}
                    onClick={() => sendOffers.mutate()}
                  >
                    {sendOffers.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                    Send tour offer
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
