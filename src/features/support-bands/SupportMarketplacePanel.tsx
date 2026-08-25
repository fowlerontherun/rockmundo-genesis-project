import { useCallback, useEffect, useMemo, useState } from 'react';
import { Calendar, Check, Loader2, MapPin, Music2, Plus, Search, Users, X } from 'lucide-react';
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
    venue: { id: string; name: string; city_id: string | null } | null;
    headliner: { id: string; name: string } | null;
  } | null;
};
type HeadlinerGig = {
  id: string;
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
  const [offers, setOffers] = useState<SupportOfferView[]>([]);
  const [gigs, setGigs] = useState<HeadlinerGig[]>([]);
  const [selectedCity, setSelectedCity] = useState('');
  const [availableFrom, setAvailableFrom] = useState('');
  const [availableUntil, setAvailableUntil] = useState('');
  const [selectedGigId, setSelectedGigId] = useState('');
  const [candidates, setCandidates] = useState<AvailableSupportBand[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searching, setSearching] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const cityNames = useMemo(() => new Map(cities.map((city) => [city.id, city.name])), [cities]);

  const loadMarketplace = useCallback(async () => {
    setLoading(true);
    try {
      const [prefRow, availabilityRows, cityResult, offerResult, gigResult] = await Promise.all([
        getSupportPreferences(bandId),
        listSupportAvailability(bandId),
        (supabase as any).from('cities').select('id,name,country').order('country').order('name'),
        (supabase as any)
          .from('gig_support_slots')
          .select('id,status,revenue_share,invited_at,gig:gigs!gig_support_slots_gig_id_fkey(id,scheduled_date,scheduled_end,band_id,venue:venues!gigs_venue_id_fkey(id,name,city_id),headliner:bands!gigs_band_id_fkey(id,name))')
          .eq('support_band_id', bandId)
          .order('invited_at', { ascending: false }),
        (supabase as any)
          .from('gigs')
          .select('id,scheduled_date,scheduled_end,venue:venues!gigs_venue_id_fkey(id,name,city_id,capacity)')
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
    } catch (error: any) {
      toast({ title: 'Support marketplace unavailable', description: error?.message ?? 'Could not load support data.', variant: 'destructive' });
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
    } catch (error: any) {
      toast({ title: 'Could not save preferences', description: error?.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const addAvailability = async () => {
    if (!selectedCity || !availableFrom || !availableUntil) return;
    setSaving(true);
    try {
      await addSupportAvailability({ bandId, cityId: selectedCity, availableFrom, availableUntil });
      setSelectedCity(''); setAvailableFrom(''); setAvailableUntil('');
      await loadMarketplace();
      toast({ title: 'Availability added' });
    } catch (error: any) {
      toast({ title: 'Could not add availability', description: error?.message, variant: 'destructive' });
    } finally { setSaving(false); }
  };

  const toggleAvailability = async (row: SupportAvailability) => {
    setBusyId(row.id);
    try {
      await setSupportAvailabilityStatus(row.id, row.status === 'active' ? 'disabled' : 'active');
      await loadMarketplace();
    } catch (error: any) {
      toast({ title: 'Could not update availability', description: error?.message, variant: 'destructive' });
    } finally { setBusyId(null); }
  };

  const respond = async (offerId: string, action: 'accept' | 'decline') => {
    setBusyId(offerId);
    try {
      await respondToGigSupportOffer({ supportSlotId: offerId, action });
      await loadMarketplace();
      toast({ title: action === 'accept' ? 'Support slot accepted' : 'Support slot declined' });
    } catch (error: any) {
      toast({ title: `Could not ${action} support slot`, description: error?.message, variant: 'destructive' });
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
      });
      setCandidates(rows);
    } catch (error: any) {
      toast({ title: 'Could not find support bands', description: error?.message, variant: 'destructive' });
    } finally { setSearching(false); }
  };

  const inviteCandidate = async (supportBandId: string) => {
    if (!selectedGigId) return;
    setBusyId(supportBandId);
    try {
      await createGigSupportOffer({ gigId: selectedGigId, supportBandId });
      toast({ title: 'Support offer sent', description: 'The band can now accept or decline the slot.' });
      setCandidates((current) => current.filter((item) => item.band_id !== supportBandId));
    } catch (error: any) {
      toast({ title: 'Could not send support offer', description: error?.message, variant: 'destructive' });
    } finally { setBusyId(null); }
  };

  if (loading) {
    return <Card><CardContent className="flex items-center gap-2 p-6 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading support marketplace...</CardContent></Card>;
  }

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" /> Support Band Marketplace</CardTitle>
        <CardDescription>Advertise support availability, respond to offers, or find a support act for your own headline gigs.</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="availability" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="availability">Availability</TabsTrigger>
            <TabsTrigger value="offers">Offers</TabsTrigger>
            <TabsTrigger value="headliner">Find Support</TabsTrigger>
          </TabsList>

          <TabsContent value="availability" className="space-y-4">
            <div className="grid gap-4 rounded-lg border p-4 md:grid-cols-2">
              <div className="flex items-center justify-between gap-4 md:col-span-2">
                <div><Label>Available for support slots</Label><p className="text-sm text-muted-foreground">Only enabled bands appear in support searches.</p></div>
                <Switch checked={prefs.enabled} onCheckedChange={(enabled) => setPrefs((p) => ({ ...p, enabled }))} />
              </div>
              <div className="flex items-center justify-between"><Label>Single gigs</Label><Switch checked={prefs.single_gigs_enabled} onCheckedChange={(single_gigs_enabled) => setPrefs((p) => ({ ...p, single_gigs_enabled }))} /></div>
              <div className="flex items-center justify-between"><Label>Tour dates</Label><Switch checked={prefs.tour_enabled} onCheckedChange={(tour_enabled) => setPrefs((p) => ({ ...p, tour_enabled }))} /></div>
              <div><Label>Minimum headliner fame</Label><Input type="number" min={0} value={prefs.minimum_headliner_fame} onChange={(e) => setPrefs((p) => ({ ...p, minimum_headliner_fame: Number(e.target.value) || 0 }))} /></div>
              <div><Label>Minimum venue capacity</Label><Input type="number" min={0} value={prefs.minimum_venue_capacity} onChange={(e) => setPrefs((p) => ({ ...p, minimum_venue_capacity: Number(e.target.value) || 0 }))} /></div>
              <div className="md:col-span-2"><Button onClick={savePrefs} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save preferences</Button></div>
            </div>

            <div className="grid gap-3 rounded-lg border p-4 md:grid-cols-4">
              <div className="md:col-span-2"><Label>City</Label><Select value={selectedCity} onValueChange={setSelectedCity}><SelectTrigger><SelectValue placeholder="Choose city" /></SelectTrigger><SelectContent>{cities.map((city) => <SelectItem key={city.id} value={city.id}>{city.name}{city.country ? ` · ${city.country}` : ''}</SelectItem>)}</SelectContent></Select></div>
              <div><Label>From</Label><Input type="date" value={availableFrom} onChange={(e) => setAvailableFrom(e.target.value)} /></div>
              <div><Label>Until</Label><Input type="date" value={availableUntil} onChange={(e) => setAvailableUntil(e.target.value)} /></div>
              <div className="md:col-span-4"><Button variant="secondary" onClick={addAvailability} disabled={saving || !selectedCity || !availableFrom || !availableUntil}><Plus className="mr-2 h-4 w-4" />Add availability</Button></div>
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
            {offers.length === 0 ? <p className="text-sm text-muted-foreground">No support offers yet.</p> : offers.map((offer) => (
              <div key={offer.id} className="rounded-lg border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div><p className="font-semibold">{offer.gig?.headliner?.name ?? 'Headliner'} · {offer.gig?.venue?.name ?? 'Venue'}</p><p className="text-sm text-muted-foreground">{formatDateTime(offer.gig?.scheduled_date)} · 20% artist ticket revenue</p></div>
                  <Badge variant={offer.status === 'accepted' ? 'default' : 'outline'}>{offer.status}</Badge>
                </div>
                {offer.status === 'pending' && <div className="mt-3 flex gap-2"><Button size="sm" onClick={() => respond(offer.id, 'accept')} disabled={busyId === offer.id}><Check className="mr-2 h-4 w-4" />Accept</Button><Button size="sm" variant="outline" onClick={() => respond(offer.id, 'decline')} disabled={busyId === offer.id}><X className="mr-2 h-4 w-4" />Decline</Button></div>}
              </div>
            ))}
          </TabsContent>

          <TabsContent value="headliner" className="space-y-4">
            <div className="flex flex-col gap-3 rounded-lg border p-4 md:flex-row md:items-end">
              <div className="flex-1"><Label>Upcoming headline gig</Label><Select value={selectedGigId} onValueChange={(value) => { setSelectedGigId(value); setCandidates([]); }}><SelectTrigger><SelectValue placeholder="Choose a gig" /></SelectTrigger><SelectContent>{gigs.map((gig) => <SelectItem key={gig.id} value={gig.id}>{gig.venue?.name ?? 'Venue'} · {new Date(gig.scheduled_date).toLocaleDateString()}</SelectItem>)}</SelectContent></Select></div>
              <Button onClick={searchCandidates} disabled={!selectedGigId || searching}>{searching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}Find available bands</Button>
            </div>
            {selectedGigId && !searching && candidates.length === 0 && <p className="text-sm text-muted-foreground">Search to see bands that have this city/date advertised and are conflict-free.</p>}
            <div className="grid gap-3 md:grid-cols-2">
              {candidates.map((candidate) => <Card key={candidate.band_id}><CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Music2 className="h-4 w-4" />{candidate.band_name}</CardTitle><CardDescription>Fame {candidate.fame} · Popularity {candidate.popularity}</CardDescription></CardHeader><CardContent><div className="mb-3 flex items-center gap-2 text-sm text-muted-foreground"><Calendar className="h-4 w-4" />Available {candidate.available_from} to {candidate.available_until}</div><Button size="sm" onClick={() => inviteCandidate(candidate.band_id)} disabled={busyId === candidate.band_id}>Offer support slot</Button></CardContent></Card>)}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
