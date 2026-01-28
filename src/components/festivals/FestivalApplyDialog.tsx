import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Music, Star, DollarSign } from "lucide-react";
import type { Festival } from "@/hooks/useFestivals";
import { useFestivalScheduleConflict } from "@/hooks/useFestivalScheduleConflict";
import { FestivalScheduleConflictWarning } from "./FestivalScheduleConflictWarning";

interface FestivalApplyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  festival: Festival;
  bandFame: number;
  setlists?: Array<{ id: string; name: string }>;
  onApply: (data: {
    festival_id: string;
    band_id: string;
    performance_slot: string;
    stage: string;
    setlist_songs: string[];
  }) => void;
  bandId: string;
  isApplying?: boolean;
}

const PERFORMANCE_SLOTS = [
  { id: "opening", name: "Opening Act", minFame: 0, payment: 500, description: "First to play, build the energy" },
  { id: "support", name: "Support Act", minFame: 250, payment: 1500, description: "Warm up the crowd" },
  { id: "main", name: "Main Stage", minFame: 750, payment: 5000, description: "Prime slot performance" },
  { id: "headline", name: "Headliner", minFame: 2000, payment: 15000, description: "Close the show" },
];

export function FestivalApplyDialog({
  open,
  onOpenChange,
  festival,
  bandFame,
  setlists = [],
  onApply,
  bandId,
  isApplying,
}: FestivalApplyDialogProps) {
  const [selectedSlot, setSelectedSlot] = useState<string>("");
  const [selectedSetlist, setSelectedSetlist] = useState<string>("");

  // Check for schedule conflicts
  const { hasConflict, conflictingActivities, isChecking } = useFestivalScheduleConflict(
    festival.start_date,
    festival.end_date,
    open
  );

  const availableSlots = PERFORMANCE_SLOTS.filter((slot) => bandFame >= slot.minFame);
  const selectedSlotInfo = PERFORMANCE_SLOTS.find((s) => s.id === selectedSlot);

  const handleApply = () => {
    if (!selectedSlot) return;

    onApply({
      festival_id: festival.id,
      band_id: bandId,
      performance_slot: selectedSlot,
      stage: "main", // Default stage
      setlist_songs: selectedSetlist ? [selectedSetlist] : [],
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Apply to {festival.title}</DialogTitle>
          <DialogDescription>
            Choose your performance slot and prepare for the festival
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Festival Info */}
          <Card>
            <CardContent className="pt-4 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Location</span>
                <span className="font-medium">{festival.location}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Available Slots</span>
                <span className="font-medium">
                  {festival.max_participants - festival.current_participants} remaining
                </span>
              </div>
              {festival.rewards?.fame && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Fame Reward</span>
                  <span className="font-medium flex items-center gap-1">
                    <Star className="h-3.5 w-3.5 text-amber-500" />
                    +{festival.rewards.fame}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Schedule Conflict Warning */}
          <FestivalScheduleConflictWarning
            hasConflict={hasConflict}
            conflictingActivities={conflictingActivities}
            isChecking={isChecking}
          />

          {/* Performance Slot Selection */}
          <div className="space-y-3">
            <Label>Performance Slot</Label>
            <div className="grid gap-2">
              {PERFORMANCE_SLOTS.map((slot) => {
                const isAvailable = bandFame >= slot.minFame;
                return (
                  <Card
                    key={slot.id}
                    className={`cursor-pointer transition-all ${
                      selectedSlot === slot.id
                        ? "ring-2 ring-primary"
                        : isAvailable
                        ? "hover:bg-muted/50"
                        : "opacity-50 cursor-not-allowed"
                    }`}
                    onClick={() => isAvailable && setSelectedSlot(slot.id)}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{slot.name}</span>
                            {!isAvailable && (
                              <Badge variant="outline" className="text-xs">
                                Requires {slot.minFame} fame
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">{slot.description}</p>
                        </div>
                        <Badge variant="secondary" className="flex items-center gap-1">
                          <DollarSign className="h-3 w-3" />
                          {slot.payment.toLocaleString()}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>

          {/* Setlist Selection (optional) */}
          {setlists.length > 0 && (
            <div className="space-y-2">
              <Label>Setlist (Optional)</Label>
              <Select value={selectedSetlist} onValueChange={setSelectedSetlist}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a setlist" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No setlist</SelectItem>
                  {setlists.map((setlist) => (
                    <SelectItem key={setlist.id} value={setlist.id}>
                      <div className="flex items-center gap-2">
                        <Music className="h-4 w-4" />
                        {setlist.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Selected Slot Summary */}
          {selectedSlotInfo && (
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="p-4">
                <h4 className="font-medium mb-2">Application Summary</h4>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Slot</span>
                    <span>{selectedSlotInfo.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Payment</span>
                    <span className="text-green-600">
                      ${selectedSlotInfo.payment.toLocaleString()}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
            Cancel
          </Button>
          <Button
            onClick={handleApply}
            disabled={!selectedSlot || isApplying || hasConflict}
            className="flex-1"
          >
            {isApplying ? "Submitting..." : hasConflict ? "Conflict Detected" : "Submit Application"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
