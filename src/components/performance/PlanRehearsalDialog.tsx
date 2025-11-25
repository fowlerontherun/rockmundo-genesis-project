import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarIcon, Clock } from "lucide-react";
import { format, addHours, set } from "date-fns";
import { cn } from "@/lib/utils";

interface PlanRehearsalDialogProps {
  open: boolean;
  onClose: () => void;
  band: any;
  rooms: any[];
  songs: any[];
  onConfirm: (roomId: string, duration: number, songId: string | null, setlistId: string | null, scheduledStart: Date) => Promise<any>;
}

export function PlanRehearsalDialog({
  open,
  onClose,
  band,
  rooms,
  songs,
  onConfirm,
}: PlanRehearsalDialogProps) {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedHour, setSelectedHour] = useState<string>("18");
  const [selectedRoomId, setSelectedRoomId] = useState<string>("");
  const [selectedDuration, setSelectedDuration] = useState<number>(2);
  const [selectedSongId, setSelectedSongId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!selectedRoomId) return;
    
    setLoading(true);
    
    // Combine date and hour
    const scheduledStart = set(selectedDate, {
      hours: parseInt(selectedHour),
      minutes: 0,
      seconds: 0,
      milliseconds: 0,
    });

    try {
      await onConfirm(selectedRoomId, selectedDuration, selectedSongId, null, scheduledStart);
      onClose();
    } catch (error) {
      console.error("Failed to book rehearsal:", error);
    } finally {
      setLoading(false);
    }
  };

  const selectedRoom = rooms.find(r => r.id === selectedRoomId);
  const totalCost = selectedRoom ? selectedRoom.hourly_rate * selectedDuration : 0;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Plan Rehearsal for {band?.name}</DialogTitle>
          <DialogDescription>
            Schedule a future rehearsal session
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Date Picker */}
          <div className="space-y-2">
            <Label>Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !selectedDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {selectedDate ? format(selectedDate, "PPP") : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => date && setSelectedDate(date)}
                  disabled={(date) => date < new Date()}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Time Picker */}
          <div className="space-y-2">
            <Label>Start Time</Label>
            <Select value={selectedHour} onValueChange={setSelectedHour}>
              <SelectTrigger>
                <SelectValue placeholder="Select time" />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 24 }, (_, i) => (
                  <SelectItem key={i} value={i.toString()}>
                    {format(set(new Date(), { hours: i, minutes: 0 }), "HH:mm")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Room Selection */}
          <div className="space-y-2">
            <Label>Rehearsal Room</Label>
            <Select value={selectedRoomId} onValueChange={setSelectedRoomId}>
              <SelectTrigger>
                <SelectValue placeholder="Select room" />
              </SelectTrigger>
              <SelectContent>
                {rooms.map((room) => (
                  <SelectItem key={room.id} value={room.id}>
                    {room.name} - ${room.hourly_rate}/hr
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Duration */}
          <div className="space-y-2">
            <Label>Duration (hours)</Label>
            <Select value={selectedDuration.toString()} onValueChange={(v) => setSelectedDuration(parseInt(v))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4, 5, 6].map((hours) => (
                  <SelectItem key={hours} value={hours.toString()}>
                    {hours} {hours === 1 ? "hour" : "hours"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Song Selection (Optional) */}
          <div className="space-y-2">
            <Label>Focus Song (Optional)</Label>
            <Select value={selectedSongId || "none"} onValueChange={(v) => setSelectedSongId(v === "none" ? null : v)}>
              <SelectTrigger>
                <SelectValue placeholder="General practice" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">General Practice</SelectItem>
                {songs.map((song) => (
                  <SelectItem key={song.id} value={song.id}>
                    {song.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Cost Summary */}
          {selectedRoom && (
            <div className="rounded-lg bg-muted p-3">
              <div className="flex justify-between text-sm">
                <span>Total Cost:</span>
                <span className="font-semibold">${totalCost.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>Band Balance:</span>
                <span>${(band?.band_balance || 0).toFixed(2)}</span>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={!selectedRoomId || loading}>
              {loading ? "Booking..." : "Book Rehearsal"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
