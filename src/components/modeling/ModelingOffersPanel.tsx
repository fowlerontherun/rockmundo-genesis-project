import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Camera, DollarSign, Star, Clock, CalendarIcon, AlertCircle, X, Check, Timer } from "lucide-react";
import { toast } from "sonner";
import { createScheduledActivity, checkTimeSlotAvailable } from "@/hooks/useActivityBooking";
import { ModelingCareerProgress } from "./ModelingCareerProgress";
import { format, addDays, startOfDay, isBefore, differenceInHours } from "date-fns";
import {
  generateModelingOffersForUser,
  isOfferCooldownExpired,
  acceptModelingOffer,
  declineModelingOffer,
} from "@/utils/modelingOfferGenerator";

interface ModelingOffersPanelProps {
  userId: string;
  playerLooks: number;
  playerFame: number;
}

const gigTypeLabels: Record<string, string> = {
  photo_shoot: "Photo Shoot",
  runway: "Runway Show",
  commercial: "Commercial",
  music_video_cameo: "Music Video",
  cover_shoot: "Cover Shoot",
  brand_ambassador: "Brand Ambassador",
};

const tierColors: Record<string, string> = {
  elite: "bg-warning/20 text-warning border-warning/30",
  international: "bg-accent/20 text-accent border-accent/30",
  national: "bg-primary/20 text-primary border-primary/30",
  local: "bg-muted text-muted-foreground",
};

const TIME_SLOTS = [
  { value: "06:00", label: "06:00 AM" },
  { value: "08:00", label: "08:00 AM" },
  { value: "10:00", label: "10:00 AM" },
  { value: "12:00", label: "12:00 PM" },
  { value: "14:00", label: "02:00 PM" },
  { value: "16:00", label: "04:00 PM" },
  { value: "18:00", label: "06:00 PM" },
  { value: "20:00", label: "08:00 PM" },
];

