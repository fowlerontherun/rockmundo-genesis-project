import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, MapPin, Music, DollarSign, Bus, Plane, Waypoints } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTourBooking, type TourBookingData } from "@/hooks/useTourBooking";
import { TourBudgetCalculator } from "./TourBudgetCalculator";

interface TourCreationWizardProps {
  isOpen: boolean;
  onClose: () => void;
  bandId: string;
  bandName: string;
}

export const TourCreationWizard = ({ isOpen, onClose, bandId, bandName }: TourCreationWizardProps) => {
  const [step, setStep] = useState(1);
  const [tourName, setTourName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [setlistId, setSetlistId] = useState("");
  const [travelMode, setTravelMode] = useState<'auto' | 'manual' | 'tour_bus'>('auto');
  const [tourBusCost, setTourBusCost] = useState(500);
  const [selectedVenues, setSelectedVenues] = useState<Array<{
    venueId: string;
    venueName: string;
    cityId: string;
    cityName: string;
    date: string;
    timeSlot: string;
  }>>([]);
  const [budgetEstimate, setBudgetEstimate] = useState({
    travelCosts: 0,
    accommodationCosts: 0,
    crewCosts: 0,
    estimatedRevenue: 0,
  });

  const { createTour, isCreating, calculateTourCosts } = useTourBooking();

  const { data: setlists } = useQuery({
    queryKey: ['setlists', bandId],
    queryFn: async () => {
      const { data } = await supabase
        .from('setlists')
        .select('*')
        .eq('band_id', bandId);
      return data || [];
    },
  });

  const { data: venues } = useQuery({
    queryKey: ['venues-with-cities'],
    queryFn: async () => {
      const { data } = await supabase
        .from('venues')
        .select('*, cities(id, name)')
        .order('prestige_level');
      return data || [];
    },
  });

  useEffect(() => {
    // Recalculate budget when venues or travel mode changes
    if (selectedVenues.length > 0) {
      calculateTourCosts({
        name: tourName,
        artistId: bandId,
        startDate,
        endDate,
        setlistId,
        travelMode,
        tourBusCost,
        venues: selectedVenues.map(v => ({
          venueId: v.venueId,
          cityId: v.cityId,
          date: v.date,
          timeSlot: v.timeSlot,
        })),
      }).then(costs => {
        setBudgetEstimate({
          ...costs,
          estimatedRevenue: selectedVenues.length * 2000, // Rough estimate
        });
      });
    }
  }, [selectedVenues, travelMode, tourBusCost, bandId, startDate, endDate, setlistId, tourName, calculateTourCosts]);

  const handleSubmit = () => {
    createTour({
      name: tourName,
      artistId: bandId,
      startDate,
      endDate,
      setlistId,
      travelMode,
      tourBusCost,
      venues: selectedVenues.map(v => ({
        venueId: v.venueId,
        cityId: v.cityId,
        date: v.date,
        timeSlot: v.timeSlot,
      })),
    }, {
      onSuccess: () => {
        onClose();
        setStep(1);
        // Reset form
        setTourName("");
        setStartDate("");
        setEndDate("");
        setSetlistId("");
        setSelectedVenues([]);
      },
    });
  };

  const addVenue = (venue: any) => {
    if (!venue || selectedVenues.find(v => v.venueId === venue.id)) return;

    const cities: any = venue.cities;
    setSelectedVenues([...selectedVenues, {
      venueId: venue.id,
      venueName: venue.name,
      cityId: cities?.id || '',
      cityName: cities?.name || 'Unknown',
      date: startDate,
      timeSlot: 'headline',
    }]);
  };

  const removeVenue = (venueId: string) => {
    setSelectedVenues(selectedVenues.filter(v => v.venueId !== venueId));
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Tour - {bandName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Progress Indicator */}
          <div className="flex items-center justify-between mb-6">
            {[1, 2, 3, 4].map((s) => (
              <div key={s} className="flex items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold ${
                  step >= s ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                }`}>
                  {s}
                </div>
                {s < 4 && <div className={`w-12 h-0.5 ${step > s ? 'bg-primary' : 'bg-muted'}`} />}
              </div>
            ))}
          </div>

          {/* Step 1: Basic Info */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <Label>Tour Name</Label>
                <Input
                  value={tourName}
                  onChange={(e) => setTourName(e.target.value)}
                  placeholder="e.g., Summer Tour 2025"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Start Date</Label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div>
                  <Label>End Date</Label>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <Label>Setlist</Label>
                <Select value={setlistId} onValueChange={setSetlistId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a setlist" />
                  </SelectTrigger>
                  <SelectContent>
                    {setlists?.map(sl => (
                      <SelectItem key={sl.id} value={sl.id}>
                        {sl.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Step 2: Select Venues */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <Label>Selected Venues ({selectedVenues.length})</Label>
                <div className="space-y-2 mt-2">
                  {selectedVenues.map((v) => (
                    <Card key={v.venueId}>
                      <CardContent className="flex items-center justify-between p-3">
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4" />
                          <div>
                            <p className="font-semibold text-sm">{v.venueName}</p>
                            <p className="text-xs text-muted-foreground">{v.cityName}</p>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => removeVenue(v.venueId)}
                        >
                          Remove
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>

              <div>
                <Label>Available Venues</Label>
                <div className="grid grid-cols-2 gap-2 mt-2 max-h-[300px] overflow-y-auto">
                  {venues?.map((venue) => (
                    <Card
                      key={venue.id}
                      className="cursor-pointer hover:bg-accent transition-colors"
                      onClick={() => addVenue(venue)}
                    >
                      <CardContent className="p-3">
                        <p className="font-semibold text-sm">{venue.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {(venue.cities as any)?.name || 'Unknown'}
                        </p>
                        <Badge variant="outline" className="mt-1">
                          {venue.capacity} capacity
                        </Badge>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Travel Options */}
          {step === 3 && (
            <div className="space-y-4">
              <Label>Travel Mode</Label>
              <div className="grid grid-cols-3 gap-3">
                <Card
                  className={`cursor-pointer transition-all ${
                    travelMode === 'auto' ? 'border-primary bg-primary/5' : ''
                  }`}
                  onClick={() => setTravelMode('auto')}
                >
                  <CardContent className="p-4 text-center">
                    <Plane className="h-8 w-8 mx-auto mb-2" />
                    <p className="font-semibold">Auto-Book</p>
                    <p className="text-xs text-muted-foreground">
                      System finds cheapest routes
                    </p>
                  </CardContent>
                </Card>

                <Card
                  className={`cursor-pointer transition-all ${
                    travelMode === 'tour_bus' ? 'border-primary bg-primary/5' : ''
                  }`}
                  onClick={() => setTravelMode('tour_bus')}
                >
                  <CardContent className="p-4 text-center">
                    <Bus className="h-8 w-8 mx-auto mb-2" />
                    <p className="font-semibold">Tour Bus</p>
                    <p className="text-xs text-muted-foreground">
                      Fixed daily cost
                    </p>
                  </CardContent>
                </Card>

                <Card
                  className={`cursor-pointer transition-all ${
                    travelMode === 'manual' ? 'border-primary bg-primary/5' : ''
                  }`}
                  onClick={() => setTravelMode('manual')}
                >
                  <CardContent className="p-4 text-center">
                    <Waypoints className="h-8 w-8 mx-auto mb-2" />
                    <p className="font-semibold">Manual</p>
                    <p className="text-xs text-muted-foreground">
                      Book travel yourself
                    </p>
                  </CardContent>
                </Card>
              </div>

              {travelMode === 'tour_bus' && (
                <div>
                  <Label>Daily Tour Bus Cost</Label>
                  <Input
                    type="number"
                    value={tourBusCost}
                    onChange={(e) => setTourBusCost(parseInt(e.target.value) || 500)}
                  />
                </div>
              )}
            </div>
          )}

          {/* Step 4: Budget Review */}
          {step === 4 && (
            <div className="space-y-4">
              <TourBudgetCalculator
                travelCosts={budgetEstimate.travelCosts}
                accommodationCosts={budgetEstimate.accommodationCosts}
                crewCosts={budgetEstimate.crewCosts}
                estimatedRevenue={budgetEstimate.estimatedRevenue}
                numberOfGigs={selectedVenues.length}
              />

              <Card>
                <CardContent className="p-4">
                  <h4 className="font-semibold mb-2">Tour Summary</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Tour Name:</span>
                      <span className="font-medium">{tourName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Duration:</span>
                      <span className="font-medium">
                        {startDate} to {endDate}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Venues:</span>
                      <span className="font-medium">{selectedVenues.length} stops</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Travel Mode:</span>
                      <Badge variant="outline">{travelMode}</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex justify-between pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => step > 1 ? setStep(step - 1) : onClose()}
            >
              {step === 1 ? 'Cancel' : 'Back'}
            </Button>
            <Button
              onClick={() => step < 4 ? setStep(step + 1) : handleSubmit()}
              disabled={
                (step === 1 && (!tourName || !startDate || !endDate || !setlistId)) ||
                (step === 2 && selectedVenues.length === 0) ||
                (step === 4 && isCreating)
              }
            >
              {step === 4 ? (isCreating ? 'Creating...' : 'Create Tour') : 'Next'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
