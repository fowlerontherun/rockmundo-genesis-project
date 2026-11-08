import { useQuery } from '@tanstack/react-query';
import { ConfirmedSupportSlotsPanel } from './ConfirmedSupportSlotsPanel';
import { SupportHistoryPanel } from './SupportHistoryPanel';
import { useSearchParams } from 'react-router-dom';
import { TouringAvailabilityPanel } from './TouringAvailabilityPanel';
import { TourProposalsPanel } from './TourProposalsPanel';
import { listPlayTogetherCities, listTourProposals } from './completionApi';
import { respondToTourSupportOffers, type SupportOfferSnapshot } from './groupedOffersApi';
import { BandFriendsPanel } from './BandFriendsPanel';
import { PlayTogetherPicker } from './PlayTogetherPicker';
import { LabelSuggestionsPanel } from './LabelSuggestionsPanel';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Loader2, MapPin, Plus, Search, Users, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { getGigBookingPlayerError } from '@/utils/gigBookingErrors';
import {
  addSupportAvailability,
  createGigSupportOffer,
  findAvailableSupportBands,
  getSupportPreferences,
  listSupportAvailability,
  respondToGigSupportOffer,
  saveSupportPreferences,
  setSupportAvailabilityStatus,
  type AvailableSupportBand,
  type SupportAvailability,
  type SupportPreferences,
} from './api';

type City = { id: string; name: string; country: string | null };

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string') return message;
  }
  return fallback;
};

type SupportOfferView = {
  id: string;
  status: string;
  revenue_share: number;
  invited_at: string;
  gig: {
    id: string;
    scheduled_date: string;
    scheduled_end: string | null;
    band_id: string;
    tour_id: string | null;
    venue: { id: string; name: string; city_id: string | null } | null;
    headliner: { id: string; name: string } | null;
  } | null;
};
type HeadlinerGig = {
  id: string;
  tour_id: string | null;
  scheduled_date: string;
  scheduled_end: string | null;
  venue: { id: string; name: string; city_id: string | null; capacity: number | null } | null;
};

const DEFAULT_PREFS: Omit<SupportPreferences, 'band_id' | 'created_at' | 'updated_at'> = {
  enabled: false,
  single_gigs_enabled: true,
  tour_enabled: true,
  travel_enabled: false,
  max_travel_minutes: null,
  minimum_headliner_fame: 0,
  minimum_venue_capacity: 0,
  preferred_genres: [],
};

const formatDateTime = (value?: string | null) =>
  value ? new Date(value).toLocaleString() : 'Unknown time';

