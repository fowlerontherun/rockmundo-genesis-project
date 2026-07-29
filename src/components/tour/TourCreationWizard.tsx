import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bus, MapPin, Plane, Waypoints } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTourBooking } from "@/hooks/useTourBooking";
import { TourBudgetCalculator } from "./TourBudgetCalculator";
import { TicketOperatorSelector } from "@/components/gig/TicketOperatorSelector";

interface TourCreationWizardProps {
  isOpen: boolean;
  onClose: () => void;
  bandId: string;
  bandName: string;
}

type SelectedVenue = {
  venueId: string;
  venueName: string;
  capacity: number;
  cityId: string;
  cityName: string;
  date: string;
  timeSlot: string;
};

type SetlistWithSongs = {
  id: string;
  name: string;
  setlist_songs?: Array<{ count: number }>;
};

const today = new Date().toISOString().slice(0, 10);

export const TourCreationWizard = ({ isOpen, onClose, bandId, bandName }: TourCreationWizardProps) => {
  const [step, setStep] = useState(1);
  const [tourName, setTourName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [setlistId, setSetlistId] = useState("");
  const [travelMode, setTravelMode] = useState<'auto' | 'manual' | 'tour_bus'>('auto');
  const [tourBusCost, setTourBusCost] = useState(500);
  const [ticketPrice, setTicketPrice] = useState(20);
  const [ticketOperatorId, setTicketOperatorId] = useState<string | null>(null);
  const [selectedVenues, setSelectedVenues] = useState<SelectedVenue[]>([]);
  const [budgetEstimate, setBudgetEstimate] = useState({ travelCosts: 0, accommodationCosts: 0, crewCosts: 0, estimatedRevenue: 0 });

  const { createTour, isCreating, calculateTourCosts } = useTourBooking();

  const { data: setlists = [] } = useQuery({
    queryKey: ['setlists', bandId],
    queryFn: async (): Promise<SetlistWithSongs[]> => {
      const { data, error } = await supabase.from('setlists').select('id, name, setlist_songs(count)').eq('band_id', bandId);
      if (error) throw error;
      return (data ?? []) as SetlistWithSongs[];
    },
  });

  const eligibleSetlists = useMemo(
    () => setlists.filter((setlist) => (setlist.setlist_songs?.[0]?.count ?? 0) >= 6),
    [setlists],
  );

  const { data: venues = [] } = useQuery({
    queryKey: ['venues-with-cities'],
    queryFn: async () => {
      const { data, error } = await supabase.from('venues').select('*, cities(id, name)').order('prestige_level');
      if (error) throw error;
      return data ?? [];
    },
  });

  const operatorRequired = selectedVenues.some((venue) => venue.capacity >= 200);
  const stopDatesValid = selectedVenues.every((venue) => venue.date && venue.date >= startDate && venue.date <= endDate);
  const duplicateStops = new Set(selectedVenues.map((venue) => `${venue.venueId}:${venue.date}:${venue.timeSlot}`)).size !== selectedVenues.length;

  useEffect(() => {
    if (!selectedVenues.length || !startDate || !endDate) return;
    void calculateTourCosts({
      name: tourName,
      artistId: bandId,
      startDate,
      endDate,
      setlistId,
      travelMode,
      tourBusCost,
      ticketPrice,
      ticketOperatorId: ticketOperatorId ?? undefined,
      venues: selectedVenues,
    }).then((costs) => setBudgetEstimate({
      ...costs,
      estimatedRevenue: selectedVenues.reduce((total, venue) => total + Math.min(venue.capacity, 100) * ticketPrice, 0),
    }));
  }, [selectedVenues, travelMode, tourBusCost, bandId, startDate, endDate, setlistId, tourName, ticketPrice, ticketOperatorId]);

  const resetAndClose = () => {
    onClose();
    setStep(1);
    setTourName("");
    setStartDate("");
    setEndDate("");
    setSetlistId("");
    setSelectedVenues([]);
    setTicketOperatorId(null);
    setTicketPrice(20);
  };

  const addVenue = (venue: any) => {
    if (!venue || selectedVenues.some((item) => item.venueId === venue.id)) return;
    const city = venue.cities as { id?: string; name?: string } | null;
    setSelectedVenues((current) => [...current, {
      venueId: venue.id,
      venueName: venue.name,
      capacity: venue.capacity ?? 0,
      cityId: city?.id ?? '',
      cityName: city?.name ?? 'Unknown',
      date: startDate,
      timeSlot: 'headline',
    }]);
  };

  const updateStop = (venueId: string, field: 'date' | 'timeSlot', value: string) => {
    setSelectedVenues((current) => current.map((venue) => venue.venueId === venueId ? { ...venue, [field]: value } : venue));
  };

  const handleSubmit = () => {
    createTour({
      name: tourName,
      artistId: bandId,
      startDate,
      endDate,
      setlistId,
      travelMode,
      tourBusCost,
      ticketPrice,
      ticketOperatorId: ticketOperatorId ?? undefined,
      venues: selectedVenues,
    }, { onSuccess: resetAndClose });
  };

  const nextDisabled =
    (step === 1 && (!tourName.trim() || !startDate || !endDate || endDate < startDate || startDate < today || !setlistId)) ||
    (step === 2 && (!selectedVenues.length || !stopDatesValid || duplicateStops)) ||
    (step === 4 && (isCreating || ticketPrice <= 0 || (operatorRequired && !ticketOperatorId)));

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && resetAndClose()}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogHeader><DialogTitle>Create New Tour - {bandName}</DialogTitle></DialogHeader>

        <div className="space-y-6">
          <div className="flex items-center justify-between">
            {[1, 2, 3, 4].map((value) => <div key={value} className={`flex h-8 w-8 items-center justify-center rounded-full font-semibold ${step >= value ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>{value}</div>)}
          </div>

          {step === 1 && <div className="space-y-4">
            <div><Label>Tour Name</Label><Input value={tourName} onChange={(event) => setTourName(event.target.value)} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Start Date</Label><Input type="date" min={today} value={startDate} onChange={(event) => setStartDate(event.target.value)} /></div>
              <div><Label>End Date</Label><Input type="date" min={startDate || today} value={endDate} onChange={(event) => setEndDate(event.target.value)} /></div>
            </div>
            <div><Label>Setlist</Label><Select value={setlistId} onValueChange={setSetlistId}><SelectTrigger><SelectValue placeholder="Choose an eligible setlist" /></SelectTrigger><SelectContent>{eligibleSetlists.map((setlist) => <SelectItem key={setlist.id} value={setlist.id}>{setlist.name}</SelectItem>)}</SelectContent></Select></div>
            {!eligibleSetlists.length && <p className="text-sm text-destructive">Create a setlist containing at least six songs before booking a tour.</p>}
          </div>}

          {step === 2 && <div className="space-y-4">
            <div className="space-y-2">
              <Label>Tour Stops ({selectedVenues.length})</Label>
              {selectedVenues.map((venue) => <Card key={venue.venueId}><CardContent className="grid gap-3 p-3 md:grid-cols-[1fr_160px_150px_auto] md:items-end">
                <div><p className="font-semibold">{venue.venueName}</p><p className="text-xs text-muted-foreground">{venue.cityName} · {venue.capacity} capacity</p></div>
                <div><Label>Date</Label><Input type="date" min={startDate} max={endDate} value={venue.date} onChange={(event) => updateStop(venue.venueId, 'date', event.target.value)} /></div>
                <div><Label>Slot</Label><Select value={venue.timeSlot} onValueChange={(value) => updateStop(venue.venueId, 'timeSlot', value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="kids">Kids</SelectItem><SelectItem value="opening">Opening</SelectItem><SelectItem value="support">Support</SelectItem><SelectItem value="headline">Headline</SelectItem></SelectContent></Select></div>
                <Button variant="ghost" onClick={() => setSelectedVenues((current) => current.filter((item) => item.venueId !== venue.venueId))}>Remove</Button>
              </CardContent></Card>)}
            </div>
            {duplicateStops && <p className="text-sm text-destructive">Duplicate venue/date/slot combinations are not allowed.</p>}
            <div className="grid max-h-[300px] grid-cols-2 gap-2 overflow-y-auto">{venues.map((venue) => <Card key={venue.id} className="cursor-pointer hover:bg-accent" onClick={() => addVenue(venue)}><CardContent className="p-3"><p className="font-semibold">{venue.name}</p><p className="text-xs text-muted-foreground">{(venue.cities as any)?.name ?? 'Unknown'}</p><Badge variant="outline" className="mt-1">{venue.capacity} capacity</Badge></CardContent></Card>)}</div>
          </div>}

          {step === 3 && <div className="grid grid-cols-3 gap-3">
            {([{ id: 'auto', icon: Plane, label: 'Auto-Book' }, { id: 'tour_bus', icon: Bus, label: 'Tour Bus' }, { id: 'manual', icon: Waypoints, label: 'Manual' }] as const).map(({ id, icon: Icon, label }) => <Card key={id} className={`cursor-pointer ${travelMode === id ? 'border-primary bg-primary/5' : ''}`} onClick={() => setTravelMode(id)}><CardContent className="p-4 text-center"><Icon className="mx-auto mb-2 h-8 w-8" /><p className="font-semibold">{label}</p></CardContent></Card>)}
            {travelMode === 'tour_bus' && <div className="col-span-3"><Label>Daily Tour Bus Cost</Label><Input type="number" min={1} value={tourBusCost} onChange={(event) => setTourBusCost(Number(event.target.value) || 500)} /></div>}
          </div>}

          {step === 4 && <div className="space-y-4">
            <div><Label>Ticket Price</Label><Input type="number" min={1} value={ticketPrice} onChange={(event) => setTicketPrice(Number(event.target.value) || 0)} /></div>
            {operatorRequired && <TicketOperatorSelector venueCapacity={Math.max(...selectedVenues.map((venue) => venue.capacity))} selectedOperatorId={ticketOperatorId} onSelectOperator={setTicketOperatorId} />}
            <TourBudgetCalculator travelCosts={budgetEstimate.travelCosts} accommodationCosts={budgetEstimate.accommodationCosts} crewCosts={budgetEstimate.crewCosts} estimatedRevenue={budgetEstimate.estimatedRevenue} numberOfGigs={selectedVenues.length} />
            <Card><CardContent className="space-y-2 p-4 text-sm"><div className="flex justify-between"><span>Tour</span><strong>{tourName}</strong></div><div className="flex justify-between"><span>Dates</span><strong>{startDate} to {endDate}</strong></div><div className="flex justify-between"><span>Stops</span><strong>{selectedVenues.length}</strong></div></CardContent></Card>
          </div>}

          <div className="flex justify-between border-t pt-4">
            <Button variant="outline" onClick={() => step > 1 ? setStep(step - 1) : resetAndClose()}>{step === 1 ? 'Cancel' : 'Back'}</Button>
            <Button onClick={() => step < 4 ? setStep(step + 1) : handleSubmit()} disabled={nextDisabled}>{step === 4 ? (isCreating ? 'Creating...' : 'Create Tour') : 'Next'}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
