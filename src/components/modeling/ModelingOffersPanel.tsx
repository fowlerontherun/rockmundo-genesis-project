import { useState } from "react";
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
import { Camera, DollarSign, Star, Clock, Check, CalendarIcon, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { createScheduledActivity, checkTimeSlotAvailable } from "@/hooks/useActivityBooking";
import { ModelingCareerProgress } from "./ModelingCareerProgress";
import { cn } from "@/lib/utils";
import { format, addDays, startOfDay, isBefore } from "date-fns";

interface ModelingOffersPanelProps {
  userId: string;
  playerLooks: number;
  playerFame: number;
}

interface ModelingGig {
  id: string;
  title: string;
  description: string | null;
  gig_type: string;
  min_looks_required: number;
  min_fame_required: number;
  compensation_min: number;
  compensation_max: number;
  fame_boost: number;
  duration_hours: number;
  agency: { name: string; tier: string } | null;
  brand: { name: string } | null;
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
  const [bookingGig, setBookingGig] = useState<ModelingGig | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [selectedTime, setSelectedTime] = useState<string>("");
  const [conflictMessage, setConflictMessage] = useState<string | null>(null);

  const { data: eligibleGigs, isLoading } = useQuery({
    queryKey: ["modeling-gigs-eligible", playerLooks, playerFame],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("modeling_gigs")
        .select(`
          *,
          agency:modeling_agencies(name, tier),
          brand:sponsorship_brands(name)
        `)
        .eq("is_available", true)
        .lte("min_looks_required", playerLooks)
        .lte("min_fame_required", playerFame)
        .order("compensation_max", { ascending: false })
        .limit(10);

      if (error) throw error;
      return data as unknown as ModelingGig[];
    },
    enabled: playerLooks > 0,
  });

  const { data: activeContracts } = useQuery({
    queryKey: ["modeling-contracts", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("player_modeling_contracts")
        .select("*, gig:modeling_gigs(title, gig_type, duration_hours)")
        .eq("user_id", userId)
        .in("status", ["offered", "accepted", "shooting"]);

      if (error) throw error;
      return data;
    },
  });

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

  const acceptGig = useMutation({
    mutationFn: async ({ gig, date, time }: { gig: ModelingGig; date: Date; time: string }) => {
      const [hours] = time.split(":").map(Number);
      const shootStart = new Date(date);
      shootStart.setHours(hours, 0, 0, 0);
      const shootEnd = new Date(shootStart.getTime() + gig.duration_hours * 60 * 60 * 1000);

      // Validate future date
      if (shootStart <= new Date()) {
        throw new Error("Please select a date/time in the future.");
      }

      // Check for scheduling conflicts
      const { available, conflictingActivity } = await checkTimeSlotAvailable(userId, shootStart, shootEnd);
      if (!available) {
        throw new Error(
          `Schedule conflict: You have "${conflictingActivity?.title}" at this time. Choose a different slot.`
        );
      }

      const compensation = Math.floor(
        gig.compensation_min + Math.random() * (gig.compensation_max - gig.compensation_min)
      );

      // Create the contract
      const { error } = await supabase.from("player_modeling_contracts").insert({
        user_id: userId,
        gig_id: gig.id,
        status: "accepted",
        gig_type: gig.gig_type,
        compensation,
        fame_boost: gig.fame_boost,
        shoot_date: shootStart.toISOString().split("T")[0],
      });

      if (error) throw error;

      // Block schedule
      await createScheduledActivity({
        userId,
        activityType: "pr_appearance",
        scheduledStart: shootStart,
        scheduledEnd: shootEnd,
        title: `Modeling: ${gig.title}`,
        description: `${gigTypeLabels[gig.gig_type] || gig.gig_type} for ${gig.brand?.name || gig.agency?.name || "brand"} (${gig.duration_hours}h)`,
        metadata: {
          gig_id: gig.id,
          gig_type: gig.gig_type,
          compensation,
        },
      });

      return { compensation, shootStart };
    },
    onSuccess: (data) => {
      toast.success(
        `Modeling gig booked for ${format(data.shootStart, "MMM d 'at' h:mm a")}! You'll earn $${data.compensation.toLocaleString()}`
      );
      setBookingGig(null);
      setSelectedDate(undefined);
      setSelectedTime("");
      setConflictMessage(null);
      queryClient.invalidateQueries({ queryKey: ["modeling-contracts"] });
      queryClient.invalidateQueries({ queryKey: ["scheduled-activities"] });
    },
    onError: (error: Error) => {
      setConflictMessage(error.message);
    },
  });

  const handleOpenBooking = (gig: ModelingGig) => {
    setBookingGig(gig);
    setSelectedDate(addDays(new Date(), 1));
    setSelectedTime("10:00");
    setConflictMessage(null);
  };

  const handleConfirmBooking = () => {
    if (!bookingGig || !selectedDate || !selectedTime) return;
    setConflictMessage(null);
    acceptGig.mutate({ gig: bookingGig, date: selectedDate, time: selectedTime });
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
    );
  }

  const formatCompensation = (min: number, max: number) => {
    const fmt = (n: number) => (n >= 1000000 ? `$${(n / 1000000).toFixed(1)}M` : `$${(n / 1000).toFixed(0)}K`);
    return `${fmt(min)} - ${fmt(max)}`;
  };

  const completedCount = completedContracts?.length ?? 0;
  const totalEarnings = completedContracts?.reduce((sum, c) => sum + (c.compensation || 0), 0) ?? 0;

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

      {/* Available Gigs */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Camera className="h-5 w-5" />
          Available Modeling Gigs ({eligibleGigs?.length || 0})
        </h3>

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

        {eligibleGigs?.length === 0 ? (
          <Card className="bg-muted/50">
            <CardContent className="p-6 text-center text-muted-foreground">
              <Camera className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No modeling opportunities available at your current looks/fame level.</p>
              <p className="text-sm mt-1">Increase your looks attribute to unlock more gigs!</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {eligibleGigs?.map((gig) => (
              <Card key={gig.id} className="hover:shadow-lg transition-shadow">
                <CardContent className="p-4">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div className="space-y-2 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-semibold">{gig.title}</h4>
                        <Badge variant="outline">{gigTypeLabels[gig.gig_type] || gig.gig_type}</Badge>
                        {gig.agency && (
                          <Badge className={tierColors[gig.agency.tier] || tierColors.local}>
                            {gig.agency.name}
                          </Badge>
                        )}
                      </div>

                      {gig.brand && (
                        <p className="text-sm text-muted-foreground">Brand: {gig.brand.name}</p>
                      )}

                      {gig.description && (
                        <p className="text-sm text-muted-foreground">{gig.description}</p>
                      )}

                      <div className="flex flex-wrap gap-4 text-sm">
                        <span className="flex items-center gap-1">
                          <DollarSign className="h-4 w-4 text-success" />
                          {formatCompensation(gig.compensation_min, gig.compensation_max)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Star className="h-4 w-4 text-warning" />
                          +{gig.fame_boost} fame
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          {gig.duration_hours}h duration
                        </span>
                      </div>
                    </div>

                    <Button
                      onClick={() => handleOpenBooking(gig)}
                      disabled={hasActiveContract}
                      className="shrink-0"
                    >
                      <CalendarIcon className="h-4 w-4 mr-1" />
                      Book Shoot
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Booking Dialog */}
      <Dialog open={!!bookingGig} onOpenChange={(open) => { if (!open) { setBookingGig(null); setConflictMessage(null); } }}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Schedule Modeling Shoot</DialogTitle>
            <DialogDescription>
              {bookingGig?.title} — {gigTypeLabels[bookingGig?.gig_type || ""] || bookingGig?.gig_type} ({bookingGig?.duration_hours}h)
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Date Picker */}
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

            {/* Time Slot */}
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

            {/* Summary */}
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
                  <span className="text-muted-foreground">Duration</span>
                  <span className="font-medium">{bookingGig?.duration_hours}h</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Pay</span>
                  <span className="font-medium text-success">
                    {formatCompensation(bookingGig?.compensation_min || 0, bookingGig?.compensation_max || 0)}
                  </span>
                </div>
              </div>
            )}

            {/* Conflict warning */}
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
            <Button variant="outline" onClick={() => setBookingGig(null)}>Cancel</Button>
            <Button
              onClick={handleConfirmBooking}
              disabled={!selectedDate || !selectedTime || acceptGig.isPending}
            >
              {acceptGig.isPending ? "Booking..." : "Confirm Booking"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
