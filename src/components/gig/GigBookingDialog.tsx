import React, { useMemo, useState, useEffect } from "react";
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
import { DollarSign, TrendingDown, TrendingUp, Users, Clock, AlertCircle, CheckCircle, AlertTriangle } from "lucide-react";
import { Link } from "react-router-dom";
import { calculateAttendanceForecast } from "@/utils/gigPerformanceCalculator";
import { GIG_SLOTS, getSlotBadgeVariant } from "@/utils/gigSlots";
import { useSlotAvailability } from "@/hooks/useSlotAvailability";
import { checkBandLockout } from "@/utils/bandLockout";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import type { Database } from "@/lib/supabase-types";
import { calculateSetlistDuration, validateSetlistForSlot } from "@/utils/setlistDuration";
import { useSetlistSongs } from "@/hooks/useSetlists";

type VenueRow = Database['public']['Tables']['venues']['Row'];
type BandRow = Database['public']['Tables']['bands']['Row'];

interface Setlist {
  id: string;
  name: string;
  song_count: number;
}

interface SetlistSong {
  songs?: {
    duration_seconds?: number | null;
  } | null;
}

export interface BookingForecast {
  pessimistic: number;
  realistic: number;
  optimistic: number;
}

export interface GigBookingSubmission {
  setlistId: string;
  ticketPrice: number;
  selectedDate: Date;
  selectedSlot: string;
  attendanceForecast: BookingForecast;
  estimatedRevenue: number;
}

interface GigBookingDialogProps {
  venue: VenueRow | null;
  band: BandRow;
  setlists: Setlist[];
  onConfirm: (submission: GigBookingSubmission) => Promise<void>;
  onClose: () => void;
  isBooking: boolean;
  initialDate?: Date;
}