export const ModelingOffersPanel = ({ userId, playerLooks, playerFame }: ModelingOffersPanelProps) => {
  const queryClient = useQueryClient();
  const [bookingOffer, setBookingOffer] = useState<any | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [selectedTime, setSelectedTime] = useState<string>("");
  const [conflictMessage, setConflictMessage] = useState<string | null>(null);

  // Fetch pending offers
  const { data: pendingOffers, isLoading } = useQuery({
    queryKey: ["modeling-offers-pending", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("player_modeling_contracts")
        .select("*, gig:modeling_gigs(title, gig_type, duration_hours, description, agency:modeling_agencies(name, tier), brand:sponsorship_brands(name))")
        .eq("user_id", userId)
        .eq("status", "pending")
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  // Fetch active (accepted/shooting) contracts
  const { data: activeContracts } = useQuery({
    queryKey: ["modeling-contracts-active", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("player_modeling_contracts")
        .select("*, gig:modeling_gigs(title, gig_type, duration_hours)")
        .eq("user_id", userId)
        .in("status", ["accepted", "shooting"]);

      if (error) throw error;
      return data;
    },
  });

  // Fetch completed for career progress
  const { data: completedContracts } = useQuery({
    queryKey: ["modeling-contracts-completed", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("player_modeling_contracts")
        .select("*, gig:modeling_gigs(title, gig_type)")
        .eq("user_id", userId)
        .eq("status", "completed");

      if (error) throw error;
      return data;
    },
  });

  const hasActiveContract = (activeContracts?.length ?? 0) > 0;

  // Auto-generate offers on page visit if none pending
  useEffect(() => {
    if (isLoading) return;
    if ((pendingOffers?.length ?? 0) === 0 && isOfferCooldownExpired()) {
      generateModelingOffersForUser(userId, playerLooks, playerFame).then((count) => {
        if (count > 0) {
          queryClient.invalidateQueries({ queryKey: ["modeling-offers-pending"] });
          toast.info(`${count} new modeling offer${count > 1 ? "s" : ""} arrived!`);
        }
      });
    }
  }, [isLoading, pendingOffers?.length, userId, playerLooks, playerFame]);

  // Accept mutation — opens scheduling dialog first, then confirms
  const confirmBooking = useMutation({
    mutationFn: async ({ offer, date, time }: { offer: any; date: Date; time: string }) => {
      const gig = offer.gig;
      const durationHours = gig?.duration_hours || 2;
      const [hours] = time.split(":").map(Number);
      const shootStart = new Date(date);
      shootStart.setHours(hours, 0, 0, 0);
      const shootEnd = new Date(shootStart.getTime() + durationHours * 60 * 60 * 1000);

      if (shootStart <= new Date()) {
        throw new Error("Please select a date/time in the future.");
      }

      const { available, conflictingActivity } = await checkTimeSlotAvailable(userId, shootStart, shootEnd);
      if (!available) {
        throw new Error(
          `Schedule conflict: You have "${conflictingActivity?.title}" at this time. Choose a different slot.`
        );
      }

      // Mark offer as accepted
      await acceptModelingOffer(offer.id);

      // Update shoot date
      await supabase
        .from("player_modeling_contracts")
        .update({
          shoot_date: shootStart.toISOString().split("T")[0],
          scheduled_start: shootStart.toISOString(),
          scheduled_end: shootEnd.toISOString(),
        })
        .eq("id", offer.id);

      // Block schedule
      await createScheduledActivity({
        userId,
        activityType: "pr_appearance",
        scheduledStart: shootStart,
        scheduledEnd: shootEnd,
        title: `Modeling: ${gig?.title || "Gig"}`,
        description: `${gigTypeLabels[gig?.gig_type] || gig?.gig_type} (${durationHours}h)`,
        metadata: {
          gig_id: offer.gig_id,
          gig_type: gig?.gig_type,
          compensation: offer.compensation,
        },
      });

      return { compensation: offer.compensation, shootStart };
    },
    onSuccess: (data) => {
      toast.success(
        `Modeling gig booked for ${format(data.shootStart, "MMM d 'at' h:mm a")}! You'll earn $${data.compensation.toLocaleString()}`
      );
      setBookingOffer(null);
      setSelectedDate(undefined);
      setSelectedTime("");
      setConflictMessage(null);
      queryClient.invalidateQueries({ queryKey: ["modeling-offers-pending"] });
      queryClient.invalidateQueries({ queryKey: ["modeling-contracts-active"] });
      queryClient.invalidateQueries({ queryKey: ["scheduled-activities"] });
    },
    onError: (error: Error) => {
      setConflictMessage(error.message);
    },
  });

  // Decline mutation
  const declineMutation = useMutation({
    mutationFn: async (offerId: string) => {
      await declineModelingOffer(offerId);
    },
    onSuccess: () => {
      toast.info("Offer declined.");
      queryClient.invalidateQueries({ queryKey: ["modeling-offers-pending"] });
    },
  });

  const handleAccept = (offer: any) => {
    setBookingOffer(offer);
    setSelectedDate(addDays(new Date(), 1));
    setSelectedTime("10:00");
    setConflictMessage(null);
  };

  const handleConfirmBooking = () => {
    if (!bookingOffer || !selectedDate || !selectedTime) return;
    setConflictMessage(null);
    confirmBooking.mutate({ offer: bookingOffer, date: selectedDate, time: selectedTime });
  };

  const completedCount = completedContracts?.length ?? 0;
  const totalEarnings = completedContracts?.reduce((sum, c) => sum + (c.compensation || 0), 0) ?? 0;

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Career Progress */}
      <ModelingCareerProgress
        totalGigsCompleted={completedCount}
        totalEarnings={totalEarnings}
        playerLooks={playerLooks}
        currentTier=""
      />

      {/* Active Contracts */}
      {activeContracts && activeContracts.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Camera className="h-5 w-5" />
              Active Contracts ({activeContracts.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {activeContracts.map((contract) => (
              <div key={contract.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div>
                  <span className="font-medium">{contract.gig?.title}</span>
                  <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                    <CalendarIcon className="h-3 w-3" />
                    <span>{contract.shoot_date ? format(new Date(contract.shoot_date), "MMM d, yyyy") : "TBD"}</span>
                    <Clock className="h-3 w-3 ml-1" />
                    <span>{contract.gig?.duration_hours || "?"}h</span>
                  </div>
                </div>
                <Badge variant="secondary">{contract.status}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Warning if active contract */}
      {hasActiveContract && (
        <Card className="border-warning/30 bg-warning/5">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-warning shrink-0" />
            <p className="text-sm text-warning">
              You have an active modeling contract. Complete it before accepting new gigs.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Incoming Offers */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Camera className="h-5 w-5" />
          Incoming Offers ({pendingOffers?.length || 0})
        </h3>

        {(!pendingOffers || pendingOffers.length === 0) ? (
          <Card className="bg-muted/50">
            <CardContent className="p-6 text-center text-muted-foreground">
              <Camera className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No offers right now. Check back later!</p>
              <p className="text-sm mt-1">Offers arrive based on your looks and fame level.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {pendingOffers.map((offer) => {
              const gig = offer.gig as any;
              const hoursLeft = offer.expires_at
                ? differenceInHours(new Date(offer.expires_at), new Date())
                : 0;

              return (
                <Card key={offer.id} className="hover:shadow-lg transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                      <div className="space-y-2 flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-semibold">{gig?.title || "Modeling Gig"}</h4>
                          <Badge variant="outline">
                            {gigTypeLabels[gig?.gig_type || offer.gig_type] || offer.gig_type}
                          </Badge>
                          {gig?.agency && (
                            <Badge className={tierColors[gig.agency.tier] || tierColors.local}>
                              {gig.agency.name}
                            </Badge>
                          )}
                        </div>

                        {offer.offer_reason && (
                          <p className="text-sm text-muted-foreground italic">"{offer.offer_reason}"</p>
                        )}

                        <div className="flex flex-wrap gap-4 text-sm">
                          <span className="flex items-center gap-1">
                            <DollarSign className="h-4 w-4 text-success" />
                            ${offer.compensation?.toLocaleString()}
                          </span>
                          <span className="flex items-center gap-1">
                            <Star className="h-4 w-4 text-warning" />
                            +{offer.fame_boost || 0} fame
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            {gig?.duration_hours || 2}h duration
                          </span>
                          <span className="flex items-center gap-1">
                            <Timer className="h-4 w-4 text-destructive" />
                            {hoursLeft > 24
                              ? `${Math.floor(hoursLeft / 24)}d left`
                              : `${hoursLeft}h left`}
                          </span>
                        </div>
                      </div>

                      <div className="flex gap-2 shrink-0">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => declineMutation.mutate(offer.id)}
                          disabled={declineMutation.isPending}
                        >
                          <X className="h-4 w-4 mr-1" />
                          Decline
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleAccept(offer)}
                          disabled={hasActiveContract}
                        >
                          <Check className="h-4 w-4 mr-1" />
                          Accept
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Booking Dialog */}
      <Dialog open={!!bookingOffer} onOpenChange={(open) => { if (!open) { setBookingOffer(null); setConflictMessage(null); } }}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Schedule Modeling Shoot</DialogTitle>
            <DialogDescription>
              {bookingOffer?.gig?.title} — {gigTypeLabels[bookingOffer?.gig?.gig_type || ""] || bookingOffer?.gig_type} ({bookingOffer?.gig?.duration_hours || 2}h)
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Shoot Date</Label>
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                disabled={(date) => isBefore(date, startOfDay(new Date()))}
                className="rounded-md border mx-auto"
              />
            </div>

            <div className="space-y-2">
              <Label>Start Time</Label>
              <Select value={selectedTime} onValueChange={setSelectedTime}>
                <SelectTrigger>
                  <SelectValue placeholder="Select time..." />
                </SelectTrigger>
                <SelectContent>
                  {TIME_SLOTS.map(slot => (
                    <SelectItem key={slot.value} value={slot.value}>
                      {slot.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedDate && selectedTime && (
              <div className="rounded-lg bg-muted/50 p-3 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Date</span>
                  <span className="font-medium">{format(selectedDate, "EEEE, MMM d, yyyy")}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Time</span>
                  <span className="font-medium">{TIME_SLOTS.find(s => s.value === selectedTime)?.label}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Pay</span>
                  <span className="font-medium text-success">${bookingOffer?.compensation?.toLocaleString()}</span>
                </div>
              </div>
            )}

            {conflictMessage && (
              <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-sm">
                <p className="font-medium text-destructive flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  {conflictMessage}
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setBookingOffer(null)}>Cancel</Button>
            <Button
              onClick={handleConfirmBooking}
              disabled={!selectedDate || !selectedTime || confirmBooking.isPending}
            >
              {confirmBooking.isPending ? "Booking..." : "Confirm Booking"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
