import React, { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { DollarSign, TrendingDown, TrendingUp, Users, Clock, AlertCircle, CheckCircle } from "lucide-react";
import { calculateAttendanceForecast } from "@/utils/gigPerformanceCalculator";
import { GIG_SLOTS, getSlotBadgeVariant } from "@/utils/gigSlots";
import { useSlotAvailability } from "@/hooks/useSlotAvailability";
import { checkBandLockout } from "@/utils/bandLockout";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import type { Database } from "@/lib/supabase-types";

type VenueRow = Database['public']['Tables']['venues']['Row'];
type BandRow = Database['public']['Tables']['bands']['Row'];

interface Setlist {
  id: string;
  name: string;
  song_count: number;
}

interface GigBookingDialogProps {
  venue: VenueRow | null;
  band: BandRow;
  setlists: Setlist[];
  onConfirm: (setlistId: string, ticketPrice: number, selectedDate: Date, selectedSlot: string) => Promise<void>;
  onClose: () => void;
  isBooking: boolean;
}

export const GigBookingDialog = ({ venue, band, setlists, onConfirm, onClose, isBooking }: GigBookingDialogProps) => {
  const { toast } = useToast();
  const [selectedSetlistId, setSelectedSetlistId] = useState<string>("");
  const [ticketPrice, setTicketPrice] = useState<number>(20);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));
  const [selectedSlot, setSelectedSlot] = useState<string>("");
  const [bandLockout, setBandLockout] = useState<{ isLocked: boolean; lockedUntil?: Date; reason?: string }>({ isLocked: false });

  // Check band lockout status
  React.useEffect(() => {
    if (venue && band?.id) {
      checkBandLockout(band.id).then(setBandLockout);
    }
  }, [venue, band?.id]);

  const { data: slotAvailability, isLoading: loadingSlots } = useSlotAvailability(
    venue?.id,
    selectedDate,
    band?.fame || 0,
    venue?.prestige_level || 0,
    !!venue
  );

  const eligibleSetlists = setlists.filter((sl) => (sl.song_count ?? 0) >= 6);
  const selectedSlotData = GIG_SLOTS.find(s => s.id === selectedSlot);

  const { attendanceForecast, estimatedRevenue, suggestedTicketPrice, priceRating } = useMemo(() => {
    if (!venue) {
      return {
        attendanceForecast: { pessimistic: 0, realistic: 0, optimistic: 0 },
        estimatedRevenue: 0,
        suggestedTicketPrice: 20,
        priceRating: 'good' as const
      };
    }

    const selectedSetlist = eligibleSetlists.find(s => s.id === selectedSetlistId);
    const setlistQuality = selectedSetlist ? selectedSetlist.song_count * 500 : 0;

    const baseForecast = calculateAttendanceForecast(
      band.fame || 0,
      band.popularity || 0,
      venue.capacity || 100,
      venue.prestige_level || 1,
      ticketPrice,
      setlistQuality
    );

    // Apply slot multiplier
    const slotMultiplier = selectedSlotData?.attendanceMultiplier || 1.0;
    const forecast = {
      pessimistic: Math.round(baseForecast.pessimistic * slotMultiplier),
      realistic: Math.round(baseForecast.realistic * slotMultiplier),
      optimistic: Math.round(baseForecast.optimistic * slotMultiplier)
    };

    const suggested = 15 + (venue.prestige_level || 1) * 5;
    const ratio = ticketPrice / suggested;

    let rating: 'perfect' | 'good' | 'too-low' | 'too-high' = 'good';
    if (ratio < 0.5) {
      rating = 'too-low';
    } else if (ratio > 1.5) {
      rating = 'too-high';
    } else if (ratio >= 0.8 && ratio <= 1.2) {
      rating = 'perfect';
    }

    return {
      attendanceForecast: forecast,
      estimatedRevenue: forecast.realistic * ticketPrice,
      suggestedTicketPrice: suggested,
      priceRating: rating,
    };
  }, [band.fame, band.popularity, venue, ticketPrice, selectedSlotData, selectedSetlistId, eligibleSetlists]);

  const handleConfirm = async () => {
    if (!selectedSetlistId || !selectedSlot || !selectedDate || !venue) return;
    await onConfirm(selectedSetlistId, ticketPrice, selectedDate, selectedSlot);
  };

  if (!venue) return null;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[700px]">
        <DialogHeader>
          <DialogTitle>Book Gig at {venue.name}</DialogTitle>
          <DialogDescription>
            Select your date, time slot, setlist, and ticket price.
          </DialogDescription>
        </DialogHeader>

        {bandLockout.isLocked && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {bandLockout.reason} - Available {bandLockout.lockedUntil ? formatDistanceToNow(bandLockout.lockedUntil, { addSuffix: true }) : 'soon'}
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-6">
          {/* Date Selection */}
          <div className="space-y-2">
            <Label>Performance Date</Label>
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(date) => date && setSelectedDate(date)}
              disabled={(date) => date < new Date()}
              className="rounded-md border"
            />
          </div>

          {/* Time Slot Selection */}
          <div className="space-y-2">
            <Label>Time Slot</Label>
            {loadingSlots ? (
              <div className="flex justify-center p-4">
                <div className="h-6 w-6 animate-spin rounded-full border-b-2 border-primary" />
              </div>
            ) : (
              <RadioGroup value={selectedSlot} onValueChange={setSelectedSlot}>
                {slotAvailability?.map(({ slot, isAvailable, isBooked, bookedByBand, meetsRequirements, requirementsNotMet }) => {
                  const isDisabled = !isAvailable || !meetsRequirements;
                  const paymentMultiplier = slot.paymentMultiplier;
                  const estimatedPayment = Math.round((venue.base_payment || 0) * paymentMultiplier);

                  return (
                    <div
                      key={slot.id}
                      className={cn(
                        "flex items-start space-x-3 rounded-lg border p-4 transition-colors",
                        isDisabled && "opacity-50 cursor-not-allowed",
                        selectedSlot === slot.id && "border-primary bg-primary/5"
                      )}
                    >
                      <RadioGroupItem value={slot.id} disabled={isDisabled} />
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center justify-between">
                          <Label className="font-semibold">{slot.name}</Label>
                          <div className="flex items-center gap-2">
                            <Badge variant={getSlotBadgeVariant(slot.id)}>
                              <Clock className="mr-1 h-3 w-3" />
                              {slot.startTime} - {slot.endTime}
                            </Badge>
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground">{slot.description}</p>

                        {/* Attendance & Payment preview */}
                        {selectedSlot === slot.id && (
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div className="flex items-center gap-1">
                              <Users className="h-3 w-3" />
                              <span>~{attendanceForecast.realistic} attendees</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <DollarSign className="h-3 w-3" />
                              <span>${estimatedPayment.toLocaleString()} base pay</span>
                            </div>
                          </div>
                        )}

                        {/* Status badges */}
                        {isBooked && (
                          <Badge variant="destructive" className="text-xs">
                            Booked by {bookedByBand}
                          </Badge>
                        )}
                        {requirementsNotMet && requirementsNotMet.length > 0 && (
                          <div className="space-y-1 text-xs text-destructive">
                            {requirementsNotMet.map(req => (
                              <div key={req}>• {req}</div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </RadioGroup>
            )}
          </div>

          <Separator />

          {/* Setlist Selection */}
          <div className="space-y-2">
            <Label htmlFor="setlist">Select Setlist *</Label>
            <Select value={selectedSetlistId} onValueChange={setSelectedSetlistId}>
              <SelectTrigger id="setlist">
                <SelectValue placeholder="Choose a setlist..." />
              </SelectTrigger>
              <SelectContent>
                {eligibleSetlists.length === 0 ? (
                  <div className="p-2 text-sm text-muted-foreground">
                    No valid setlists (minimum 6 songs required)
                  </div>
                ) : (
                  eligibleSetlists.map((setlist) => (
                    <SelectItem key={setlist.id} value={setlist.id}>
                      {setlist.name} ({setlist.song_count} songs)
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Ticket Pricing */}
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label htmlFor="price">Ticket Price *</Label>
                <span className="text-sm text-muted-foreground">
                  Suggested: ${suggestedTicketPrice}
                </span>
              </div>
              <Input
                id="price"
                type="number"
                min="1"
                max="1000"
                value={ticketPrice}
                onChange={(e) => setTicketPrice(Math.max(1, parseInt(e.target.value) || 1))}
              />
              <div className="flex items-center gap-2 text-sm">
                {priceRating === "perfect" && (
                  <Badge variant="default" className="gap-1">
                    <CheckCircle className="h-3 w-3" />
                    Perfect pricing
                  </Badge>
                )}
                {priceRating === "good" && (
                  <Badge variant="secondary" className="gap-1">
                    <TrendingUp className="h-3 w-3" />
                    Good pricing
                  </Badge>
                )}
                {priceRating === "too-low" && (
                  <Badge variant="outline" className="gap-1">
                    <TrendingDown className="h-3 w-3" />
                    Too low
                  </Badge>
                )}
                {priceRating === "too-high" && (
                  <Badge variant="destructive" className="gap-1">
                    <AlertCircle className="h-3 w-3" />
                    Too high
                  </Badge>
                )}
              </div>
            </div>

            {/* Revenue Estimation */}
            {selectedSlot && selectedSetlistId && (
              <Card className="bg-muted/50">
                <CardContent className="pt-6">
                  <h4 className="font-semibold mb-4 flex items-center gap-2">
                    <DollarSign className="h-5 w-5" />
                    Revenue Forecast
                  </h4>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Attendance Range</span>
                      <span className="text-sm font-medium">
                        {attendanceForecast.pessimistic} - {attendanceForecast.optimistic}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Expected Attendance</span>
                      <span className="font-bold">{attendanceForecast.realistic}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Ticket Revenue</span>
                      <span className="font-semibold">${estimatedRevenue.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Venue Payment</span>
                      <span className="font-semibold text-green-600">
                        +${Math.round((venue.base_payment || 0) * (selectedSlotData?.paymentMultiplier || 1)).toLocaleString()}
                      </span>
                    </div>
                    <Separator />
                    <div className="flex justify-between items-center text-lg">
                      <span className="font-semibold">Total Earnings</span>
                      <span className="font-bold text-primary">
                        ${(estimatedRevenue + Math.round((venue.base_payment || 0) * (selectedSlotData?.paymentMultiplier || 1))).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isBooking}>
            Cancel
          </Button>
          <Button 
            onClick={handleConfirm} 
            disabled={!selectedSetlistId || !selectedSlot || ticketPrice <= 0 || isBooking || bandLockout.isLocked}
          >
            {isBooking ? "Booking..." : "Confirm Booking"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