export const GigBookingDialog = ({ venue, band, setlists, onConfirm, onClose, isBooking, initialDate }: GigBookingDialogProps) => {
  const { toast } = useToast();
  const [selectedSetlistId, setSelectedSetlistId] = useState<string>("");
  const [ticketPrice, setTicketPrice] = useState<number>(20);
  const [selectedDate, setSelectedDate] = useState<Date>(initialDate ? new Date(initialDate) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));
  const [selectedSlot, setSelectedSlot] = useState<string>("");
  const [bandLockout, setBandLockout] = useState<{ isLocked: boolean; lockedUntil?: Date; reason?: string }>({ isLocked: false });

  useEffect(() => {
    if (initialDate) {
      setSelectedDate(new Date(initialDate));
    }
  }, [initialDate]);

  // Check band lockout status
  useEffect(() => {
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

  const { data: setlistSongsData } = useSetlistSongs(selectedSetlistId || null);

  const eligibleSetlists = setlists.filter((sl) => (sl.song_count ?? 0) >= 6);
  const hasEligibleSetlists = eligibleSetlists.length > 0;
  const selectedSlotData = GIG_SLOTS.find(s => s.id === selectedSlot);

  useEffect(() => {
    if (!hasEligibleSetlists) {
      setSelectedSetlistId("");
      return;
    }

    if (!selectedSetlistId && eligibleSetlists.length === 1) {
      setSelectedSetlistId(eligibleSetlists[0].id);
      return;
    }

    if (selectedSetlistId && !eligibleSetlists.some(setlist => setlist.id === selectedSetlistId)) {
      setSelectedSetlistId("");
    }
  }, [eligibleSetlists, hasEligibleSetlists, selectedSetlistId]);

  const setlistDuration = useMemo(() => {
    if (!setlistSongsData) return null;
    return calculateSetlistDuration(setlistSongsData.map(ss => ({
      duration_seconds: ss.songs?.duration_seconds
    })));
  }, [setlistSongsData]);

  const durationValidation = useMemo(() => {
    if (!setlistDuration || !selectedSlot) return null;
    return validateSetlistForSlot(setlistDuration.totalSeconds, selectedSlot);
  }, [setlistDuration, selectedSlot]);

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

    if (durationValidation && durationValidation.valid === false) {
      toast({
        title: "Setlist doesn't fit",
        description: "Choose or edit a setlist whose duration fits the selected slot.",
        variant: "destructive"
      });
      return;
    }

    await onConfirm({
      setlistId: selectedSetlistId,
      ticketPrice,
      selectedDate,
      selectedSlot,
      attendanceForecast,
      estimatedRevenue,
    });
  };

  if (!venue) return null;

  const isConfirmDisabled =
    !hasEligibleSetlists ||
    !selectedSetlistId ||
    !selectedSlot ||
    ticketPrice <= 0 ||
    isBooking ||
    bandLockout.isLocked ||
    durationValidation?.valid === false;

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
            <Select value={selectedSetlistId} onValueChange={setSelectedSetlistId} disabled={!hasEligibleSetlists}>
              <SelectTrigger id="setlist">
                <SelectValue placeholder="Choose a setlist..." />
              </SelectTrigger>
              <SelectContent>
                {hasEligibleSetlists ? (
                  eligibleSetlists.map((setlist) => (
                    <SelectItem key={setlist.id} value={setlist.id}>
                      {setlist.name} ({setlist.song_count} songs)
                    </SelectItem>
                  ))
                ) : (
                  <div className="p-2 text-sm text-muted-foreground">
                    No valid setlists (minimum 6 songs required)
                  </div>
                )}
              </SelectContent>
            </Select>

            {!hasEligibleSetlists && (
              <Alert variant="default" className="mt-2">
                <AlertDescription className="flex items-center justify-between gap-3">
                  <span>Create a setlist with at least 6 songs to unlock bookings.</span>
                  <Button asChild size="sm" variant="secondary">
                    <Link to="/setlists">Build setlist</Link>
                  </Button>
                </AlertDescription>
              </Alert>
            )}

            {/* Duration Display & Validation */}
            {selectedSetlistId && setlistDuration && (
              <div className="flex items-center gap-2 mt-2">
                <Badge variant="outline" className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {setlistDuration.displayTime}
                </Badge>
                
                {durationValidation && durationValidation.valid === false && (
                  <Badge variant="destructive" className="flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    Too long for slot
                  </Badge>
                )}

                {durationValidation && durationValidation.valid && durationValidation.message && (
                  <Badge variant="outline" className="flex items-center gap-1 text-amber-600">
                    <AlertTriangle className="h-3 w-3" />
                    Short setlist
                  </Badge>
                )}
                
                {durationValidation && durationValidation.valid && !durationValidation.message && (
                  <Badge variant="default" className="flex items-center gap-1">
                    <CheckCircle className="h-3 w-3" />
                    Perfect fit
                  </Badge>
                )}
              </div>
            )}
            
            {durationValidation?.message && (
              <p className="text-sm text-muted-foreground">{durationValidation.message}</p>
            )}
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

            {/* Revenue & Attendance Forecast */}
            {selectedSlot && selectedSetlistId && (
              <Card className="bg-muted/50">
                <CardContent className="pt-6">
                  <h4 className="font-semibold mb-4 flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Attendance & Revenue Forecast
                  </h4>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Attendance Forecast</span>
                      <Badge variant="outline">Based on your stats</Badge>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Pessimistic</span>
                        <span className="font-semibold">{attendanceForecast.pessimistic} people</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Realistic</span>
                        <span className="font-semibold text-primary">{attendanceForecast.realistic} people</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Optimistic</span>
                        <span className="font-semibold">{attendanceForecast.optimistic} people</span>
                      </div>
                    </div>
                    
                    <Separator />
                    
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Estimated Revenue</span>
                      <span className="text-lg font-bold text-green-600">
                        ${estimatedRevenue.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Venue Base Payment</span>
                      <span className="font-semibold text-green-600">
                        +${Math.round((venue.base_payment || 0) * (selectedSlotData?.paymentMultiplier || 1)).toLocaleString()}
                      </span>
                    </div>
                    <Separator />
                    <div className="flex justify-between items-center text-lg">
                      <span className="font-semibold">Total Projected Earnings</span>
                      <span className="font-bold text-primary">
                        ${(estimatedRevenue + Math.round((venue.base_payment || 0) * (selectedSlotData?.paymentMultiplier || 1))).toLocaleString()}
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground italic mt-4">
                    * Conservative estimates based on your band's current stats and venue prestige.
                  </p>
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
            disabled={isConfirmDisabled}
          >
            {isBooking ? "Booking..." : "Confirm Booking"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