export function SupportMarketplacePanel({ bandId }: { bandId: string }) {
  const { toast } = useToast();
  const [cities, setCities] = useState<City[]>([]);
  const [prefs, setPrefs] = useState(DEFAULT_PREFS);
  const [availability, setAvailability] = useState<SupportAvailability[]>([]);
  const [searchParams] = useSearchParams();
  const proposalState = useQuery({ queryKey: ['support-tour-proposals', bandId], queryFn: () => listTourProposals(bandId) });
  const proposalSlots = (proposalState.data ?? []).flatMap(proposal => proposal.slot_ids);
  const [activeTab, setActiveTab] = useState('availability');
  const [offers, setOffers] = useState<SupportOfferView[]>([]);
  const [gigs, setGigs] = useState<HeadlinerGig[]>([]);
  const [selectedCities, setSelectedCities] = useState<string[]>([]);
  const [citySearch, setCitySearch] = useState('');
  const [availableFrom, setAvailableFrom] = useState('');
  const [availableUntil, setAvailableUntil] = useState('');
  const [selectedGigId, setSelectedGigId] = useState('');
  const [candidates, setCandidates] = useState<AvailableSupportBand[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searching, setSearching] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const cityNames = useMemo(() => new Map(cities.map((city) => [city.id, city.name])), [cities]);
  const filteredCities = useMemo(() => {
    const query = citySearch.trim().toLowerCase();
    if (!query) return cities;
    return cities.filter((city) => `${city.name} ${city.country ?? ''}`.toLowerCase().includes(query));
  }, [cities, citySearch]);

  useEffect(() => { const gigId = searchParams.get('gigId'); if (gigId) setSelectedGigId(gigId); const section = searchParams.get('section'); if (section && ['availability','offers','headliner','friends'].includes(section)) setActiveTab(section); }, [searchParams]);

  const loadMarketplace = useCallback(async () => {
    setLoading(true);
    try {
      const [prefRow, availabilityRows, cityResult, offerResult, gigResult] = await Promise.all([
        getSupportPreferences(bandId),
        listSupportAvailability(bandId),
        listPlayTogetherCities(),
        supabase
          .from('gig_support_slots')
          .select('id,status,revenue_share,invited_at,gig:gigs!gig_support_slots_gig_id_fkey(id,scheduled_date,scheduled_end,band_id,tour_id,venue:venues!gigs_venue_id_fkey(id,name,city_id),headliner:bands!gigs_band_id_fkey(id,name))')
          .eq('support_band_id', bandId)
          .order('invited_at', { ascending: false }),
        supabase
          .from('gigs')
          .select('id,tour_id,scheduled_date,scheduled_end,venue:venues!gigs_venue_id_fkey(id,name,city_id,capacity)')
          .eq('band_id', bandId)
          .in('status', ['scheduled', 'in_progress', 'ready_for_completion'])
          .gte('scheduled_date', new Date().toISOString())
          .order('scheduled_date', { ascending: true }),
      ]);

      if (cityResult.error) throw cityResult.error;
      if (offerResult.error) throw offerResult.error;
      if (gigResult.error) throw gigResult.error;

      if (prefRow) {
        setPrefs({
          enabled: prefRow.enabled,
          single_gigs_enabled: prefRow.single_gigs_enabled,
          tour_enabled: prefRow.tour_enabled,
          travel_enabled: prefRow.travel_enabled,
          max_travel_minutes: prefRow.max_travel_minutes,
          minimum_headliner_fame: prefRow.minimum_headliner_fame,
          minimum_venue_capacity: prefRow.minimum_venue_capacity,
          preferred_genres: prefRow.preferred_genres ?? [],
        });
      }
      setAvailability(availabilityRows);
      setCities((cityResult.data ?? []) as City[]);
      setOffers((offerResult.data ?? []) as SupportOfferView[]);
      setGigs((gigResult.data ?? []) as HeadlinerGig[]);
    } catch (error: unknown) {
      toast({ title: 'Support marketplace unavailable', description: getErrorMessage(error, 'Could not load support data.'), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [bandId, toast]);

  useEffect(() => { void loadMarketplace(); }, [loadMarketplace]);

  const savePrefs = async () => {
    setSaving(true);
    try {
      await saveSupportPreferences(bandId, prefs);
      toast({ title: 'Support preferences saved', description: prefs.enabled ? 'Your band can now appear in eligible support searches.' : 'Your band is no longer advertising support availability.' });
    } catch (error: unknown) {
      toast({ title: 'Could not save preferences', description: getErrorMessage(error, 'Please try again.'), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const toggleCitySelection = (cityId: string) => {
    setSelectedCities((current) => current.includes(cityId)
      ? current.filter((id) => id !== cityId)
      : [...current, cityId]);
  };

  const addAvailability = async () => {
    if (selectedCities.length === 0 || !availableFrom || !availableUntil) return;
    if (availableUntil < availableFrom) {
      toast({ title: 'Invalid date range', description: 'The end date must be on or after the start date.', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      await Promise.all(selectedCities.map((cityId) => addSupportAvailability({
        bandId,
        cityId,
        availableFrom,
        availableUntil,
      })));
      const addedCount = selectedCities.length;
      setSelectedCities([]);
      setCitySearch('');
      await loadMarketplace();
      toast({
        title: 'Availability added',
        description: `${addedCount} ${addedCount === 1 ? 'city' : 'cities'} added for ${availableFrom} to ${availableUntil}.`,
      });
    } catch (error: unknown) {
      toast({ title: 'Could not add availability', description: getErrorMessage(error, 'Please try again.'), variant: 'destructive' });
    } finally { setSaving(false); }
  };

  const toggleAvailability = async (row: SupportAvailability) => {
    setBusyId(row.id);
    try {
      await setSupportAvailabilityStatus(row.id, row.status === 'active' ? 'disabled' : 'active');
      await loadMarketplace();
    } catch (error: unknown) {
      toast({ title: 'Could not update availability', description: getErrorMessage(error, 'Please try again.'), variant: 'destructive' });
    } finally { setBusyId(null); }
  };

  const tourGroups = Object.values(offers.filter(offer => proposalState.isSuccess && !proposalSlots.includes(offer.id)).reduce<Record<string, SupportOfferView[]>>((groups, offer) => {
    if (offer.status === 'pending' && offer.gig?.tour_id && offer.gig.venue) {
      const key = `${offer.gig.tour_id}:${offer.gig.band_id}`;
      (groups[key] ??= []).push(offer);
    }
    return groups;
  }, {}));
  const respondToTour = async (group: SupportOfferView[], action: 'accept' | 'decline') => {
    setBusyId(group[0].id);
    try {
      const snapshots: SupportOfferSnapshot[] = group.map(offer => ({
        slot_id: offer.id, gig_id: offer.gig!.id, tour_id: offer.gig!.tour_id!,
        scheduled_date: offer.gig!.scheduled_date, scheduled_end: offer.gig!.scheduled_end,
        venue_id: offer.gig!.venue!.id, revenue_share: offer.revenue_share,
      }));
      await respondToTourSupportOffers(snapshots, action);
      toast({ title: action === 'accept' ? 'Tour dates accepted' : 'Tour dates declined' });
    } catch {
      toast({ title: `Could not confirm tour dates ${action === 'accept' ? 'accepted' : 'declined'}`,
        description: 'Review the refreshed offers before retrying. Dates or availability may have changed.', variant: 'destructive' });
    } finally {
      await loadMarketplace();
      setBusyId(null);
    }
  };

  const respond = async (offerId: string, action: 'accept' | 'decline') => {
    setBusyId(offerId);
    try {
      await respondToGigSupportOffer({ supportSlotId: offerId, action });
      await loadMarketplace();
      toast({ title: action === 'accept' ? 'Support slot accepted' : 'Support slot declined' });
    } catch (error: unknown) {
      const message = getErrorMessage(error, 'Please try again.');
      const isGigDayConflict = message.includes('gig_booking_same_day_');
      const playerError = isGigDayConflict ? getGigBookingPlayerError({ message }) : null;
      toast({
        title: playerError?.title ?? `Could not ${action} support slot`,
        description: playerError?.description ?? message,
        variant: 'destructive',
      });
    } finally { setBusyId(null); }
  };

  const searchCandidates = async () => {
    const gig = gigs.find((item) => item.id === selectedGigId);
    if (!gig?.venue?.city_id) return;
    setSearching(true);
    try {
      const rows = await findAvailableSupportBands({
        headlinerBandId: bandId,
        cityId: gig.venue.city_id,
        start: gig.scheduled_date,
        end: gig.scheduled_end ?? new Date(new Date(gig.scheduled_date).getTime() + 3 * 60 * 60 * 1000).toISOString(),
        venueCapacity: gig.venue.capacity ?? 0,
        forTour: Boolean(gig.tour_id),
      });
      setCandidates(rows);
    } catch (error: unknown) {
      toast({ title: 'Could not find support bands', description: getErrorMessage(error, 'Please try again.'), variant: 'destructive' });
    } finally { setSearching(false); }
  };

  const inviteCandidate = async (supportBandId: string) => {
    if (!selectedGigId) return;
    setBusyId(supportBandId);
    try {
      await createGigSupportOffer({ gigId: selectedGigId, supportBandId });
      toast({ title: 'Support offer sent', description: 'The band can now accept or decline the slot.' });
      setCandidates((current) => current.filter((item) => item.band_id !== supportBandId));
    } catch (error: unknown) {
      toast({ title: 'Could not send support offer', description: getErrorMessage(error, 'Please try again.'), variant: 'destructive' });
    } finally { setBusyId(null); }
  };

  if (loading) {
    return <Card><CardContent className="flex items-center gap-2 p-6 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading support marketplace...</CardContent></Card>;
  }

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" /> Play Together</CardTitle>
        <CardDescription>Advertise support availability, respond to offers, or find a support act for your own headline gigs.</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid h-auto w-full grid-cols-2 overflow-visible sm:grid-cols-4">
            <TabsTrigger value="availability">Availability</TabsTrigger>
            <TabsTrigger value="offers">Offers</TabsTrigger>
            <TabsTrigger value="headliner">Find Support</TabsTrigger>
            <TabsTrigger value="friends">Friends &amp; labels</TabsTrigger>
          </TabsList>

          <TabsContent value="friends" className="space-y-4"><BandFriendsPanel key={bandId} bandId={bandId} /><LabelSuggestionsPanel key={`label-${bandId}`} bandId={bandId} onFindSupport={() => setActiveTab('headliner')} /></TabsContent>

          <TabsContent value="availability" className="space-y-4">
            <TouringAvailabilityPanel key={bandId} bandId={bandId} onSaved={loadMarketplace} countries={[...new Set(cities.map(city => city.country).filter((country): country is string => !!country))].sort()} />
            <div className="grid gap-4 rounded-lg border p-4 md:grid-cols-2">
              <div className="flex items-center justify-between gap-4 md:col-span-2">
                <div><Label>Open to support offers</Label><p className="text-sm text-muted-foreground">Only enabled bands appear in support searches.</p></div>
                <Switch checked={prefs.enabled} onCheckedChange={(enabled) => setPrefs((p) => ({ ...p, enabled }))} />
              </div>
              <div className="flex items-center justify-between"><Label>Single gigs</Label><Switch checked={prefs.single_gigs_enabled} onCheckedChange={(single_gigs_enabled) => setPrefs((p) => ({ ...p, single_gigs_enabled }))} /></div>
              <div className="flex items-center justify-between"><Label>Open to touring with other bands</Label><Switch checked={prefs.tour_enabled} onCheckedChange={(tour_enabled) => setPrefs((p) => ({ ...p, tour_enabled }))} /></div>
              <div><Label>Minimum headliner fame</Label><Input type="number" min={0} value={prefs.minimum_headliner_fame} onChange={(e) => setPrefs((p) => ({ ...p, minimum_headliner_fame: Number(e.target.value) || 0 }))} /></div>
              <div><Label>Minimum venue capacity</Label><Input type="number" min={0} value={prefs.minimum_venue_capacity} onChange={(e) => setPrefs((p) => ({ ...p, minimum_venue_capacity: Number(e.target.value) || 0 }))} /></div>
              <div className="md:col-span-2"><Button onClick={savePrefs} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save preferences</Button></div>
            </div>

            <div className="space-y-4 rounded-lg border p-4">
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <Label>From</Label>
                  <Input type="date" value={availableFrom} onChange={(e) => setAvailableFrom(e.target.value)} />
                </div>
                <div>
                  <Label>Until</Label>
                  <Input type="date" value={availableUntil} onChange={(e) => setAvailableUntil(e.target.value)} />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <Label>Cities</Label>
                    <p className="text-sm text-muted-foreground">Select every city where these same dates should apply.</p>
                  </div>
                  {selectedCities.length > 0 && <Badge variant="secondary">{selectedCities.length} selected</Badge>}
                </div>
                <Input
                  value={citySearch}
                  onChange={(e) => setCitySearch(e.target.value)}
                  placeholder="Search cities or countries..."
                  aria-label="Search support opportunity cities"
                />
                <div className="max-h-64 overflow-y-auto rounded-md border p-2">
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {filteredCities.map((city) => {
                      const selected = selectedCities.includes(city.id);
                      return (
                        <Button
                          key={city.id}
                          type="button"
                          variant={selected ? 'default' : 'outline'}
                          className="h-auto min-h-10 justify-start whitespace-normal px-3 py-2 text-left"
                          onClick={() => toggleCitySelection(city.id)}
                          aria-pressed={selected}
                        >
                          {selected && <Check className="mr-2 h-4 w-4 shrink-0" />}
                          <span>{city.name}{city.country ? <span className="text-xs opacity-80"> · {city.country}</span> : null}</span>
                        </Button>
                      );
                    })}
                  </div>
                  {filteredCities.length === 0 && <p className="p-3 text-sm text-muted-foreground">No matching cities.</p>}
                </div>
                {selectedCities.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {selectedCities.map((cityId) => (
                      <Badge key={cityId} variant="outline" className="gap-1 pr-1">
                        {cityNames.get(cityId) ?? 'City'}
                        <button
                          type="button"
                          className="rounded p-0.5 hover:bg-muted"
                          onClick={() => toggleCitySelection(cityId)}
                          aria-label={`Remove ${cityNames.get(cityId) ?? 'city'}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              <Button
                variant="secondary"
                onClick={addAvailability}
                disabled={saving || selectedCities.length === 0 || !availableFrom || !availableUntil}
              >
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                Add availability to {selectedCities.length || 0} {selectedCities.length === 1 ? 'city' : 'cities'}
              </Button>
            </div>

            <div className="space-y-2">
              {availability.length === 0 ? <p className="text-sm text-muted-foreground">No support dates advertised yet.</p> : availability.map((row) => (
                <div key={row.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
                  <div className="flex items-center gap-3"><MapPin className="h-4 w-4 text-muted-foreground" /><div><p className="font-medium">{cityNames.get(row.city_id) ?? 'City'}</p><p className="text-sm text-muted-foreground">{row.available_from} to {row.available_until}</p></div></div>
                  <div className="flex items-center gap-2"><Badge variant={row.status === 'active' ? 'default' : 'secondary'}>{row.status}</Badge><Button size="sm" variant="outline" disabled={busyId === row.id} onClick={() => toggleAvailability(row)}>{row.status === 'active' ? 'Pause' : 'Enable'}</Button></div>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="offers" className="space-y-3">
            <TourProposalsPanel bandId={bandId} />
            <ConfirmedSupportSlotsPanel key={proposalState.dataUpdatedAt} bandId={bandId} />
            <details><summary className="cursor-pointer font-semibold">Completed shows, payments and reputation</summary><SupportHistoryPanel bandId={bandId} /></details>
            {tourGroups.map(group => (
              <div key={group[0].gig!.tour_id} className="rounded-lg border p-4">
                <p className="font-semibold">Tour with {group[0].gig?.headliner?.name ?? 'Headliner'} · {group.length} offered dates</p>
                <p className="text-sm text-muted-foreground">Review every date below. Accept or decline all pending dates together, or expand the individual date actions.</p>
                <ul className="my-3 space-y-1 text-sm">{group.map(offer => <li key={offer.id}>{formatDateTime(offer.gig?.scheduled_date)} · {offer.gig?.venue?.name} · {Math.round(offer.revenue_share * 100)}% artist ticket revenue</li>)}</ul>
                <div className="flex flex-wrap gap-2">
                  <Button disabled={busyId !== null} onClick={() => respondToTour(group, 'accept')}>Accept all {group.length} dates</Button>
                  <Button variant="outline" disabled={busyId !== null} onClick={() => respondToTour(group, 'decline')}>Decline all dates</Button>
                </div>
                <details className="mt-3 text-sm"><summary className="cursor-pointer">Respond to individual dates</summary>
                  {group.map(offer => <div key={offer.id} className="mt-2 flex flex-wrap items-center gap-2">
                    <span>{formatDateTime(offer.gig?.scheduled_date)} · {offer.gig?.venue?.name}</span>
                    <Button size="sm" variant="outline" disabled={busyId !== null} onClick={() => respond(offer.id, 'accept')}>Accept date</Button>
                    <Button size="sm" variant="outline" disabled={busyId !== null} onClick={() => respond(offer.id, 'decline')}>Decline date</Button>
                  </div>)}
                </details>
              </div>
            ))}
            {offers.length === 0 ? <p className="text-sm text-muted-foreground">No support offers yet.</p> : offers.filter(offer => proposalState.isSuccess && !proposalSlots.includes(offer.id)).filter(offer => !(offer.status === 'pending' && offer.gig?.tour_id && offer.gig.venue)).map((offer) => (
              <div key={offer.id} className="rounded-lg border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div><p className="font-semibold">{offer.gig?.headliner?.name ?? 'Headliner'} · {offer.gig?.venue?.name ?? 'Venue'}</p><p className="text-sm text-muted-foreground">{formatDateTime(offer.gig?.scheduled_date)} · {Math.round(offer.revenue_share * 100)}% artist ticket revenue</p></div>
                  <Badge variant={offer.status === 'accepted' ? 'default' : 'outline'}>{offer.status}</Badge>
                </div>
                {offer.status === 'pending' && <div className="mt-3 flex gap-2"><Button size="sm" onClick={() => respond(offer.id, 'accept')} disabled={busyId !== null}><Check className="mr-2 h-4 w-4" />Accept</Button><Button size="sm" variant="outline" onClick={() => respond(offer.id, 'decline')} disabled={busyId !== null}><X className="mr-2 h-4 w-4" />Decline</Button></div>}
              </div>
            ))}
          </TabsContent>

          <TabsContent value="headliner" className="space-y-4">
            <div className="flex flex-col gap-3 rounded-lg border p-4 md:flex-row md:items-end">
              <div className="flex-1"><Label>Upcoming headline gig</Label><Select value={selectedGigId} onValueChange={(value) => { setSelectedGigId(value); setCandidates([]); }}><SelectTrigger><SelectValue placeholder="Choose a gig" /></SelectTrigger><SelectContent>{gigs.map((gig) => <SelectItem key={gig.id} value={gig.id}>{gig.venue?.name ?? 'Venue'} · {new Date(gig.scheduled_date).toLocaleDateString()}</SelectItem>)}</SelectContent></Select></div>
              <Button onClick={searchCandidates} disabled={!selectedGigId || searching}>{searching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}Find available bands</Button>
            </div>
            {selectedGigId && !searching && candidates.length === 0 && <p className="text-sm text-muted-foreground">Search to see bands that have this city/date advertised and are conflict-free.</p>}
            <PlayTogetherPicker key={`${bandId}:${selectedGigId}`} bandId={bandId}
              selectedId={searchParams.get('targetBand') ?? undefined} candidates={candidates.map(candidate => ({ id: candidate.band_id, name: candidate.band_name, fame: candidate.fame,
                detail: `Available ${candidate.available_from} to ${candidate.available_until}` }))}
              onSelect={inviteCandidate} disabled={busyId !== null || searching} actionLabel="Offer support slot" />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
