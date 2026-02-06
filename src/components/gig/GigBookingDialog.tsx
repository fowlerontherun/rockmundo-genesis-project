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
import { Progress } from "@/components/ui/progress";
import { DollarSign, TrendingDown, TrendingUp, Users, Clock, AlertCircle, CheckCircle, AlertTriangle, Target, Star } from "lucide-react";
import { Link } from "react-router-dom";
import { calculateAttendanceForecast } from "@/utils/gigPerformanceCalculator";
import { calculateVenuePayout, getPayoutTier } from "@/utils/venuePayoutCalculator";
import { GIG_SLOTS, getSlotBadgeVariant } from "@/utils/gigSlots";
import { useSlotAvailability } from "@/hooks/useSlotAvailability";
import { useBandRiders, useVenueRiderCompatibility } from "@/hooks/useBandRiders";
import { checkBandLockout } from "@/utils/bandLockout";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import type { Database } from "@/lib/supabase-types";
import { calculateSetlistDuration, validateSetlistForSlot } from "@/utils/setlistDuration";
import { useSetlistSongs } from "@/hooks/useSetlists";
import { TicketOperatorSelector } from "@/components/gig/TicketOperatorSelector";

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
  ticketOperatorId?: string;
  riderId?: string;
  venuePayout?: number;
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
  const [selectedOperatorId, setSelectedOperatorId] = useState<string | null>(null);
  const [selectedRiderId, setSelectedRiderId] = useState<string>("none");

  // Check if venue is large enough for ticket operators (200+ capacity)
  const canUseTicketOperator = (venue?.capacity || 0) >= 200;

  // Fetch band's riders
  const { riders, ridersLoading } = useBandRiders(band?.id || null);

  // Check rider compatibility with venue
  const { data: riderCompatibility } = useVenueRiderCompatibility(
    venue?.id || null,
    selectedRiderId !== "none" ? selectedRiderId : null
  );

  useEffect(() => {
    if (initialDate) {
      setSelectedDate(new Date(initialDate));
    }
  }, [initialDate]);

  // Auto-select default rider
  useEffect(() => {
    if (riders && riders.length > 0 && selectedRiderId === "none") {
      const defaultRider = riders.find(r => r.is_default);
      if (defaultRider) {
        setSelectedRiderId(defaultRider.id);
      }
    }
  }, [riders, selectedRiderId]);

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

  // Calculate venue payout based on band stats and venue
  const payoutBreakdown = useMemo(() => {
    if (!venue || !selectedSlotData) return null;
    return calculateVenuePayout({
      bandFame: band.fame || 0,
      bandTotalFans: band.total_fans || 0,
      venueCapacity: venue.capacity || 100,
      venuePrestige: venue.prestige_level || 1,
      venueBasePayment: venue.base_payment || 0,
      slotPaymentMultiplier: selectedSlotData.paymentMultiplier,
      riderCost: riderCompatibility?.totalCost || 0,
    });
  }, [band.fame, band.total_fans, venue, selectedSlotData, riderCompatibility?.totalCost]);

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
      ticketOperatorId: selectedOperatorId || undefined,
      riderId: selectedRiderId !== "none" ? selectedRiderId : undefined,
      venuePayout: payoutBreakdown?.netPayout,
    });
  };

  if (!venue) return null;

  // Ticket operator is mandatory for venues 200+ capacity
  const operatorRequired = canUseTicketOperator && !selectedOperatorId;
  
  const isConfirmDisabled =
    !hasEligibleSetlists ||
    !selectedSetlistId ||
    !selectedSlot ||
    ticketPrice <= 0 ||
    isBooking ||
    bandLockout.isLocked ||
    durationValidation?.valid === false ||
    operatorRequired;

  const payoutTier = payoutBreakdown ? getPayoutTier(payoutBreakdown.netPayout) : null;

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

                  // Calculate payout preview for this slot
                  const slotPayout = calculateVenuePayout({
                    bandFame: band.fame || 0,
                    bandTotalFans: band.total_fans || 0,
                    venueCapacity: venue.capacity || 100,
                    venuePrestige: venue.prestige_level || 1,
                    venueBasePayment: venue.base_payment || 0,
                    slotPaymentMultiplier: slot.paymentMultiplier,
                    riderCost: 0,
                  });

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

                        {/* Venue payout preview for each slot */}
                        <div className="flex items-center gap-3 text-xs">
                          <div className="flex items-center gap-1 text-green-600">
                            <DollarSign className="h-3 w-3" />
                            <span className="font-medium">${slotPayout.grossPayout.toLocaleString()} venue pay</span>
                          </div>
                          {slotPayout.fameBonus > 0 && (
                            <span className="text-muted-foreground">
                              (${slotPayout.basePay} base + ${slotPayout.fameBonus} fame + ${slotPayout.fanDrawBonus} fans)
                            </span>
                          )}
                        </div>

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

          {/* Rider Selection */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2">
                <Target className="h-4 w-4" />
                Band Rider
              </Label>
              {riders && riders.length === 0 && (
                <Button asChild size="sm" variant="ghost" className="text-xs">
                  <Link to="/band-riders">Create Rider</Link>
                </Button>
              )}
            </div>
            
            <Select value={selectedRiderId} onValueChange={setSelectedRiderId} disabled={ridersLoading}>
              <SelectTrigger>
                <SelectValue placeholder={ridersLoading ? "Loading riders..." : "No rider selected"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No rider (basic setup)</SelectItem>
                {riders?.map((rider) => (
                  <SelectItem key={rider.id} value={rider.id}>
                    <span className="flex items-center gap-2">
                      {rider.name}
                      {rider.is_default && <Star className="h-3 w-3 text-amber-500" />}
                      <span className="text-muted-foreground">
                        (~${rider.total_cost_estimate?.toLocaleString()})
                      </span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Rider Compatibility Preview */}
            {selectedRiderId !== "none" && riderCompatibility && (
              <Card className="bg-muted/30 border-dashed">
                <CardContent className="pt-4 pb-3 space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">Venue Fulfillment</span>
                    <Badge variant={riderCompatibility.fulfillmentPercentage >= 80 ? "default" : riderCompatibility.fulfillmentPercentage >= 50 ? "secondary" : "destructive"}>
                      {riderCompatibility.fulfillmentPercentage}%
                    </Badge>
                  </div>
                  <Progress value={riderCompatibility.fulfillmentPercentage} className="h-2" />
                  
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="text-center">
                      <div className="text-muted-foreground">Technical</div>
                      <div className="font-semibold">{riderCompatibility.technicalFulfillment}%</div>
                    </div>
                    <div className="text-center">
                      <div className="text-muted-foreground">Hospitality</div>
                      <div className="font-semibold">{riderCompatibility.hospitalityFulfillment}%</div>
                    </div>
                    <div className="text-center">
                      <div className="text-muted-foreground">Backstage</div>
                      <div className="font-semibold">{riderCompatibility.backstageFulfillment}%</div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs border-t pt-2">
                    <span className="text-muted-foreground">Rider cost (venue covers)</span>
                    <span className="font-medium">${riderCompatibility.totalCost.toLocaleString()}</span>
                  </div>

                  <div className="flex gap-2 text-xs">
                    <Badge variant="outline" className="gap-1">
                      Performance: {riderCompatibility.performanceModifier >= 1 ? '+' : ''}{Math.round((riderCompatibility.performanceModifier - 1) * 100)}%
                    </Badge>
                    <Badge variant="outline" className="gap-1">
                      Morale: {riderCompatibility.moraleModifier >= 1 ? '+' : ''}{Math.round((riderCompatibility.moraleModifier - 1) * 100)}%
                    </Badge>
                  </div>

                  {riderCompatibility.missing.length > 0 && (
                    <div className="text-xs text-amber-600">
                      <AlertTriangle className="h-3 w-3 inline mr-1" />
                      {riderCompatibility.missing.length} item{riderCompatibility.missing.length !== 1 ? 's' : ''} not available at this venue
                    </div>
                  )}
                </CardContent>
              </Card>
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

            {/* Revenue & Payout Forecast */}
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

                    {/* Ticket Revenue */}
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Ticket Revenue</span>
                      <span className="font-semibold text-green-600">
                        ${estimatedRevenue.toLocaleString()}
                      </span>
                    </div>

                    {/* Venue Payout Breakdown */}
                    {payoutBreakdown && (
                      <>
                        <div className="space-y-1.5 rounded-lg bg-background/50 p-3">
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-medium flex items-center gap-1.5">
                              <DollarSign className="h-4 w-4" />
                              Venue Payment
                              {payoutTier && (
                                <Badge variant="outline" className={cn("text-xs", payoutTier.color)}>
                                  {payoutTier.label}
                                </Badge>
                              )}
                            </span>
                          </div>
                          <div className="text-xs space-y-1 text-muted-foreground pl-5">
                            <div className="flex justify-between">
                              <span>Base pay ({(payoutBreakdown.slotMultiplier * 100).toFixed(0)}% slot)</span>
                              <span>${payoutBreakdown.basePay.toLocaleString()}</span>
                            </div>
                            {payoutBreakdown.fameBonus > 0 && (
                              <div className="flex justify-between">
                                <span>Fame bonus</span>
                                <span className="text-green-600">+${payoutBreakdown.fameBonus.toLocaleString()}</span>
                              </div>
                            )}
                            {payoutBreakdown.fanDrawBonus > 0 && (
                              <div className="flex justify-between">
                                <span>Fan draw bonus</span>
                                <span className="text-green-600">+${payoutBreakdown.fanDrawBonus.toLocaleString()}</span>
                              </div>
                            )}
                            {payoutBreakdown.prestigeMultiplier > 1.0 && (
                              <div className="flex justify-between">
                                <span>Prestige ×{payoutBreakdown.prestigeMultiplier.toFixed(2)}</span>
                                <span className="text-blue-500">applied</span>
                              </div>
                            )}
                            {payoutBreakdown.riderCost > 0 && (
                              <div className="flex justify-between">
                                <span>Rider cost (venue covers)</span>
                                <span className="text-amber-600">-${payoutBreakdown.riderCost.toLocaleString()}</span>
                              </div>
                            )}
                          </div>
                          <div className="flex justify-between items-center pt-1 border-t text-sm font-semibold">
                            <span>Net venue pay</span>
                            <span className="text-green-600">${payoutBreakdown.netPayout.toLocaleString()}</span>
                          </div>
                        </div>
                      </>
                    )}

                    <Separator />
                    <div className="flex justify-between items-center text-lg">
                      <span className="font-semibold">Total Projected Earnings</span>
                      <span className="font-bold text-primary">
                        ${(estimatedRevenue + (payoutBreakdown?.netPayout || 0)).toLocaleString()}
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground italic mt-4">
                    * Conservative estimates based on your band's fame, fans, and venue prestige.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Ticket Operator Selection (for venues 200+ capacity) */}
          {canUseTicketOperator && (
            <>
              <Separator />
              <TicketOperatorSelector
                selectedOperatorId={selectedOperatorId}
                onSelectOperator={setSelectedOperatorId}
                venueCapacity={venue?.capacity || 0}
              />
            </>
          )}
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
